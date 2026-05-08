import { app } from 'electron'
import path from 'path'
import log from 'electron-log'
import {
  initializeDatabase,
  getPrisma as getApiPrisma,
  setOnOutboxWriteCallback,
  setOnMediaChangeCallback
} from '@ecclesia/api/src/prisma-init'
import type { PrismaClient } from '@ecclesia/api'

let prisma: PrismaClient | null = null

async function initPrisma() {
  const isDev = !app.isPackaged

  const config = {
    isDev,
    userDataPath: app.getPath('userData'),
    resourcesPath: process.resourcesPath || path.join(app.getAppPath(), '..'),
    cwd: process.cwd()
  }

  log.info('[prisma] Inicializando con config:', { isDev, userDataPath: config.userDataPath })

  prisma = await initializeDatabase(config)
  return prisma
}

function getPrisma(): PrismaClient {
  if (!prisma) {
    const apiPrisma = getApiPrisma()
    if (apiPrisma) {
      prisma = apiPrisma
      return prisma
    }
    throw new Error('Prisma no ha sido inicializado. Llama primero a initPrisma()')
  }
  return prisma
}

export { initPrisma, getPrisma, setOnOutboxWriteCallback, setOnMediaChangeCallback }
