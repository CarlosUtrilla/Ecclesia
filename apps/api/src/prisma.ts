import { PrismaClient } from '@prisma/client'
import { AsyncLocalStorage } from 'async_hooks'
import path from 'path'

let prisma: PrismaClient | null = null
export const oplogContext = new AsyncLocalStorage<{ skipOplog: boolean }>()

let getBiblesResourcesPathImpl: () => string = () =>
  path.join(process.cwd(), 'bibles')

export function setGetBiblesResourcesPath(fn: () => string): void {
  getBiblesResourcesPathImpl = fn
}

export function getBiblesResourcesPath(): string {
  return getBiblesResourcesPathImpl()
}

export function setPrismaClient(client: PrismaClient): void {
  prisma = client
}

export function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error('PrismaClient no ha sido inicializado. Llama a setPrismaClient() primero.')
  }
  return prisma
}

export async function runWithoutSyncOutboxTracking<T>(fn: () => Promise<T>): Promise<T> {
  return await fn()
}

export async function runWithoutOplogTracking<T>(fn: () => Promise<T>): Promise<T> {
  return await oplogContext.run({ skipOplog: true }, fn)
}
