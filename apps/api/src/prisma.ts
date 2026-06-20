import { PrismaClient } from '@prisma/client'
import { AsyncLocalStorage } from 'async_hooks'
import path from 'path'
import { getResourcesPath } from './config'

let prisma: PrismaClient | null = null
export const outboxContext = new AsyncLocalStorage<{ skipOutbox: boolean }>()

let getBiblesResourcesPathImpl: () => string = () =>
  path.join(getResourcesPath(), 'bibles')

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

export function isPrismaInitialized(): boolean {
  return prisma !== null
}

export async function runWithoutSyncOutboxTracking<T>(fn: () => Promise<T>): Promise<T> {
  return await outboxContext.run({ skipOutbox: true }, fn)
}
