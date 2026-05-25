const fs = require('node:fs')
const p = require('node:path')
const os = require('node:os')

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
      const testPath = p.join(dir, 'ecclesia-crash.log')
      fs.appendFileSync(testPath, '')
      return testPath
    } catch {
      continue
    }
  }
  return p.join(os.tmpdir(), 'ecclesia-crash.log')
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
  try {
    const { dialog } = require('electron')
    dialog.showErrorBox('Error crítico en Ecclesia', msg)
  } catch {
    // dialog not available
  }
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  const msg =
    typeof reason === 'object' && reason
      ? (reason.stack || reason.message || String(reason))
      : String(reason)
  writeLog(`UNHANDLED REJECTION:\n${msg}`)
})

export function setCrashLogPath(path: string) {
  logPath = path
}
