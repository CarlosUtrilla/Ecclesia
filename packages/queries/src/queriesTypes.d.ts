import type { routes } from '@ecclesia/api/src/routes'
import type { UndefinedInitialDataOptions, MutationOptions } from '@tanstack/react-query'

type RoutesMap = typeof routes

type AnyFunction = (...args: any[]) => any

type ClassMethods<T> = {
  [K in keyof T as T[K] extends AnyFunction ? K : never]: T[K]
}

type Instance<T> = T extends new () => infer I ? I : never

type NamespaceMethods<T> = ClassMethods<Instance<T>>

type HasOptionalBody<P> = P extends { body: infer B } ? (undefined extends B ? true : false) : false

type OptionalArgs<A extends any[]> = A extends [infer P]
  ? HasOptionalBody<P> extends true
    ? [] | [params: P]
    : [params: P]
  : []

type MutationVariables<A extends any[]> = A extends [infer P] ? P : void

type QueryShape<T> = {
  [K in keyof NamespaceMethods<T>]: NamespaceMethods<T>[K] extends (
    ...args: infer A
  ) => Promise<infer R>
    ? (...args: OptionalArgs<A>) => UndefinedInitialDataOptions<Awaited<R>>
    : never
}

type MutationShape<T> = {
  [K in keyof NamespaceMethods<T>]: NamespaceMethods<T>[K] extends (
    ...args: infer A
  ) => Promise<infer R>
    ? MutationOptions<Awaited<R>, Error, MutationVariables<A>>
    : never
}

type FetchShape<T> = {
  [K in keyof NamespaceMethods<T>]: NamespaceMethods<T>[K] extends (
    ...args: infer A
  ) => Promise<infer R>
    ? (...args: OptionalArgs<A>) => Promise<Awaited<R>>
    : never
}

export type ApiTypes = {
  query: {
    [N in keyof RoutesMap]: QueryShape<RoutesMap[N]>
  }

  mutation: {
    [N in keyof RoutesMap]: MutationShape<RoutesMap[N]>
  }

  fetch: {
    [N in keyof RoutesMap]: FetchShape<RoutesMap[N]>
  }
}
