import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MediaService } from '@ecclesia/api/src/controllers/media/media.service'
import { PresentationsService } from '@ecclesia/api/src/controllers/presentations/presentations.service'

const {
  mockMediaFindUnique,
  mockMediaUpdate,
  mockPresentationUpdate,
  mockPresentationFindMany,
  mockGetPrisma
} = vi.hoisted(() => {
  const mfu = vi.fn()
  const mu = vi.fn()
  const pu = vi.fn()
  const pfm = vi.fn()
  return {
    mockMediaFindUnique: mfu,
    mockMediaUpdate: mu,
    mockPresentationUpdate: pu,
    mockPresentationFindMany: pfm,
    mockGetPrisma: vi.fn(() => ({
      media: { findUnique: mfu, update: mu },
      presentation: { update: pu, findMany: pfm }
    }))
  }
})

vi.mock('@ecclesia/api/src/prisma', () => ({ getPrisma: mockGetPrisma }))

vi.mock('@ecclesia/api/src/config', () => ({
  resolveFilesRoot: () => '/tmp/media',
  resolveMediaRoot: () => '/tmp/media',
  resolveThumbnailsRoot: () => '/tmp/thumbnails'
}))

describe('MediaService.deleteFile', () => {
  let service: MediaService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new MediaService()
    mockMediaUpdate.mockResolvedValue({ id: 10 })
    mockPresentationUpdate.mockResolvedValue({ id: 7 })
  })

  it('deberia borrar tambien la presentacion vinculada al borrar un Media PDF', async () => {
    mockMediaFindUnique.mockResolvedValue({
      id: 10,
      filePath: 'presentation://7',
      thumbnail: null,
      fallback: null,
      presentationId: 7
    })

    await service.deleteFile(10)

    expect(mockPresentationUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { deletedAt: expect.any(Date) }
    })
    expect(mockMediaUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { deletedAt: expect.any(Date) }
    })
  })

  it('no deberia tocar presentaciones cuando el Media no es PDF/PPTX', async () => {
    mockMediaFindUnique.mockResolvedValue({
      id: 11,
      filePath: 'files/foto.png',
      thumbnail: null,
      fallback: null,
      presentationId: null
    })

    await service.deleteFile(11)

    expect(mockPresentationUpdate).not.toHaveBeenCalled()
  })
})

describe('PresentationsService.getPresentations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPresentationFindMany.mockResolvedValue([])
  })

  it('deberia excluir presentaciones importadas de PDF/PPTX aunque el Media ya no exista', async () => {
    await new PresentationsService().getPresentations()

    const { where } = mockPresentationFindMany.mock.calls[0][0]

    expect(where.pdfMedia).toBeNull()
    expect(where.AND).toEqual([
      { NOT: { title: { startsWith: '__pdf_' } } },
      { NOT: { title: { startsWith: '__pptx_' } } }
    ])
  })
})
