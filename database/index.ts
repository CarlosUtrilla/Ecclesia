import { routes } from './routes'
import express from 'express'
import log from 'electron-log'
import { initPrisma } from '../electron/main/prisma'
import {
  registerMediaServerRoutes,
  MEDIA_SERVER_PORT
} from './controllers/media/mediaServer.controller'

export function registerRoutes(app: ReturnType<typeof express>) {
  // REGISTRO DE RUTAS EXPRESS DESDE CONTROLLERS
  for (const [namespace, ControllerClass] of Object.entries(routes)) {
    const proto = ControllerClass.prototype
    const methodNames = Object.getOwnPropertyNames(proto).filter(
      (prop) => prop !== 'constructor' && typeof proto[prop] === 'function'
    )

    const instance = new ControllerClass()
    log.info(`Registering API routes for namespace: ${namespace}`)
    for (const method of methodNames) {
      const channel = `${namespace}/${method}`
      app.post(`/api/${channel}`, async (req, res) => {
        const handler = instance[method].bind(instance)
        try {
          const result = await handler(req.body)
          res.json(result)
        } catch (err: any) {
          const rawMessage = err?.message || 'Unknown error'
          const cleanedMessage = rawMessage.replace(/^Error invoking remote method '.*?':\s*/, '')
          console.error(`Error en endpoint /api/${channel}:`, cleanedMessage, rawMessage, err)
          res.status(500).json({ error: cleanedMessage })
        }
      })
    }
  }
}

export async function initializeHttpServer() {
  const app = express()
  const port = MEDIA_SERVER_PORT

  app.use(express.json())
  await initPrisma()
  registerRoutes(app)
  registerMediaServerRoutes(app)

  app.listen(port, () => {
    log.info(`Eclessia server running on port ${port}`)
  })
}
