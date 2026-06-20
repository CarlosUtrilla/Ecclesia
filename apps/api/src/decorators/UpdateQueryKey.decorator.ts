import 'reflect-metadata'

const UPDATE_QUERY_KEY = 'ecclesia:update_query'

export function UpdateQueryKey(...queries: string[][]) {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    if (descriptor && typeof descriptor.value === 'function') {
      (descriptor.value as any)[UPDATE_QUERY_KEY] = queries
    } else {
      ;(target as any)[UPDATE_QUERY_KEY] = queries
    }
  }
}

export { UPDATE_QUERY_KEY }
