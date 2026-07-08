import fs from 'fs'
import path from 'path'
import os from 'os'

let logFilePath: string | null = null

function getLogFilePath(): string {
  if (logFilePath) return logFilePath
  const tmpDir = os.tmpdir()
  logFilePath = path.join(tmpDir, 'ecclesia-oplog-sync.log')
  return logFilePath
}

export function oplogLog(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const timestamp = new Date().toISOString()
  const dataStr = data !== undefined ? ` | ${JSON.stringify(data, null, 2)}` : ''
  const line = `[${timestamp}] [${level.toUpperCase()}] [oplog-sync] ${message}${dataStr}\n`

  // Always write to file (terser can't strip this)
  try {
    fs.appendFileSync(getLogFilePath(), line)
  } catch {
    // Ignore file errors
  }

  // Also write to stderr (visible in production logs)
  try {
    process.stderr.write(line)
  } catch {
    // Ignore
  }
}

export function oplogLogInfo(message: string, data?: unknown): void {
  oplogLog('info', message, data)
}

export function oplogLogWarn(message: string, data?: unknown): void {
  oplogLog('warn', message, data)
}

export function oplogLogError(message: string, data?: unknown): void {
  oplogLog('error', message, data)
}
