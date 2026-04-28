import express from 'express'
import cors from 'cors'
import log from 'electron-log'
import { initPrisma } from '../electron/main/prisma'
import {
  registerMediaServerRoutes,
  MEDIA_SERVER_PORT
} from './controllers/media/mediaServer.controller'
import { registerRoutes, exposeRoutes } from './utils/routerUtilis'

export async function initializeHttpServer() {
  const app = express()
  const port = MEDIA_SERVER_PORT

  app.use(express.json())

  app.use(
    cors({
      origin: true, // refleja el origin automáticamente
      credentials: true
    })
  )
  app.options(/.*/, cors())
  await initPrisma()
  registerRoutes(app)
  registerMediaServerRoutes(app)

  app.listen(port, () => {
    log.info(`Eclessia server running on port ${port}`)
  })
}

const api = exposeRoutes()

export { exposeRoutes }
export default api
