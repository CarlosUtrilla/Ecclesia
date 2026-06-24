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
import { setSocketIO, getSocket } from './sockets/socket.service'
import { registerSocketHandlers } from './sockets/socket-handlers'
import { driveClientService } from './controllers/sync/sync-drive-client.service'
import { getTokenFilePath } from './controllers/sync/sync.config'
import { writeJson } from './controllers/sync/sync.utils'

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

  // OAuth redirect handler para Google Drive loopback flow.
  // El frontend abre el authUrl con redirect_uri=http://127.0.0.1:PORT/oauth-redirect;
  // Google redirige aquí, el sidecar canjea el code y notifica a la UI por Socket.IO.
  app.get('/oauth-redirect', async (req, res) => {
    const code = req.query.code as string | undefined
    const error = req.query.error as string | undefined

    const sendHtml = (title: string, message: string, isError = false) => {
      const color = isError ? '#dc2626' : '#16a34a'
      res.send(`<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center;padding:40px 20px;">
    <h1 style="color:${color};margin-bottom:12px;">${title}</h1>
    <p style="margin-bottom:8px;max-width:480px;margin-left:auto;margin-right:auto;">${message}</p>
    <p style="color:#6b7280;font-size:14px;">Podés cerrar esta pestaña.</p>
  </body>
</html>`)
    }

    if (error) {
      getSocket().emit.oauthComplete({ success: false, error })
      return sendHtml('Error de autorización', `Google respondió: ${error}`, true)
    }

    if (!code) {
      getSocket().emit.oauthComplete({ success: false, error: 'No se recibió el código de autorización' })
      return sendHtml('Error de autorización', 'No se recibió el código de autorización.', true)
    }

    try {
      const tokens = await driveClientService.exchangeAuthCode(code)
      await writeJson(getTokenFilePath(), tokens)
      const email = tokens.email as string | undefined
      getSocket().emit.oauthComplete({ success: true, email })
      return sendHtml('Autenticación completada', `Ecclesia se conectó con ${email || 'Google Drive'}.`)
    } catch (err: any) {
      const message = err?.message || 'Error al canjear el código de autorización'
      log.error('[OAuth] Error intercambiando code por tokens:', message)
      getSocket().emit.oauthComplete({ success: false, error: message })
      return sendHtml('Error de autorización', message, true)
    }
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

  app.use((err: Error, _req: express.Request, res: express.Response) => {
    log.error('[Express] Error no capturado:', err.message, err.stack)
    const message = err?.message ?? err?.toString() ?? 'Error interno del servidor'
    res.status(500).json({ error: message })
  })

  const { startSyncScheduler } = await import('./controllers/sync/sync-scheduler.service')
  startSyncScheduler()

  const { initializeUdpDiscovery } = await import('./services/udp-discovery.service')
  initializeUdpDiscovery()
}

export type { RoutesTypes } from './routeTypes'
export type { SocketEventMap } from './sockets/socket.service'
export type { DatabaseConfig } from './prisma-init'
export * from '@prisma/client'
