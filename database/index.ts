import { ipcMain, ipcRenderer } from 'electron'
import { routes } from './routes'
import { restoreDecimals, serializeDecimals } from './middleware/decimal'

export function registerRoutes() {
  for (const [namespace, ControllerClass] of Object.entries(routes)) {
    const proto = ControllerClass.prototype
    const methodNames = Object.getOwnPropertyNames(proto).filter(
      (prop) => prop !== 'constructor' && typeof proto[prop] === 'function'
    )

    for (const method of methodNames) {
      const channel = `${namespace}.${method}`

      ipcMain.handle(channel, async (event, args) => {
        const instance = new ControllerClass()
        const handler = instance[method].bind(instance)
        const restoresArgs = restoreDecimals(args)
        const result = await handler(...restoresArgs)
        return serializeDecimals(result)
      })
    }
  }
}

export function exposeRoutes() {
  const api: Record<string, Record<string, (...args: any[]) => Promise<any>>> = {}

  for (const [namespace, ControllerClass] of Object.entries(routes)) {
    const proto = ControllerClass.prototype
    const methodNames = Object.getOwnPropertyNames(proto).filter(
      (prop) => prop !== 'constructor' && typeof proto[prop] === 'function'
    )

    api[namespace] = {}
    for (const method of methodNames) {
      api[namespace][method] = async (...args: any) => {
        try {
          return await ipcRenderer.invoke(`${namespace}.${method}`, args)
        } catch (err: any) {
          const rawMessage = err?.message || 'Unknown error'
          const cleanedMessage = rawMessage.replace(/^Error invoking remote method '.*?':\s*/, '')
          console.log(cleanedMessage, rawMessage, err)
          throw new Error(cleanedMessage)
        }
      }
    }
  }

  return api
}
