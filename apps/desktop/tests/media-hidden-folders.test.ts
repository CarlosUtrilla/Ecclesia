import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MediaService } from '@ecclesia/api/src/controllers/media/media.service'

const { mockFindMany, mockGetPrisma } = vi.hoisted(() => {
  const fm = vi.fn(async () => [])
  const c = vi.fn(async () => 0)
  return {
    mockFindMany: fm,
    mockGetPrisma: vi.fn(() => ({ media: { findMany: fm, count: c } }))
  }
})

vi.mock('@ecclesia/api/src/prisma', () => ({ getPrisma: mockGetPrisma }))
vi.mock('@ecclesia/api/src/config', () => ({
  resolveFilesRoot: () => '/tmp/ecclesia-test/files',
  resolveMediaRoot: () => '/tmp/ecclesia-test',
  resolveThumbnailsRoot: () => '/tmp/ecclesia-test/thumbnails'
}))

/**
 * Evalúa el `where` de Prisma que construye `findAll` contra una fila, para
 * comprobar si quedaría visible en la biblioteca.
 */
function isVisible(where: any, folder: string | null): boolean {
  const groups: any[] = where.AND ?? []
  return groups.every((group) =>
    (group.OR as any[]).some((clause) => {
      if ('folder' in clause && clause.folder === null) return folder === null
      if (clause.AND) {
        return (clause.AND as any[]).every((c) => {
          const prefix = c.folder.not.startsWith
          return folder !== null && !folder.startsWith(prefix)
        })
      }
      const prefix = clause.folder?.not?.startsWith
      return folder !== null && !folder.startsWith(prefix)
    })
  )
}

describe('MediaService.findAll: ocultado de carpetas internas', () => {
  beforeEach(() => vi.clearAllMocks())

  async function whereFor(type?: string) {
    await new MediaService().findAll(type ? ({ type } as never) : undefined)
    const call = mockFindMany.mock.calls[0] as unknown as [{ where: any }]
    return call[0].where
  }

  it('debería ocultar las imágenes de página de __pdf/ y __pptx/', async () => {
    const where = await whereFor()

    // Regresión: las dos condiciones iban en OR, lo que las volvía una
    // tautología (una carpeta `__pdf/x` incumple la primera pero cumple la
    // segunda), y ninguna imagen interna llegaba a ocultarse.
    expect(isVisible(where, '__pdf/mi-documento')).toBe(false)
    expect(isVisible(where, '__pptx/mi-presentacion')).toBe(false)
  })

  it('debería seguir mostrando los medios normales y los de la raíz', async () => {
    const where = await whereFor()

    expect(isVisible(where, null)).toBe(true)
    expect(isVisible(where, 'fondos')).toBe(true)
    expect(isVisible(where, 'cultos/2026')).toBe(true)
  })

  it('no debería filtrar cuando se piden PDF o PPTX explícitamente', async () => {
    expect((await whereFor('PDF')).AND).toBeUndefined()
    vi.clearAllMocks()
    expect((await whereFor('PPTX')).AND).toBeUndefined()
  })
})
