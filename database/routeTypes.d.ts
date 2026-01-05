import { routes } from './routes'

// Tipo que extrae los métodos públicos de instancia de cada clase del routes
type ClassMethods<T> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [K in keyof T as T[K] extends Function ? K : never]: T[K]
}

export type RoutesTypes = {
  [K in keyof typeof routes]: ClassMethods<InstanceType<(typeof routes)[K]>>
}
declare global {
  interface Window {
    api: RoutesTypes
  }
}
