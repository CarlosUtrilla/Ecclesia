import Decimal from 'decimal.js'
import Logger from 'electron-log'

// Este bloque evita que truene en el frontend puro
let PrismaDecimal: any = null
try {
  // Solo en entornos donde se puede importar (Node, Electron preload)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  PrismaDecimal = require('@prisma/client/runtime/library').Decimal
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_) {
  // Si falla la importación, simplemente no usamos PrismaDecimal
}


export function restoreDecimals(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(restoreDecimals)
  }

  if (obj && typeof obj === 'object') {
    if ('__decimal__' in obj) {
      return new Decimal(obj.__decimal__)
    }

    if ('__date__' in obj) {
      return new Date(obj.__date__)
    }

    if ('__number__' in obj) {
      return parseFloat(obj.__number__)
    }

    const result: Record<string, any> = {}
    for (const key in obj) {
      result[key] = restoreDecimals(obj[key])
    }
    return result
  }

  return obj
}
