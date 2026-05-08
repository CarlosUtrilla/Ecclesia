import express from 'express'
import cors from 'cors'
import {
  registerMediaServerRoutes,
  MEDIA_SERVER_PORT
} from './controllers/media/mediaServer.controller'
import { registerRoutes, exposeRoutes } from './utils/routerUtilis'
import { DatabaseConfig, initializeDatabase } from './prisma-init'

export async function initializeHttpServer(config: DatabaseConfig) {
  const app = express()
  const port = MEDIA_SERVER_PORT

  await initializeDatabase(config)
  app.use(express.json())

  app.use(
    cors({
      origin: true,
      credentials: false
    })
  )
  registerRoutes(app)
  registerMediaServerRoutes(app)

  app.listen(port, () => {
    console.info(`Eclessia server running on port ${port}`)
  })
}

const api = exposeRoutes()

export { exposeRoutes }
export type { RoutesTypes } from './routeTypes'
export {
  MediaType,
  ScheduleItemType,
  BibleDescriptionMode,
  BibleDescriptionPosition
} from '@prisma/client'
export type { Media, ScheduleItem, ScreenRol, TagSongs } from '@prisma/client'
export type { PrismaClient } from '@prisma/client'
export default api
