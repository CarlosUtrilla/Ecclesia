import { getSocket, getIO } from './socket.service'
import { log } from '../utils/logger'

async function getSyncController() {
  const SyncController = (await import('../controllers/sync/sync.controller')).default
  return new SyncController()
}

export function registerSocketHandlers(): void {
  const io = getIO()
  if (!io) throw new Error('SocketIO no inicializado')

  // bibleSearch: relay solo al socket que emitió (no broadcast)
  io.on('connection', (socket) => {
    socket.on('bibleSearch', (data) => {
      log.info(
        `[Socket] bibleSearch relay: ${data.version} ${data.bookId}:${data.chapter}:${data.verse}`
      )
      socket.emit('bibleSearch', data)
    })

    // liveMediaState: broadcast a todos los clientes conectados
    socket.on('liveMediaState', (data) => {
      log.info(`[Socket] liveMediaState broadcast: ${data.action} @ ${data.time}`)
      io.emit('liveMediaState', data)
    })
  })

  const socket = getSocket()

  socket.on.startSync(async ({ reason }) => {
    const controller = await getSyncController()
    await controller.push({ body: { reason } } as any)
  })

  socket.on.ping(() => {
    log.info('[Socket] ping recibido del frontend')
  })

  socket.on.requestResync(async () => {
    const controller = await getSyncController()
    await controller.pull({ body: { reason: 'resync' } } as any)
  })
}
