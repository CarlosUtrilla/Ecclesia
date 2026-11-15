// v2 (JSON gzip). El v1 de Automerge se lee como respaldo mientras no exista el v2
// y nunca se escribe ni se borra: así una versión vieja de la app no pisa el v2 y
// la historia del v1 queda intacta en Drive.
export const REMOTE_OPLOG_FILE_NAME = 'ecclesia-oplog-v2.json.gz'
export const LEGACY_REMOTE_OPLOG_FILE_NAME = 'ecclesia-oplog.bin'

export function getRemoteBlobFileName(checksum: string): string {
  return `ecclesia-blob-${checksum}.bin`
}
