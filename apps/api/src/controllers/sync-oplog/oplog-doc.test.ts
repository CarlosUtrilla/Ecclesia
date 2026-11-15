import { describe, expect, it } from 'vitest'
import { from, save } from '@automerge/automerge'
import {
  createOplogDoc,
  deserializeOplogDoc,
  isLegacyAutomergeBinary,
  mergeOplogDocs,
  oplogContentHash,
  serializeOplogDoc,
} from './oplog-doc'
import type { OplogDocument, OplogEvent } from './oplog.types'

const op = (id: string, extra: Partial<OplogEvent> = {}): OplogEvent => ({
  id,
  seq: Number(id.replace(/\D/g, '')) || 1,
  deviceId: id.startsWith('a') ? 'dev-a' : 'dev-b',
  timestamp: 1000,
  entityType: 'media',
  entityId: `e-${id}`,
  op: 'upsert',
  data: { name: id },
  ...extra,
})

const doc = (ops: OplogEvent[], tombstones: Record<string, number> = {}): OplogDocument => ({
  ...createOplogDoc({ schemaVersion: 1, schemaHash: 'h', createdAt: 1, ops }),
  tombstones,
})

const ids = (d: OplogDocument) => d.ops.map((o) => o.id)

describe('mergeOplogDocs', () => {
  it('une los ops por id: locales primero, nuevos remotos al final', () => {
    const { merged, newOps } = mergeOplogDocs(doc([op('a1'), op('a2')]), doc([op('a1'), op('b1')]))
    expect(ids(merged)).toEqual(['a1', 'a2', 'b1'])
    expect(newOps.map((o) => o.id)).toEqual(['b1'])
  })

  it('no resucita ops podados en cualquiera de los dos lados', () => {
    const local = doc([op('a1')], { b1: 50 })
    const remote = doc([op('a1'), op('b1')])
    const { merged, newOps } = mergeOplogDocs(local, remote)
    expect(ids(merged)).toEqual(['a1'])
    expect(newOps).toEqual([])

    const back = mergeOplogDocs(remote, local).merged
    expect(ids(back)).toEqual(['a1'])
    expect(back.tombstones).toEqual({ b1: 50 })
  })

  it('rellena campos de blobs vacíos con los del otro lado', () => {
    const local = doc([op('a1', { data: { name: 'x' } })])
    const remote = doc([op('a1', { checksum: 'c1', thumbnailBlobPath: 't.png', data: { name: 'x', thumbnail: 't.png' } })])
    const [merged] = mergeOplogDocs(local, remote).merged.ops
    expect(merged.checksum).toBe('c1')
    expect(merged.thumbnailBlobPath).toBe('t.png')
    expect(merged.data).toEqual({ name: 'x', thumbnail: 't.png' })
  })

  it('un valor vacío nunca pisa uno existente', () => {
    const local = doc([op('a1', { checksum: 'c1' })])
    const remote = doc([op('a1', { checksum: undefined })])
    expect(mergeOplogDocs(local, remote).merged.ops[0].checksum).toBe('c1')
  })

  it('no muta las entradas', () => {
    const local = doc([op('a1')])
    const remote = doc([op('a1', { checksum: 'c1' }), op('b1')], { z: 1 })
    const snapshot = JSON.stringify([local, remote])
    mergeOplogDocs(local, remote)
    expect(JSON.stringify([local, remote])).toBe(snapshot)
  })

  it('converge: los dos dispositivos acaban con el mismo hash', () => {
    const a = doc([op('a1', { checksum: 'c1' }), op('a2')], { a9: 1 })
    const b = doc([op('a1'), op('b1', { blobPath: 'p' })], { b9: 2 })
    const ab = mergeOplogDocs(a, b).merged
    const ba = mergeOplogDocs(b, a).merged
    expect(oplogContentHash(ab)).toBe(oplogContentHash(ba))
    // Idempotente
    expect(oplogContentHash(mergeOplogDocs(ab, ba).merged)).toBe(oplogContentHash(ab))
  })
})

describe('oplogContentHash', () => {
  it('ignora el orden de los ops', () => {
    expect(oplogContentHash(doc([op('a1'), op('b1')]))).toBe(oplogContentHash(doc([op('b1'), op('a1')])))
  })

  it('cambia al rellenar un campo, añadir un op o podar', () => {
    const base = oplogContentHash(doc([op('a1')]))
    expect(oplogContentHash(doc([op('a1', { checksum: 'c' })]))).not.toBe(base)
    expect(oplogContentHash(doc([op('a1'), op('a2')]))).not.toBe(base)
    expect(oplogContentHash(doc([op('a1')], { x: 1 }))).not.toBe(base)
  })
})

describe('serialización', () => {
  it('v2: ida y vuelta sin pérdida', async () => {
    const original = doc([op('a1', { checksum: 'c' }), op('b1')], { z: 3 })
    const restored = await deserializeOplogDoc(await serializeOplogDoc(original))
    expect(restored).toEqual(original)
  })

  it('v1: lee un binario de Automerge conservando todos los ops y su orden', async () => {
    const ops = [op('a1', { checksum: 'c', data: { title: 'Canción', lyrics: 'línea 1\nlínea 2' } }), op('b1'), op('a2')]
    const legacy = save(from<OplogDocument>({ schemaVersion: 1, schemaHash: 'h', createdAt: 7, ops } as OplogDocument))
    expect(isLegacyAutomergeBinary(legacy)).toBe(true)

    const restored = await deserializeOplogDoc(legacy)
    expect(restored.ops).toEqual(ops)
    expect(restored.tombstones).toEqual({})
    expect(restored.createdAt).toBe(7)
  })

  it('rechaza datos que no son ningún formato conocido', async () => {
    await expect(deserializeOplogDoc(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow()
  })
})
