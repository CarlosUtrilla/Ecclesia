import http from 'http'
import express from 'express'
import cors from 'cors'
import os from 'os'
import { Server as SocketIOServer } from 'socket.io'
import {
  registerMediaServerRoutes,
  MEDIA_SERVER_PORT,
  LazyFetchHandler
} from './controllers/media/mediaServer.controller'
import { registerRoutes } from './utils/routerUtilis'
import {
  DatabaseConfig,
  initializeDatabase,
  getDefaultDatabaseConfig,
  initializeBibleData
} from './prisma-init'
import { setUserDataPath } from './config'
import { routes } from './routes'
import Logger from 'electron-log'
import { setSocketIO, getSocket } from './sockets/socket.service'
import { registerSocketHandlers } from './sockets/socket-handlers'

export async function initializeHttpServer(
  config?: DatabaseConfig,
  serverPort?: number,
  onLazyFetch?: LazyFetchHandler
) {
  const app = express()
  const port = serverPort ?? MEDIA_SERVER_PORT

  const resolvedConfig: DatabaseConfig = config ?? getDefaultDatabaseConfig()

  if (resolvedConfig.userDataPath) {
    setUserDataPath(resolvedConfig.userDataPath)
  }

  await initializeDatabase(resolvedConfig)
  await initializeBibleData()
  app.use(express.json())

  app.use(
    cors({
      origin: true,
      credentials: false
    })
  )
  registerRoutes(app, (keys) => {
    Logger.info(`[DEBUG] onQueryKeys called with keys:`, JSON.stringify(keys))
    try {
      const socket = getSocket()
      Logger.info(`[DEBUG] Socket instance exists:`, !!socket, `io exists:`, !!(socket as any)?.io?.sockets)
      socket.emit.queryKeysInvalidate({ keys })
      Logger.info(`[DEBUG] queryKeysInvalidate emitted successfully`)
    } catch (err: any) {
      Logger.error(`[DEBUG] Failed to emit queryKeysInvalidate:`, err?.message)
    }
  })
  registerMediaServerRoutes(app, { lazyFetch: onLazyFetch })

  app.post('/api/getRoutes', (req, res) => {
    try {
      const result = Object.entries(routes)
      const routesMap = result.map(([namespace, ControllerClass]) => {
        const proto = ControllerClass.prototype as any

        const methods = Object.getOwnPropertyNames(proto).filter(
          (x) => x !== 'constructor' && typeof proto[x] === 'function'
        )

        return [namespace, methods]
      })
      return res.json({ response: routesMap })
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to retrieve routes', errMsg: err })
    }
  })

  // Endpoint para descubrimiento LAN de otras instancias
  const APP_VERSION = '1.0.0'
  app.get('/api/remote/info', (_req, res) => {
    res.json({
      name: os.hostname(),
      version: APP_VERSION,
      port: port
    })
  })

  // UDP discovery endpoint
  app.get('/api/remote/discover-lan', async (_req, res) => {
    try {
      const { discoverLanDevices } = await import('./services/udp-discovery.service')
      const devices = await discoverLanDevices()
      res.json({ response: devices })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    Logger.error('[Express] Error no capturado:', err.message, err.stack)
    const message = err?.message ?? err?.toString() ?? 'Error interno del servidor'
    res.status(500).json({ error: message })
  })

  // Crear servidor HTTP con Socket.IO
  const server = http.createServer(app)
  const io = new SocketIOServer(server, {
    cors: { origin: true, credentials: false }
  })
  setSocketIO(io)
  registerSocketHandlers()

  io.on('connection', (socket) => {
    Logger.info(`[Socket.IO] Cliente conectado: ${socket.id}`)
    socket.on('disconnect', () => {
      Logger.info(`[Socket.IO] Cliente desconectado: ${socket.id}`)
    })

    // Relay live control commands to all other clients (remote → renderer or vice versa)
    const liveRelayEvents = [
      'liveSendToItem',
      'liveClearItem',
      'liveNextSlide',
      'livePrevSlide',
      'liveGoToSlide',
      'liveSetHideText',
      'liveSetShowLogo',
      'liveSetBlackScreen',
      'liveStateUpdate',
      'scheduleStateUpdate',
      'requestScheduleState'
    ] as const
    for (const event of liveRelayEvents) {
      socket.on(event, (data: unknown) => {
        socket.broadcast.emit(event, data)
      })
    }
  })

  server.listen(port, () => {
    Logger.info(`Eclessia server running on port ${port} (Socket.IO disponible)`)
  })

  // Start oplog sync scheduler (replaces legacy snapshot-based sync scheduler)
  const { startOplogScheduler } = await import('./services/oplog-scheduler.service')
  startOplogScheduler()

  // Initialize UDP discovery
  const { initializeUdpDiscovery } = await import('./services/udp-discovery.service')
  initializeUdpDiscovery()
}

export type { RoutesTypes } from './routeTypes'
export type { SocketEventMap } from './sockets/socket.service'
export { getSocket } from './sockets/socket.service'
export * from '@prisma/client'
