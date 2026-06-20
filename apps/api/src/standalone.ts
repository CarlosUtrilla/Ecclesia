import 'reflect-metadata'
import path from 'path'
import os from 'os'
import { initializeHttpServer, DatabaseConfig } from './index'
import { setUserDataPath, setResourcesPath } from './config'
import { loadAppEnv } from './utils/loadEnv'
import { log } from './utils/logger'

const args = process.argv.slice(2)

function getArg(prefix: string, defaultValue: string): string {
  const arg = args.find((a) => a.startsWith(`${prefix}=`))
  if (!arg) return defaultValue
  const value = arg.slice(prefix.length + 1)
  return value || defaultValue
}

const port = parseInt(getArg('--port', '7777'), 10)
const userDataPathArg = getArg('--user-data-path', '')
const resourcesPathArg = getArg('--resources-path', '')
const cwd = getArg('--cwd', process.cwd())

const resolvedUserDataPath = userDataPathArg || path.join(os.homedir(), '.ecclesia')

setUserDataPath(resolvedUserDataPath)
if (resourcesPathArg) {
  setResourcesPath(resourcesPathArg)
}
loadAppEnv(resolvedUserDataPath)

const config: DatabaseConfig = {
  isDev: !process.env.NODE_ENV || process.env.NODE_ENV === 'development',
  userDataPath: resolvedUserDataPath,
  resourcesPath: resourcesPathArg || undefined,
  cwd
}

log.info(`[Sidecar] Starting API server on port ${port}`)
log.info(`[Sidecar] User data path: ${resolvedUserDataPath}`)
if (config.resourcesPath) {
  log.info(`[Sidecar] Resources path: ${config.resourcesPath}`)
}

initializeHttpServer(config, port).catch((err: unknown) => {
  log.error('[Sidecar] Failed to start server:', err)
  process.exit(1)
})

process.on('SIGTERM', () => {
  log.info('[Sidecar] Received SIGTERM, shutting down...')
  process.exit(0)
})

process.on('SIGINT', () => {
  log.info('[Sidecar] Received SIGINT, shutting down...')
  process.exit(0)
})
