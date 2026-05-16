import { app } from 'electron'
import { fork, ChildProcess } from 'child_process'
import path from 'path'
import http from 'http'

const SERVER_PORT = 7777
const HEALTH_CHECK_TIMEOUT = 30_000
const HEALTH_CHECK_INTERVAL = 500

let serverProcess: ChildProcess | null = null

function getServerEntry(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'api', 'server.js')
  }
  return path.join(__dirname, '..', '..', '..', '..', 'apps', 'api', 'src', 'server.ts')
}

function getTsxPath(): string {
  return path.join(__dirname, '..', '..', 'node_modules', '.bin', 'tsx')
}

function isServerReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${SERVER_PORT}/api/getRoutes`, (res) => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

export async function startApiServer(): Promise<void> {
  const entry = getServerEntry()
  const userDataPath = app.getPath('userData')
  const downloadsPath = app.getPath('downloads')

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    ECCLESIA_USER_DATA: userDataPath,
    ECCLESIA_DOWNLOADS: downloadsPath,
    ECCLESIA_PORT: String(SERVER_PORT),
    NODE_ENV: app.isPackaged ? 'production' : 'development'
  }

  if (app.isPackaged) {
    serverProcess = fork(entry, [], { env, stdio: 'pipe' })
  } else {
    const tsxPath = getTsxPath()
    serverProcess = fork(tsxPath, [entry], { env, stdio: 'pipe' })
  }

  serverProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[api-server] ${data.toString().trim()}`)
  })

  serverProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[api-server] ${data.toString().trim()}`)
  })

  serverProcess.on('exit', (code) => {
    console.error(`[api-server] Proceso terminado con código ${code}`)
    serverProcess = null
  })

  const startTime = Date.now()
  while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT) {
    if (await isServerReady()) {
      console.log(`[api-server] Listo en puerto ${SERVER_PORT}`)
      return
    }
    await new Promise((r) => setTimeout(r, HEALTH_CHECK_INTERVAL))
  }

  throw new Error(`API server no respondió en ${HEALTH_CHECK_TIMEOUT}ms`)
}

export function stopApiServer(): void {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM')
    serverProcess = null
  }
}
