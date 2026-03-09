import { restoreDecimals, serializeDecimals } from './middleware/decimal'
import { RoutesTypes } from './routeTypes'
const Api = (window as Window & typeof globalThis & { api: RoutesTypes }).api

export const wrapApi = (api: any): any => {
  const result: Record<string, any> = {}

  for (const key of Object.keys(api)) {
    const value = api[key]

    if (typeof value === 'function') {
      result[key] = async (...args: any[]) => {
        const raw = await value(...args.map(serializeDecimals))
        return restoreDecimals(raw) // tu lógica
      }
    } else if (typeof value === 'object') {
      result[key] = wrapApi(value) // recursivo
    } else {
      result[key] = value
    }
  }

  return result
}
export default wrapApi(Api) as RoutesTypes
