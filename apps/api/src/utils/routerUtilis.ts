import { routes } from '../routes'
import express, { Request } from 'express'
import * as os from 'os'

import { restoreDecimals } from '../middleware/decimal'
import { USING_MULTER_KEY, UsingMulterOptions } from '../decorators/multerDecorator'
import multer from 'multer'
import 'reflect-metadata'
import { UPDATE_QUERY_KEY } from '../decorators/UpdateQueryKey.decorator'
import Logger from 'electron-log'

const routeHandler =
  (handler: (params: any) => Promise<any>, queryKeys?: string[]) =>
  async (req: Request, res: express.Response) => {
    try {
      const requestData = req?.body ?? {}
      const body = restoreDecimals(requestData?.body ?? requestData)
      const result = await handler({
        body,
        file: req.file ?? requestData?.file,
        files: req.files ?? requestData?.files,
        req: requestData?.req,
        res: requestData?.res
      })

      if (!queryKeys || queryKeys.length <= 0) {
        Logger.info(`no querykeys on ${req.originalUrl}`)
      }
      return res.json({ response: result, queryKeys: queryKeys ?? [] })
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
    const methodNames = Object.getOwnPropertyNames(proto).filter(
      (prop) => prop !== 'constructor' && typeof (proto as any)[prop] === 'function'
    )

    const instance = new ControllerClass() as any
    for (const method of methodNames) {
      const channel = `${namespace}/${method}`

      /**
       * Detectar metadata
       */
      const multerOptions = Reflect.getMetadata(USING_MULTER_KEY, proto, method) as
        | UsingMulterOptions
        | undefined

      const updateQueryKeys = Reflect.getMetadata(UPDATE_QUERY_KEY, proto, method) as
        | string[]
        | undefined

      /**
       * Si usa multer
       */
      if (multerOptions) {
        const { maxFiles = 1, mode = 'single', path, fieldName } = multerOptions

        console.info(`[UsingMulter] Registrando multer en ${channel}`, multerOptions)

        let multerMiddleware

        const upload = multer({
          dest: path ?? os.tmpdir()
        })

        if (mode === 'single') {
          multerMiddleware = upload.single(fieldName)
        } else {
          multerMiddleware = upload.array(fieldName, maxFiles)
        }

        app.post(
          `/api/${channel}`,
          multerMiddleware,
          routeHandler(instance[method].bind(instance), updateQueryKeys)
        )

        continue
      }

      /**
       * Ruta normal
       */
      app.post(`/api/${channel}`, routeHandler(instance[method].bind(instance), updateQueryKeys))
    }
  }
}
