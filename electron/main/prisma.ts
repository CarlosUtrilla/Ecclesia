import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs-extra'
import { app } from 'electron'

let prisma: PrismaClient | null = null

async function initPrisma() {
  try {
    const userDataPath = app.getPath('userData')
    const destDbPath = path.join(userDataPath, 'dev.db')
    const srcDbPath = path.resolve(__dirname, '../../prisma/dev.db')

    // Copiar base si no existe
    const exists = await fs.pathExists(destDbPath)
    if (!exists || !app.isPackaged) {
      await fs.copy(srcDbPath, destDbPath)
      console.log('Base de datos copiada a userData')
    }

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${destDbPath}`
        }
      }
    })

    await prisma.$connect()
    console.log('Prisma conectado a la base de datos')
    return prisma
  } catch (error) {
    console.error('Error al inicializar Prisma:', error)
  }
}

function getPrisma() {
  if (!prisma) {
    throw new Error('Prisma no ha sido inicializado. Llama primero a initPrisma()')
  }
  return prisma
}

export { initPrisma, getPrisma }
