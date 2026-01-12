import { registerMediaHandlers } from './mediaHandlers'
import { startMediaServer } from './mediaServer'

export function initializeMediaManager() {
  // Iniciar servidor de medios
  startMediaServer()
  // Registrar handlers de medios
  registerMediaHandlers()
}
