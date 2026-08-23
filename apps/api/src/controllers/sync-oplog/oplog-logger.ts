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

// El log se acumula en memoria y se vuelca en bloque: antes cada línea hacía un
// appendFileSync (open/write/close bloqueante) y había llamadas en bucles por evento,
// por blob y por cada escritura de Prisma, lo que congelaba el proceso principal.
const FLUSH_INTERVAL_MS = 1000
const MAX_BUFFERED_LINES = 200
const MAX_DATA_CHARS = 2000

const buffer: string[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false

function scheduleFlush(): void {
  if (flushTimer || flushing) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushBuffer()
  }, FLUSH_INTERVAL_MS)
  // No mantener vivo el event loop solo por el log
  flushTimer.unref?.()
}

async function flushBuffer(): Promise<void> {
  if (flushing || buffer.length === 0) return
  flushing = true
  const chunk = buffer.join('')
  buffer.length = 0
  try {
    await fs.promises.appendFile(getLogFilePath(), chunk)
  } catch {
    // Ignore file errors
  } finally {
    flushing = false
    if (buffer.length > 0) scheduleFlush()
  }
}

/** Volcado síncrono para el cierre de la app (no perder las últimas líneas). */
export function flushOplogLogSync(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (buffer.length === 0) return
  const chunk = buffer.join('')
  buffer.length = 0
  try {
    fs.appendFileSync(getLogFilePath(), chunk)
  } catch {
    // Ignore file errors
  }
}

process.on('exit', flushOplogLogSync)

function formatData(data: unknown): string {
  if (data === undefined) return ''
  try {
    const json = JSON.stringify(data)
    if (json === undefined) return ''
    return ` | ${json.length > MAX_DATA_CHARS ? `${json.slice(0, MAX_DATA_CHARS)}…` : json}`
  } catch {
    return ' | [dato no serializable]'
  }
}

export function oplogLog(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] [${level.toUpperCase()}] [oplog-sync] ${message}${formatData(data)}\n`

  buffer.push(line)
  if (buffer.length >= MAX_BUFFERED_LINES) {
    void flushBuffer()
  } else {
    scheduleFlush()
  }

  // stderr solo para lo relevante: escribirlo en cada info también costaba syscalls
  // (y en Windows el pipe de Electron puede bloquear).
  if (level !== 'info') {
    try {
      process.stderr.write(line)
    } catch {
      // Ignore
    }
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
