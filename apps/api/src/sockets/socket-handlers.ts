import { getSocket } from './socket.service'

async function getSyncController() {
  const SyncController = (await import('../controllers/sync/sync.controller')).default
  return new SyncController()
}

export function registerSocketHandlers(): void {
  const socket = getSocket()

  socket.on.startSync(async ({ reason }) => {
    const controller = await getSyncController()
    await controller.push({ body: { reason } } as any)
  })

  socket.on.ping(() => {
    const log = require('electron-log')
    log.info('[Socket] ping recibido del frontend')
  })

  socket.on.requestResync(async () => {
    const controller = await getSyncController()
    await controller.pull({ body: { reason: 'resync' } } as any)
  })
}
