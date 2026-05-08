import { routes } from '../routes'
import express from 'express'
import { MEDIA_SERVER_PORT } from '../controllers/media/mediaServer.controller'
import { Fetcher } from './fetcher'

import { restoreDecimals } from '../middleware/decimal'
import { USING_MULTER_KEY, UsingMulterOptions } from './multerDecorator'
import multer from 'multer'

const routeHandler =
  (handler: (params: any) => Promise<any>) => async (req: any, res: express.Response) => {
    try {
      const result = await handler({
        body: restoreDecimals(req.body),
        file: req.file,
        files: req.files,
        req,
        res
      })

      return res.json(result)
    } catch (err: any) {
      const rawMessage = err?.message || 'Unknown error'

      const cleanedMessage = rawMessage.replace(/^Error invoking remote method '.*?':\s*/, '')

      return res.status(500).json({
        error: cleanedMessage
      })
    }
  }

export function registerRoutes(app: ReturnType<typeof express>) {
  // REGISTRO DE RUTAS EXPRESS DESDE CONTROLLERS
  for (const [namespace, ControllerClass] of Object.entries(routes)) {
    const proto = ControllerClass.prototype
    console.info('Proto of', namespace, proto)
    const methodNames = Object.getOwnPropertyNames(proto).filter(
      (prop) => prop !== 'constructor' && typeof proto[prop] === 'function'
    )

    const instance = new ControllerClass()
    for (const method of methodNames) {
      const channel = `${namespace}/${method}`

      /**
       * Detectar metadata
       */
      const multerOptions = Reflect.getMetadata(USING_MULTER_KEY, proto, method) as
        | UsingMulterOptions
        | undefined

      /**
       * Si usa multer
       */
      if (multerOptions) {
        const { maxFiles = 1, mode = 'single', path, fieldName } = multerOptions

        console.info(`[UsingMulter] Registrando multer en ${channel}`, multerOptions)

        let multerMiddleware

        const upload = multer({
          dest: path
        })

        if (mode === 'single') {
          multerMiddleware = upload.single(fieldName)
        } else {
          multerMiddleware = upload.array(fieldName, maxFiles)
        }

        app.post(`/api/${channel}`, multerMiddleware, routeHandler(instance[method].bind(instance)))

        continue
      }

      /**
       * Ruta normal
       */
      app.post(`/api/${channel}`, routeHandler(instance[method].bind(instance)))
    }
  }
}

export const exposeRoutes = () => {
  const port = MEDIA_SERVER_PORT
  const server = `http://localhost:${port}/api`
  const routesMap = {}
  for (const [namespace, ControllerClass] of Object.entries(routes)) {
    const proto = ControllerClass.prototype
    const methodNames = Object.getOwnPropertyNames(proto).filter(
      (prop) => prop !== 'constructor' && typeof proto[prop] === 'function'
    )
    routesMap[namespace] = {}
    for (const method of methodNames) {
      routesMap[namespace][method] = async (data: any) => {
        const response = await Fetcher(server, `/${namespace}/${method}`, data)
        return response
      }
    }
  }
  return routesMap
}
