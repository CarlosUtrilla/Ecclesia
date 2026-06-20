import 'reflect-metadata'

const USING_MULTER_KEY = 'ecclesia:using_multer'

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

export { USING_MULTER_KEY }

export function UsingMulter(options?: MulterOptions) {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    if (descriptor && typeof descriptor.value === 'function') {
      (descriptor.value as any)[USING_MULTER_KEY] = options ?? {}
    } else {
      ;(target as any)[USING_MULTER_KEY] = options ?? {}
    }
  }
}
