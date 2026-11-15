/**
 * Decodifica oplogs v1 (Automerge) en un proceso hijo de vida corta.
 *
 * Cargar el oplog real en Automerge deja ~1 GB de memoria WASM que no se libera
 * nunca. Haciéndolo en un `utilityProcess` que termina al responder, el proceso
 * main solo se queda con el JSON resultante (medido: 112 MB frente a ~700 MB).
 * La capa de API lo recibe por `setLegacyOplogDecoder()`.
 */
import { utilityProcess } from 'electron'
import { join } from 'path'
import type { OplogDocument } from '@ecclesia/api/src/controllers/sync-oplog/oplog.types'

// El oplog real tarda ~5,5 s; el margen cubre equipos lentos.
const DECODE_TIMEOUT_MS = 120_000

type DecoderReply = { ok: true; json: string } | { ok: false; error: string }

export function decodeLegacyOplogInUtilityProcess(data: Uint8Array): Promise<OplogDocument> {
  return new Promise((resolve, reject) => {
    const child = utilityProcess.fork(join(__dirname, 'oplogV1Decoder.js'), [], {
      serviceName: 'Ecclesia oplog v1 decoder'
    })
    let settled = false

    const finish = (error: Error | null, doc?: OplogDocument) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill()
      if (error) reject(error)
      else resolve(doc!)
    }

    const timer = setTimeout(
      () => finish(new Error('El decoder del oplog v1 no respondió a tiempo')),
      DECODE_TIMEOUT_MS
    )

    child.once('spawn', () => child.postMessage(data))
    child.once('message', (reply: DecoderReply) => {
      if (reply.ok) finish(null, JSON.parse(reply.json) as OplogDocument)
      else finish(new Error(`Decoder del oplog v1: ${reply.error}`))
    })
    child.once('exit', (code) => finish(new Error(`El decoder del oplog v1 terminó (código ${code})`)))
  })
}
