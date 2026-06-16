import log from 'electron-log'
import { getSocket } from '../../sockets/socket.service'

class SyncProgressService {
  private lastProgress = 0
  private lastMessage = ''

  update(progress: number, message: string): void {
    this.lastProgress = progress
    this.lastMessage = message
    log.warn(`[sync] ${message}`)
    getSocket().emit.syncProgress({ progress, message })
  }

  setMessage(message: string): void {
    this.update(this.lastProgress, message)
  }

  error(message: string): void {
    log.error(`[sync] ERROR: ${message}`)
    getSocket().emit.syncProgress({ progress: -1, message, error: true })
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
