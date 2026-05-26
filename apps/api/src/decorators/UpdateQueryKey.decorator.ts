export const UPDATE_QUERY_KEY = Symbol('update_query')

export function UpdateQueryKey(...queries: string[][]) {
  return function (target: any, propertyKey: string) {
    Reflect.defineMetadata(UPDATE_QUERY_KEY, queries ?? [], target, propertyKey)
  }
}
