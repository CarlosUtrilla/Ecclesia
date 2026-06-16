import { Server as SocketIOServer } from 'socket.io'
import log from 'electron-log'

let io: SocketIOServer | null = null

export function setSocketIOInstance(instance: SocketIOServer): void {
  io = instance
}

class SyncProgressService {
  private lastProgress = 0
  private lastMessage = ''

  update(progress: number, message: string): void {
    this.lastProgress = progress
    this.lastMessage = message
    log.warn(`[sync] ${message}`)
    io?.emit('sync-progress', { progress, message })
  }

  setMessage(message: string): void {
    this.update(this.lastProgress, message)
  }

  error(message: string): void {
    log.error(`[sync] ERROR: ${message}`)
    io?.emit('sync-progress', { progress: -1, message, error: true })
  }

  getLastProgress(): number {
    return this.lastProgress
  }

  getLastMessage(): string {
    return this.lastMessage
  }

  reset(): void {
    this.lastProgress = 0
    this.lastMessage = ''
  }
}

export const syncProgressService = new SyncProgressService()
