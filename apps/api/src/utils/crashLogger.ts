import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

let logPath: string | null = null

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

function writeLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try {
    if (logPath) {
      fs.appendFileSync(logPath, line)
    } else {
      const fallbackPath = getFallbackPath()
      fs.appendFileSync(fallbackPath, line)
    }
  } catch {
    try {
      process.stderr.write(line)
    } catch {
      // no fallback
    }
  }
  try {
    process.stderr.write(line)
  } catch {
    // no fallback
  }
}

process.on('uncaughtException', (error, origin) => {
  const msg =
    typeof error === 'object' && error
      ? (error.stack || error.message || String(error))
      : String(error)
  writeLog(`UNCAUGHT EXCEPTION (${origin}):\n${msg}`)
  process.exit(1)
})

process.on('unhandledRejection', (reason: unknown) => {
  const err = reason as { stack?: string; message?: string } | null
  const msg = err?.stack || err?.message || String(reason)
  writeLog(`UNHANDLED REJECTION:\n${msg}`)
})

export function setCrashLogPath(p: string) {
  logPath = p
}
