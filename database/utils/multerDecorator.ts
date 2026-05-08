export type MulterOptions = {
  fieldName?: string
  maxFiles?: number
}

export type UsingMulterOptions = {
  maxFiles?: number
  mode?: 'single' | 'array'
  path: string
  fieldName: string
}

export const USING_MULTER_KEY = Symbol('using_multer')

export function UsingMulter(options?: MulterOptions) {
  return function (target: any, propertyKey: string) {
    Reflect.defineMetadata(USING_MULTER_KEY, options ?? {}, target, propertyKey)
  }
}
