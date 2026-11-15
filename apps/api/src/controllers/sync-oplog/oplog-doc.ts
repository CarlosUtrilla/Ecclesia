/**
 * Documento del OpLog como JSON plano (formato v2), sin Automerge.
 *
 * Antes el doc era un `Doc<OplogDocument>` de Automerge: cada string era un Text
 * CRDT y un oplog de ~12 MB de JSON dejaba el proceso main en ~1,3 GB de memoria
 * WASM que nunca se libera. El sync solo necesita unir listas de ops entre
 * dispositivos, rellenar campos de blobs y podar ops, así que se resuelve con un
 * merge propio (`mergeOplogDocs`) y un hash de contenido (`oplogContentHash`).
 *
 * Módulo puro: sin Prisma, Drive ni Electron, para poder testearlo aislado.
 */
import { createHash } from 'crypto'
import { gzip, gunzip } from 'zlib'
import { promisify } from 'util'
import type { OplogDocument, OplogEvent } from './oplog.types'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

/**
 * Campos de un op que se rellenan después de crearlo (backfill de checksums,
 * regeneración de thumbnails). El resto de un op es inmutable una vez emitido.
 */
const FILLABLE_FIELDS = [
  'checksum',
  'thumbnailChecksum',
  'fallbackChecksum',
  'blobSize',
  'blobMimeType',
  'blobPath',
  'thumbnailBlobPath',
  'fallbackBlobPath',
] as const satisfies readonly (keyof OplogEvent)[]

/** Campos de `op.data` que `regenerate-media-assets` reescribe. */
const FILLABLE_DATA_FIELDS = ['thumbnail', 'fallback'] as const

const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === ''

// Primeros bytes de cada formato en disco/Drive.
const GZIP_MAGIC = [0x1f, 0x8b]
const AUTOMERGE_MAGIC = [0x85, 0x6f, 0x4a, 0x83]

const startsWith = (data: Uint8Array, magic: number[]): boolean =>
  data.length >= magic.length && magic.every((byte, i) => data[i] === byte)

export function isLegacyAutomergeBinary(data: Uint8Array): boolean {
  return startsWith(data, AUTOMERGE_MAGIC)
}

export function createOplogDoc(fields: {
  schemaVersion: 1
  schemaHash: string
  createdAt: number
  ops?: OplogEvent[]
  snapshot?: OplogDocument['snapshot']
}): OplogDocument {
  return { ...fields, ops: fields.ops ?? [], tombstones: {} }
}

export async function serializeOplogDoc(doc: OplogDocument): Promise<Uint8Array> {
  return new Uint8Array(await gzipAsync(JSON.stringify(doc)))
}

/**
 * Lee un oplog en formato v2 (JSON gzip) o v1 (binario de Automerge).
 *
 * El v1 solo aparece una vez por dispositivo, al migrar: Automerge se importa de
 * forma dinámica para que su WASM no se cargue en un arranque normal.
 */
export async function deserializeOplogDoc(data: Uint8Array): Promise<OplogDocument> {
  if (startsWith(data, GZIP_MAGIC)) {
    const json = (await gunzipAsync(data)).toString('utf8')
    return normalizeOplogDoc(JSON.parse(json))
  }
  if (isLegacyAutomergeBinary(data)) {
    const { load, toJS } = await import('@automerge/automerge')
    return normalizeOplogDoc(toJS(load<OplogDocument>(data)))
  }
  throw new Error('Formato de oplog desconocido')
}

function normalizeOplogDoc(raw: Partial<OplogDocument>): OplogDocument {
  return {
    ...raw,
    schemaVersion: 1,
    schemaHash: raw.schemaHash ?? '',
    createdAt: raw.createdAt ?? Date.now(),
    ops: raw.ops ?? [],
    tombstones: raw.tombstones ?? {},
  }
}

/** Rellena en `target` los campos que tiene vacíos con los de `source`. */
function mergeFillable(target: OplogEvent, source: OplogEvent): OplogEvent {
  const patch: Record<string, unknown> = {}

  for (const key of FILLABLE_FIELDS) {
    const incoming = source[key]
    // Valor vacío nunca pisa; si ambos tienen valor distinto gana `source` (el
    // remoto). Es arbitrario pero determinista, y converge porque todo pasa por
    // el archivo de Drive en serie.
    if (!isEmpty(incoming) && incoming !== target[key]) patch[key] = incoming
  }

  if (source.data && target.data) {
    const dataPatch: Record<string, unknown> = {}
    for (const key of FILLABLE_DATA_FIELDS) {
      const incoming = source.data[key]
      if (!isEmpty(incoming) && incoming !== target.data[key]) dataPatch[key] = incoming
    }
    if (Object.keys(dataPatch).length > 0) patch.data = { ...target.data, ...dataPatch }
  }

  return Object.keys(patch).length > 0 ? ({ ...target, ...patch } as OplogEvent) : target
}

/**
 * Une el oplog local con el remoto.
 *
 * - Ops: unión por `id`. Los locales conservan su posición y los nuevos del remoto
 *   se añaden al final en su orden, así `replayState.lastAppliedIndex` sigue
 *   apuntando a lo ya aplicado.
 * - Tombstones: unión. Un op podado en cualquier lado no vuelve a aparecer.
 * - Campos rellenables: ver `mergeFillable`.
 *
 * No muta las entradas.
 */
export function mergeOplogDocs(
  local: OplogDocument,
  remote: OplogDocument,
): { merged: OplogDocument; newOps: OplogEvent[] } {
  const tombstones: Record<string, number> = { ...local.tombstones }
  for (const [id, prunedAt] of Object.entries(remote.tombstones ?? {})) {
    tombstones[id] = Math.min(tombstones[id] ?? prunedAt, prunedAt)
  }

  const remoteById = new Map(remote.ops.map((op) => [op.id, op]))
  const ops: OplogEvent[] = []
  const seen = new Set<string>()

  for (const op of local.ops) {
    if (op.id in tombstones || seen.has(op.id)) continue
    seen.add(op.id)
    const remoteOp = remoteById.get(op.id)
    ops.push(remoteOp ? mergeFillable(op, remoteOp) : op)
  }

  const newOps: OplogEvent[] = []
  for (const op of remote.ops) {
    if (op.id in tombstones || seen.has(op.id)) continue
    seen.add(op.id)
    ops.push(op)
    newOps.push(op)
  }

  return {
    merged: {
      ...local,
      snapshot: local.snapshot ?? remote.snapshot,
      ops,
      tombstones,
    },
    newOps,
  }
}

/**
 * Hash del contenido sincronizable, independiente del orden de los ops. Sustituye
 * a las heads de Automerge para saber si el doc local ya está subido: dos docs con
 * los mismos ops, rellenos y tombstones dan el mismo hash.
 */
export function oplogContentHash(doc: OplogDocument): string {
  const hash = createHash('sha256')
  const ops = [...doc.ops].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const op of ops) {
    hash.update(op.id)
    for (const key of FILLABLE_FIELDS) hash.update(`|${op[key] ?? ''}`)
    for (const key of FILLABLE_DATA_FIELDS) hash.update(`|${op.data?.[key] ?? ''}`)
    hash.update('\n')
  }
  for (const id of Object.keys(doc.tombstones ?? {}).sort()) hash.update(`x${id}\n`)
  return hash.digest('hex')
}
