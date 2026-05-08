import fs from 'fs'
import path from 'path'
import { app } from 'electron'

function parseEnv(content: string): Record<string, string> {
  const entries: Record<string, string> = {}
  const lines = content.split(/\r?\n/)

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const valueRaw = line.slice(separatorIndex + 1).trim()

    const value =
      (valueRaw.startsWith('"') && valueRaw.endsWith('"')) ||
      (valueRaw.startsWith("'") && valueRaw.endsWith("'"))
        ? valueRaw.slice(1, -1)
        : valueRaw

    if (key) {
      entries[key] = value
    }
  }

  return entries
}

export function loadAppEnv() {
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.join(app.getPath('userData'), '.env')
  ]

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) {
      continue
    }

    const content = fs.readFileSync(envPath, 'utf-8')
    const parsed = parseEnv(content)

    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  }
}
