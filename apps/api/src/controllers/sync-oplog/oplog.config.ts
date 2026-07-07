export const REMOTE_OPLOG_FILE_NAME = 'ecclesia-oplog.bin'

export function getRemoteBlobFileName(checksum: string): string {
  return `ecclesia-blob-${checksum}.bin`
}
