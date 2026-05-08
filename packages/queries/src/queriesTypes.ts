import type { routes } from '@ecclesia/api/src/routes'
import type { UndefinedInitialDataOptions, MutationOptions } from '@tanstack/react-query'

type RoutesMap = typeof routes

type ClassMethods<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? K : never]: T[K]
}

type Instance<T> = T extends new () => infer I ? I : never

type NamespaceMethods<T> = ClassMethods<Instance<T>>

type QueryShape<T> = {
  [K in keyof NamespaceMethods<T>]: NamespaceMethods<T>[K] extends (
    ...args: infer A
  ) => Promise<infer R>
    ? (...args: A) => UndefinedInitialDataOptions<Awaited<R>>
    : never
}

type MutationShape<T> = {
  [K in keyof NamespaceMethods<T>]: NamespaceMethods<T>[K] extends (
    ...args: infer A
  ) => Promise<infer R>
    ? () => MutationOptions<Awaited<R>, Error, A extends [infer P] ? P : void>
    : never
}

export type ApiTypes = {
  query: { [N in keyof RoutesMap]: QueryShape<RoutesMap[N]> }
  mutation: { [N in keyof RoutesMap]: MutationShape<RoutesMap[N]> }
}
