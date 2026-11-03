import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

let logPath: string | null = null

/** Al superar este tamaño el log actual pasa a `.old` (se pisa el anterior) y se empieza otro. */
export const MAX_CRASH_LOG_BYTES = 5 * 1024 * 1024

// Si la terminal que lanzó la app se cierra, escribir en stdout/stderr da EIO/EPIPE. Sin
// listener de `error` eso es una excepción no capturada, cuyo handler volvía a escribir en
// stderr: bucle de ~15.000 entradas por segundo que llegó a dejar el log en 53 GB.
let stdioBroken = false
let isWriting = false

function markStdioBroken() {
  stdioBroken = true
}
process.stdout?.on?.('error', markStdioBroken)
process.stderr?.on?.('error', markStdioBroken)

function isBrokenStdioError(error: unknown): boolean {
  const err = error as NodeJS.ErrnoException | null
  return (err?.code === 'EIO' || err?.code === 'EPIPE') && err?.syscall === 'write'
}

function getFallbackPath(): string {
  const candidates = [os.tmpdir(), os.homedir()]
  if (typeof process.env['APPDATA'] === 'string') {
    candidates.push(process.env['APPDATA'])
  }
  if (typeof process.env['USERPROFILE'] === 'string') {
    candidates.push(process.env['USERPROFILE'])
  }
  for (const dir of candidates) {
    try {
      const testPath = path.join(dir, 'ecclesia-crash.log')
      fs.appendFileSync(testPath, '')
      return testPath
    } catch {
      continue
    }
  }
  return path.join(os.tmpdir(), 'ecclesia-crash.log')
}

function rotateIfNeeded(file: string) {
  try {
    if (fs.statSync(file).size < MAX_CRASH_LOG_BYTES) return
    fs.renameSync(file, `${file}.old`)
  } catch {
    // el fichero aún no existe o no se puede rotar: se sigue escribiendo
  }
}

/** Añade una línea con fecha al log de crashes, con rotación por tamaño. */
export function appendCrashLog(msg: string) {
  // Reentrada: un fallo al escribir no debe volver a entrar aquí desde el handler global.
  if (isWriting) return
  isWriting = true
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try {
    const file = logPath ?? getFallbackPath()
    rotateIfNeeded(file)
    fs.appendFileSync(file, line)
  } catch {
    // sin log en disco no hay más dónde escribir
  }
  if (!stdioBroken) {
    try {
      process.stderr.write(line)
    } catch {
      markStdioBroken()
    }
  }
  isWriting = false
}

process.on('uncaughtException', (error, origin) => {
  // La terminal cerrada no es un fallo de la app: se deja de escribir en ella y se sigue.
  if (isBrokenStdioError(error)) {
    markStdioBroken()
    return
  }
  const msg =
    typeof error === 'object' && error
      ? (error.stack || error.message || String(error))
      : String(error)
  appendCrashLog(`UNCAUGHT EXCEPTION (${origin}):\n${msg}`)
  process.exit(1)
})

process.on('unhandledRejection', (reason: unknown) => {
  if (isBrokenStdioError(reason)) {
    markStdioBroken()
    return
  }
  const err = reason as { stack?: string; message?: string } | null
  const msg = err?.stack || err?.message || String(reason)
  appendCrashLog(`UNHANDLED REJECTION:\n${msg}`)
})

export function setCrashLogPath(p: string) {
  logPath = p
}
