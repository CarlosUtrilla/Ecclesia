import { initializeHttpServer } from './index'
import { setUserDataPath, setDownloadsPath } from './config'
import path from 'path'
import os from 'os'

const USER_DATA_ENV = 'ECCLESIA_USER_DATA'
const DOWNLOADS_ENV = 'ECCLESIA_DOWNLOADS'
const PORT_ENV = 'ECCLESIA_PORT'

const userDataPath = process.env[USER_DATA_ENV] ?? path.join(os.homedir(), '.ecclesia')
const downloadsPath = process.env[DOWNLOADS_ENV] ?? path.join(os.homedir(), 'Downloads')
const port = process.env[PORT_ENV] ? Number(process.env[PORT_ENV]) : undefined

setUserDataPath(userDataPath)
setDownloadsPath(downloadsPath)

const isDev = process.env.NODE_ENV !== 'production'

initializeHttpServer(
  {
    isDev,
    userDataPath,
    cwd: process.cwd()
  },
  port
)

console.info(`[ecclesia-api] Servidor iniciado en puerto ${port ?? 7777}`)
console.info(`[ecclesia-api] Datos de usuario: ${userDataPath}`)
