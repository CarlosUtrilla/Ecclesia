import http from 'http'
import express from 'express'
import cors from 'cors'
import os from 'os'
import { Server as SocketIOServer } from 'socket.io'
import {
  registerMediaServerRoutes,
  MEDIA_SERVER_PORT
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
import { log } from './utils/logger'
import { setSocketIO } from './sockets/socket.service'
import { registerSocketHandlers } from './sockets/socket-handlers'

const sseClients = new Set<express.Response>()
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

export function broadcastToRemoteClients(event: string, data: unknown): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of sseClients) {
    client.write(message)
  }
}

export async function initializeHttpServer(config?: DatabaseConfig, serverPort?: number) {
  const app = express()
  const port = serverPort ?? MEDIA_SERVER_PORT

  const resolvedConfig: DatabaseConfig = config ?? getDefaultDatabaseConfig()

  if (resolvedConfig.userDataPath) {
    setUserDataPath(resolvedConfig.userDataPath)
  }

  await initializeDatabase(resolvedConfig)
  await initializeBibleData()
  app.use(express.json())

  // Serializar BigInt en respuestas JSON
  const bigIntReplacer = (_key: string, value: unknown): unknown => {
    if (typeof value !== 'bigint') return value
    const asNumber = Number(value)
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString()
  }
  app.use((_req, res, next) => {
    const originalJson = res.json.bind(res)
    res.json = (body: unknown) => {
      return originalJson(JSON.parse(JSON.stringify(body, bigIntReplacer)))
    }
    next()
  })

  app.use(
    cors({
      origin: true,
      credentials: false
    })
  )

  // Crear servidor HTTP con Socket.IO
  const server = http.createServer(app)
  const io = new SocketIOServer(server, {
    cors: { origin: true, credentials: false }
  })
  setSocketIO(io)
  const socket = registerSocketHandlers()

  io.on('connection', (socket) => {
    log.info(`[Socket.IO] Cliente conectado: ${socket.id}`)
    socket.on('disconnect', () => {
      log.info(`[Socket.IO] Cliente desconectado: ${socket.id}`)
    })
  })

  server.listen(port, () => {
    log.info(`Eclessia server running on port ${port} (Socket.IO disponible)`)
  })

  registerRoutes(app, (keys) => {
    socket.emit.queryKeysInvalidate({ keys })
  })
  registerMediaServerRoutes(app)

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
      res.status(500).json({ error: 'Failed to retrieve routes', errMsg: err })
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

  // SSE endpoint para broadcasting de eventos a todos los renderers conectados (host + remotos)
  app.get('/api/remote/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'ok' })}\n\n`)

    sseClients.add(res)

    req.on('close', () => {
      sseClients.delete(res)
      if (sseClients.size === 0 && heartbeatTimer) {
        clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
    })

    if (sseClients.size === 1) {
      heartbeatTimer = setInterval(() => {
        for (const client of sseClients) {
          client.write(': keepalive\n\n')
        }
      }, 30000)
    }
  })

  app.use((err: Error, _req: express.Request, res: express.Response) => {
    log.error('[Express] Error no capturado:', err.message, err.stack)
    const message = err?.message ?? err?.toString() ?? 'Error interno del servidor'
    res.status(500).json({ error: message })
  })

  // Start sync scheduler
  const { startSyncScheduler } = await import('./controllers/sync/sync-scheduler.service')
  startSyncScheduler()

  // Initialize UDP discovery
  const { initializeUdpDiscovery } = await import('./services/udp-discovery.service')
  initializeUdpDiscovery()
}

export type { RoutesTypes } from './routeTypes'
export type { SocketEventMap } from './sockets/socket.service'
export type { DatabaseConfig } from './prisma-init'
export * from '@prisma/client'
