import express from 'express'
import cors from 'cors'
import {
  registerMediaServerRoutes,
  MEDIA_SERVER_PORT
} from './controllers/media/mediaServer.controller'
import { registerRoutes } from './utils/routerUtilis'
import { DatabaseConfig, initializeDatabase, getDefaultDatabaseConfig } from './prisma-init'
import { setUserDataPath } from './config'
import { routes } from './routes'

export async function initializeHttpServer(config?: DatabaseConfig, serverPort?: number) {
  const app = express()
  const port = serverPort ?? MEDIA_SERVER_PORT

  const resolvedConfig: DatabaseConfig = config ?? getDefaultDatabaseConfig()

  if (resolvedConfig.userDataPath) {
    setUserDataPath(resolvedConfig.userDataPath)
  }

  await initializeDatabase(resolvedConfig)
  app.use(express.json())

  app.use(
    cors({
      origin: true,
      credentials: false
    })
  )
  registerRoutes(app)
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
      res.json(routesMap)
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve routes', errMsg: err })
    }
  })

  app.listen(port, () => {
    console.info(`Eclessia server running on port ${port}`)
  })
}

export type { RoutesTypes } from './routeTypes'
export * from '@prisma/client'
