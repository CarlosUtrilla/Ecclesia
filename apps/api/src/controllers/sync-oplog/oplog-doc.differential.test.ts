/**
 * Prueba diferencial: el merge propio (`oplog-doc.ts`) contra Automerge, que es lo
 * que sustituye y lo que lleva meses sincronizando sin pérdidas.
 *
 * Se generan historias aleatorias (con semilla, reproducibles) entre varios
 * dispositivos que comparten un archivo de Drive, y cada historia se ejecuta en
 * paralelo con los dos sistemas: mismas altas de ops, mismos rellenos de campos de
 * blobs, mismas podas y los mismos pull/push en el mismo orden. Después de cada
 * pull se compara el conjunto de ops nuevos (lo que el replay aplicaría a la DB) y,
 * al final, el contenido completo de cada dispositivo y del archivo de Drive.
 *
 * Lo único que puede diferir por diseño es qué valor gana cuando dos dispositivos
 * rellenan el MISMO campo del MISMO op con valores DISTINTOS de forma concurrente
 * (Automerge desempata por actor; el merge propio, por el lado remoto). En la app eso
 * no ocurre: el valor es el checksum/ruta del mismo archivo. Se prueba aparte, con
 * valores realistas (deterministas) y con valores conflictivos (aleatorios), y en el
 * segundo caso solo se exige que cada sistema converja consigo mismo.
 *
 * `OPLOG_DIFF_RUNS` sube el número de historias (por defecto 400).
 */
import { describe, expect, it } from 'vitest'
import { change, clone, from, merge, toJS, type Doc } from '@automerge/automerge'
import { createOplogDoc, mergeOplogDocs, oplogContentHash } from './oplog-doc'
import type { OplogDocument, OplogEvent } from './oplog.types'

const RUNS = Number(process.env.OPLOG_DIFF_RUNS) || 400
const FIRST_SEED = Number(process.env.OPLOG_DIFF_FROM) || 1
const STEPS = 60
// Cada historia ejecuta Automerge entero; 400 historias tardan ~15 s.
const TIMEOUT_MS = Math.max(120_000, RUNS * 300)

// PRNG con semilla (mulberry32) para que cualquier fallo se pueda reproducir.
function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T>(items: T[]): T => items[Math.floor(next() * items.length)],
  }
}

const FILL_FIELDS = ['checksum', 'thumbnailChecksum', 'blobPath', 'thumbnailBlobPath', 'fallbackBlobPath'] as const
type Fill = { field: (typeof FILL_FIELDS)[number] | 'data.thumbnail' | 'data.fallback'; value: string }

type Device = {
  id: string
  seq: number
  am: Doc<OplogDocument>
  v2: OplogDocument
}

const BASE = { schemaVersion: 1 as const, schemaHash: 'h', createdAt: 1 }

/** Op de una sola representación: sin `undefined` (Automerge no los admite). */
function newOp(device: Device, r: ReturnType<typeof rng>): OplogEvent {
  device.seq += 1
  const id = `${device.id}-${device.seq}`
  return {
    id,
    seq: device.seq,
    deviceId: device.id,
    timestamp: 1000 + device.seq,
    entityType: r.pick(['media', 'song', 'schedule'] as const),
    entityId: `e${r.int(6)}`,
    op: r.next() < 0.85 ? 'upsert' : 'delete',
    data: { title: `t-${id}`, lyrics: `línea ${id}\notra línea` },
  }
}

function applyFill(target: OplogEvent, fill: Fill): void {
  if (fill.field === 'data.thumbnail' || fill.field === 'data.fallback') {
    const key = fill.field === 'data.thumbnail' ? 'thumbnail' : 'fallback'
    if (target.data) target.data[key] = fill.value
    return
  }
  target[fill.field] = fill.value
}

/** Forma comparable de un doc: ops ordenados por id y tombstones como conjunto. */
function canonical(doc: OplogDocument, withTombstones: boolean) {
  const ops = [...doc.ops].sort((a, b) => (a.id < b.id ? -1 : 1))
  return withTombstones ? { ops, pruned: Object.keys(doc.tombstones ?? {}).sort() } : { ops }
}

const sortedIds = (ops: OplogEvent[]) => ops.map((o) => o.id).sort()

function runScenario(seed: number, conflictingFills: boolean) {
  try {
    return runScenarioUnsafe(seed, conflictingFills)
  } catch (error) {
    // Con el seed se reproduce la historia exacta que falló.
    throw new Error(`seed ${seed} (conflictingFills=${conflictingFills}): ${(error as Error).message}`, { cause: error })
  }
}

function runScenarioUnsafe(seed: number, conflictingFills: boolean) {
  const r = rng(seed)
  const deviceCount = 2 + r.int(2)
  const initial = createOplogDoc(BASE)
  let driveAm = from<OplogDocument>({ ...initial } as OplogDocument)
  let driveV2: OplogDocument = structuredClone(initial)

  const devices: Device[] = Array.from({ length: deviceCount }, (_, i) => ({
    id: `d${i}`,
    seq: 0,
    // Todos parten del mismo doc de Drive, como un equipo que se une a la sync.
    am: clone(driveAm),
    v2: structuredClone(driveV2),
  }))

  const pull = (d: Device) => {
    const localIdsAm = new Set(toJS(d.am).ops.map((o) => o.id))
    const mergedAm = merge(clone(d.am), driveAm)
    const newAm = toJS(mergedAm).ops.filter((o) => !localIdsAm.has(o.id))
    d.am = mergedAm

    const { merged, newOps } = mergeOplogDocs(d.v2, driveV2)
    d.v2 = merged

    // Lo que el replay aplicaría a la DB tras este pull.
    expect(sortedIds(newOps), `seed ${seed}: ops nuevos tras pull de ${d.id}`).toEqual(sortedIds(newAm))
  }

  const push = (d: Device) => {
    driveAm = clone(d.am)
    driveV2 = structuredClone(d.v2)
  }

  for (let step = 0; step < STEPS; step++) {
    const d = r.pick(devices)
    const action = r.next()
    const ops = d.v2.ops

    if (action < 0.35) {
      const op = newOp(d, r)
      d.am = change(d.am, (doc) => {
        doc.ops.push(structuredClone(op))
      })
      d.v2.ops.push(structuredClone(op))
    } else if (action < 0.6 && ops.length > 0) {
      const id = r.pick(ops).id
      const field = r.pick([...FILL_FIELDS, 'data.thumbnail', 'data.fallback'] as Fill['field'][])
      // Realista: el valor depende solo del op y el campo (checksum del mismo archivo).
      const value = conflictingFills ? `${field}-${d.id}-${r.int(1000)}` : `${field}-of-${id}`
      d.am = change(d.am, (doc) => {
        const target = doc.ops.find((o) => o.id === id)
        if (target) applyFill(target as OplogEvent, { field, value })
      })
      const target = d.v2.ops.find((o) => o.id === id)
      if (target) applyFill(target, { field, value })
    } else if (action < 0.68 && ops.length > 0) {
      // Poda: como prune-deleted-media, borra todos los ops de una entidad.
      const entityId = r.pick(ops).entityId
      d.am = change(d.am, (doc) => {
        for (let i = doc.ops.length - 1; i >= 0; i--) {
          if (doc.ops[i].entityId === entityId) doc.ops.splice(i, 1)
        }
      })
      const prunedAt = 5000 + step
      d.v2.ops = d.v2.ops.filter((o) => {
        if (o.entityId !== entityId) return true
        d.v2.tombstones[o.id] = prunedAt
        return false
      })
    } else if (action < 0.85) {
      pull(d)
    } else {
      // syncCycle: pull + push (el 412 de Drive fuerza siempre pull antes de push).
      pull(d)
      push(d)
    }
  }

  // Cierre: todos sincronizan dos vueltas, hasta converger.
  for (let round = 0; round < 2; round++) {
    for (const d of devices) {
      pull(d)
      push(d)
    }
  }

  return { devices, driveAm, driveV2 }
}

describe('merge propio vs Automerge (prueba diferencial)', () => {
  it(`da exactamente el mismo resultado con rellenos realistas (${RUNS} historias)`, () => {
    for (let seed = FIRST_SEED; seed < FIRST_SEED + RUNS; seed++) {
      const { devices, driveAm, driveV2 } = runScenario(seed, false)

      expect(canonical(driveV2, false), `seed ${seed}: archivo de Drive`).toEqual(
        canonical(toJS(driveAm) as OplogDocument, false),
      )
      for (const d of devices) {
        expect(canonical(d.v2, false), `seed ${seed}: dispositivo ${d.id}`).toEqual(
          canonical(toJS(d.am) as OplogDocument, false),
        )
      }
    }
  }, TIMEOUT_MS)

  it(`converge en todos los dispositivos con rellenos conflictivos (${RUNS} historias)`, () => {
    let fieldDisagreements = 0
    for (let seed = FIRST_SEED; seed < FIRST_SEED + RUNS; seed++) {
      const { devices, driveAm, driveV2 } = runScenario(seed, true)
      const hash = oplogContentHash(driveV2)
      for (const d of devices) {
        // Cada sistema converge consigo mismo: todos los equipos acaban iguales.
        expect(oplogContentHash(d.v2), `seed ${seed}: v2 en ${d.id}`).toBe(hash)
        expect(toJS(d.am), `seed ${seed}: Automerge en ${d.id}`).toEqual(toJS(driveAm))
      }
      // Mismo conjunto de ops en los dos sistemas; solo puede cambiar qué valor ganó.
      const am = toJS(driveAm) as OplogDocument
      expect(sortedIds(driveV2.ops), `seed ${seed}: ops`).toEqual(sortedIds(am.ops))
      if (JSON.stringify(canonical(driveV2, false)) !== JSON.stringify(canonical(am, false))) {
        fieldDisagreements++
      }
    }
    // Informativo: cuántas historias eligieron otro ganador en un conflicto de campo.
    console.info(`[diferencial] historias con distinto ganador en conflicto de campo: ${fieldDisagreements}/${RUNS}`)
  }, TIMEOUT_MS)
})
