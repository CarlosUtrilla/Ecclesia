import { routes } from '../routes'
import express from 'express'
import { MEDIA_SERVER_PORT } from '../controllers/media/mediaServer.controller'
import { Fetcher } from './fetcher'
import Logger from 'electron-log'
export function registerRoutes(app: ReturnType<typeof express>) {
  // REGISTRO DE RUTAS EXPRESS DESDE CONTROLLERS
  for (const [namespace, ControllerClass] of Object.entries(routes)) {
    const proto = ControllerClass.prototype
    const methodNames = Object.getOwnPropertyNames(proto).filter(
      (prop) => prop !== 'constructor' && typeof proto[prop] === 'function'
    )

    const instance = new ControllerClass()
    for (const method of methodNames) {
      const channel = `${namespace}/${method}`
      app.post(`/api/${channel}`, async (req, res) => {
        const handler = instance[method].bind(instance)
        try {
          const result = await handler(req.body)
          return res.json(result)
        } catch (err: any) {
          const rawMessage = err?.message || 'Unknown error'
          const cleanedMessage = rawMessage.replace(/^Error invoking remote method '.*?':\s*/, '')
          Logger.error(`Error en endpoint /api/${channel}:`, cleanedMessage, rawMessage, err)
          return res.status(500).json({ error: cleanedMessage })
        }
      })
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
