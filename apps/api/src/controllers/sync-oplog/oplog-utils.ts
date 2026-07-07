import { getPrisma } from '../../prisma'
import type { EntityType } from './oplog.types'
import { ENTITY_TYPE_TO_PRISMA_MODEL } from './oplog.types'

const fieldCache = new Map<string, Set<string>>()

export function getPrismaModelFields(modelName: string): Set<string> {
  const cached = fieldCache.get(modelName)
  if (cached) return cached

  try {
    const prisma = getPrisma()
    // Prisma v6: _runtimeDataModel.models is an object keyed by model name
    const runtime = (prisma as any)._runtimeDataModel
    const model = runtime?.models?.[modelName]

    if (model?.fields) {
      const fields = new Set<string>(
        model.fields
          .filter((f: any) => !f.relationName && f.kind === 'scalar')
          .map((f: any) => f.name)
      )
      fieldCache.set(modelName, fields)
      return fields
    }
  } catch {
    /* DMMF access failed, will try-and-error in replay */
  }

  return new Set()
}

export function clearFieldCache(): void {
  fieldCache.clear()
}

export function computeSchemaHash(): string {
  try {
    const prisma = getPrisma()
    // Prisma v6: _runtimeDataModel.models is an object keyed by model name
    const runtime = (prisma as any)._runtimeDataModel
    const modelMap = runtime?.models ?? {}

    const schemaString = Object.entries(modelMap)
      .map(([name, model]: [string, any]) => {
        const fields = model.fields
          ?.filter((f: any) => !f.relationName)
          .map((f: any) => `${f.name}:${f.type}`)
          .sort()
          .join(',')
        return `${name}:{${fields}}`
      })
      .sort()
      .join('|')

    return simpleHash(schemaString)
  } catch {
    return 'unknown'
  }
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return (hash >>> 0).toString(36)
}
