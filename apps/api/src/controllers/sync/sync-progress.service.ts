import { log } from '../../utils/logger'
import { getSocket } from '../../sockets/socket.service'

class SyncProgressService {
  private phaseFrom = 0
  private phaseTo = 100
  private lastPhaseProgress = 0
  private lastMessage = ''

  /**
   * Define el rango global para la fase actual.
   * Todos los update() posteriores mapean phaseProgress (0-100)
   * a este rango, eliminando regresiones en la barra de progreso.
   */
  setPhaseRange(from: number, to: number): void {
    this.phaseFrom = from
    this.phaseTo = to
    this.lastPhaseProgress = 0
  }

  update(phaseProgress: number, message: string): void {
    this.lastPhaseProgress = phaseProgress
    this.lastMessage = message
    const overall = Math.round(this.phaseFrom + (phaseProgress / 100) * (this.phaseTo - this.phaseFrom))
    log.warn(`[sync] ${message}`)
    getSocket().emit.syncProgress({ progress: overall, message })
  }

  setMessage(message: string): void {
    this.update(this.lastPhaseProgress, message)
  }

  error(message: string): void {
    log.error(`[sync] ERROR: ${message}`)
    getSocket().emit.syncProgress({ progress: -1, message, error: true })
  }

  getLastProgress(): number {
    return Math.round(this.phaseFrom + (this.lastPhaseProgress / 100) * (this.phaseTo - this.phaseFrom))
  }

  getLastMessage(): string {
    return this.lastMessage
  }

  reset(): void {
    this.phaseFrom = 0
    this.phaseTo = 100
    this.lastPhaseProgress = 0
    this.lastMessage = ''
  }
}

export const syncProgressService = new SyncProgressService()
