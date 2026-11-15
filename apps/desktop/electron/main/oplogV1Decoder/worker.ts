/**
 * Proceso hijo (`utilityProcess`) que decodifica un oplog v1 de Automerge.
 *
 * Recibe el binario, responde con el doc en JSON y el padre lo termina. Toda la
 * memoria WASM de Automerge vive y muere aquí; ver `./index.ts`.
 */
import { decodeLegacyOplogInProcess } from '@ecclesia/api/src/controllers/sync-oplog/oplog-doc'

process.parentPort.once('message', async (event) => {
  try {
    const doc = await decodeLegacyOplogInProcess(event.data as Uint8Array)
    process.parentPort.postMessage({ ok: true, json: JSON.stringify(doc) })
  } catch (error) {
    process.parentPort.postMessage({ ok: false, error: (error as Error)?.message ?? String(error) })
  }
})
