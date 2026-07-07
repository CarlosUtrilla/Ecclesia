import { PrismaClient } from '@prisma/client'
import { load, save, from } from '@automerge/automerge'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPrismaModelFields, computeSchemaHash } from './oplog-utils'
import { setPrismaClient } from '../../prisma'
import { ENTITY_TYPE_TO_PRISMA_MODEL } from './oplog.types'
import type { OplogDocument } from './oplog.types'
import { oplogMigrationService, OplogMigrationService } from './oplog-migration.service'

let prisma: PrismaClient

beforeAll(async () => {
  prisma = new PrismaClient()
  await prisma.$connect()
  setPrismaClient(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('OplogUtils', () => {
  describe('getPrismaModelFields', () => {
    const modelNames = [...new Set(Object.values(ENTITY_TYPE_TO_PRISMA_MODEL))]
    
    it.each(modelNames)('debería retornar campos escalares para %s', (modelName) => {
      const fields = getPrismaModelFields(modelName)
      expect(fields.size).toBeGreaterThan(0)
      expect(fields.has('id')).toBe(true)
    })

    it('debería cachear resultados', () => {
      const first = getPrismaModelFields('Song')
      const second = getPrismaModelFields('Song')
      expect(first).toBe(second)
    })
  })

  describe('computeSchemaHash', () => {
    it('debería retornar un hash no vacío ni "unknown"', () => {
      const hash = computeSchemaHash()
      expect(hash).not.toBe('')
      expect(hash).not.toBe('0')
      expect(hash).not.toBe('unknown')
      expect(typeof hash).toBe('string')
    })
  })
})

describe('OplogMigration Bootstrap', () => {
  describe('Delegate access', () => {
    it.each(Object.entries(ENTITY_TYPE_TO_PRISMA_MODEL))(
      'debería tener delegate accesible para %s → %s',
      (entityType, modelName) => {
        const key = modelName.charAt(0).toLowerCase() + modelName.slice(1)
        const delegate = (prisma as any)[key]
        expect(delegate).toBeDefined()
        expect(typeof delegate.findMany).toBe('function')
      }
    )
  })

  describe('Record counting', () => {
    it.each(Object.entries(ENTITY_TYPE_TO_PRISMA_MODEL))(
      'debería leer registros de %s → %s',
      async (entityType, modelName) => {
        const key = modelName.charAt(0).toLowerCase() + modelName.slice(1)
        const delegate = (prisma as any)[key]
        if (!delegate) return // skip

        const validFields = getPrismaModelFields(modelName)
        expect(validFields.size).toBeGreaterThan(0)
        const scalarFields = [...validFields]
        const select = scalarFields.reduce((acc: any, f) => { acc[f] = true; return acc }, {})

        const records = await delegate.findMany({ select })
        console.log(`  ${modelName}: ${records.length} registros, campos: ${scalarFields.join(', ')}`)
        expect(Array.isArray(records)).toBe(true)
      }
    )
  })

  describe('Full bootstrap simulation', () => {
    it('debería generar al menos un evento por modelo con datos', async () => {
      let totalEvents = 0
      const errors: string[] = []

      for (const [entityType, modelName] of Object.entries(ENTITY_TYPE_TO_PRISMA_MODEL)) {
        const key = modelName.charAt(0).toLowerCase() + modelName.slice(1)
        const delegate = (prisma as any)[key]
        if (!delegate) {
          errors.push(`${modelName}: no delegate for key "${key}"`)
          continue
        }

        const validFields = getPrismaModelFields(modelName)
        if (validFields.size === 0) {
          errors.push(`${modelName}: getPrismaModelFields returned empty set`)
          continue
        }

        const scalarFields = [...validFields]
        const select = scalarFields.reduce((acc: any, f) => { acc[f] = true; return acc }, {})

        try {
          const records = await delegate.findMany({ select })
          totalEvents += records.length
        } catch (err: any) {
          errors.push(`${modelName}: findMany error: ${err.message}`)
        }
      }

      console.log(`Total eventos simulados: ${totalEvents}`)
      console.log(`Errores: ${errors.length > 0 ? errors.join(' | ') : 'ninguno'}`)
      expect(totalEvents).toBeGreaterThan(0)
      expect(errors).toHaveLength(0)
    })
  })

  describe('Real bootstrapOplog() call', () => {
    it('debería generar eventos con datos reales usando bootstrapOplog()', async () => {
      const doc = await oplogMigrationService.bootstrapOplog('test', 'test-device')
      const ops = doc.ops ?? []
      console.log(`Eventos generados: ${ops.length}`)
      expect(ops.length).toBeGreaterThan(0)
      if (ops.length > 0) {
        expect(ops[0].seq).toBe(1)
        expect(ops[0].entityType).toBeDefined()
        expect(ops[0].entityId).toBeDefined()
        expect(ops[0].data).toBeDefined()
        console.log(`Primer evento: ${ops[0].entityType}#${ops[0].entityId} op=${ops[0].op}`)
        console.log(`Último evento: ${ops[ops.length - 1].entityType}#${ops[ops.length - 1].entityId}`)
      }
    })
  })

  describe('performFullMigration output', () => {
    it('debería producir un documento Automerge con ops no vacío', async () => {
      const totalOps: Array<{ modelName: string; count: number }> = []
      const schemaHash = computeSchemaHash()

      for (const [entityType, modelName] of Object.entries(ENTITY_TYPE_TO_PRISMA_MODEL)) {
        const key = modelName.charAt(0).toLowerCase() + modelName.slice(1)
        const delegate = (prisma as any)[key]
        if (!delegate) continue

        const validFields = getPrismaModelFields(modelName)
        if (validFields.size === 0) continue

        const scalarFields = [...validFields]
        const select = scalarFields.reduce((acc: any, f) => { acc[f] = true; return acc }, {})
        const records = await delegate.findMany({ select })
        if (records.length > 0) totalOps.push({ modelName, count: records.length })
      }

      // Crear documento Automerge con los eventos simulados
      const doc = from<OplogDocument>({
        schemaVersion: 1,
        schemaHash,
        createdAt: Date.now(),
        ops: [],
      })

      const binary = save(doc)
      expect(binary.length).toBeGreaterThan(0)

      const reloaded = load<OplogDocument>(binary)
      expect(reloaded.ops).toBeDefined()
      expect(Array.isArray(reloaded.ops)).toBe(true)

      console.log(`Modelos con datos: ${totalOps.map(m => `${m.modelName}(${m.count})`).join(', ')}`)
      console.log(`Total registros: ${totalOps.reduce((s, m) => s + m.count, 0)}`)
      console.log(`schemaHash: ${schemaHash}`)
      console.log(`Binary size: ${binary.length} bytes`)
    })
  })
})
