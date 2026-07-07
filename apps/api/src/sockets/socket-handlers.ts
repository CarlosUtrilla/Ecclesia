import { getSocket } from './socket.service'
import { oplogService } from '../controllers/sync-oplog/oplog.service'

export function registerSocketHandlers(): void {
  const socket = getSocket()

  socket.on.startSync(async ({ reason }) => {
    if (oplogService.isInitialized) {
      await oplogService.syncCycle()
    }
  })

  socket.on.ping(() => {
    const log = require('electron-log')
    log.info('[Socket] ping recibido del frontend')
  })

  socket.on.requestResync(async () => {
    if (oplogService.isInitialized) {
      await oplogService.syncCycle()
    }
  })
}
