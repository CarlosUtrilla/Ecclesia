import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MediaService } from '@ecclesia/api/src/controllers/media/media.service'

const { mockMediaCreate, mockPresentationCreate, mockGetPrisma } = vi.hoisted(() => {
  const mmc = vi.fn()
  const mpc = vi.fn()
  return {
    mockMediaCreate: mmc,
    mockPresentationCreate: mpc,
    mockGetPrisma: vi.fn(() => ({ media: { create: mmc }, presentation: { create: mpc } }))
  }
})

vi.mock('@ecclesia/api/src/prisma', () => ({ getPrisma: mockGetPrisma }))

const { mockImportPdfPages } = vi.hoisted(() => ({
  mockImportPdfPages: vi.fn()
}))

vi.mock('@ecclesia/api/src/controllers/media/media.storage', async () => {
  const actual = await vi.importActual('@ecclesia/api/src/controllers/media/media.storage')
  return { ...actual, importPdfPages: mockImportPdfPages }
})

vi.mock('@ecclesia/api/src/config', () => ({
  resolveFilesRoot: () => '/tmp/media',
  resolveMediaRoot: () => '/tmp/media',
  resolveThumbnailsRoot: () => '/tmp/thumbnails'
}))

function buildPageData(overrides?: Record<string, unknown>) {
  return {
    name: 'test-pagina-1.png',
    type: 'IMAGE' as const,
    format: 'png',
    filePath: '__pdf/test/test-pagina-1.png',
    fileSize: 12345,
    thumbnail: '__pdf/test/test-pagina-1.thumb.jpg',
    folder: '__pdf/test',
    width: 800,
    height: 600,
    ...overrides
  }
}

function buildFile(overrides?: Record<string, unknown>): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    destination: '/tmp/uploads',
    filename: 'test.pdf',
    path: '/tmp/uploads/test.pdf',
    size: 99999,
    ...overrides
  } as Express.Multer.File
}

describe('MediaService.importPdfFromMulter', () => {
  let service: MediaService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new MediaService()

    mockMediaCreate
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2 })
      .mockResolvedValueOnce({
        id: 3,
        name: 'test',
        type: 'PDF',
        format: 'pdf',
        filePath: 'presentation://42',
        fileSize: 99999,
        folder: null,
        presentationId: 42,
        thumbnail: '__pdf/test/test-pagina-1.thumb.jpg'
      })

    mockPresentationCreate.mockResolvedValue({ id: 42 })

    mockImportPdfPages.mockResolvedValue({
      pages: [
        buildPageData({ name: 'test-pagina-1.png', width: 800, height: 600 }),
        buildPageData({
          name: 'test-pagina-2.png',
          filePath: '__pdf/test/test-pagina-2.png',
          thumbnail: '__pdf/test/test-pagina-2.thumb.jpg',
          width: 800,
          height: 600
        })
      ],
      pdfFileSize: 99999,
      originalName: 'test'
    })
  })

  it('crea un Media por pagina, una Presentation y un Media PDF', async () => {
    const result = await service.importPdfFromMulter(buildFile())

    expect(mockImportPdfPages).toHaveBeenCalledWith('/tmp/uploads/test.pdf', undefined, 'test.pdf')
    expect(mockMediaCreate).toHaveBeenCalledTimes(3)
    expect(mockMediaCreate).toHaveBeenNthCalledWith(1, {
      data: {
        name: 'test-pagina-1.png',
        type: 'IMAGE',
        format: 'png',
        filePath: '__pdf/test/test-pagina-1.png',
        fileSize: 12345,
        thumbnail: '__pdf/test/test-pagina-1.thumb.jpg',
        folder: '__pdf/test',
        width: 800,
        height: 600
      }
    })
    expect(mockMediaCreate).toHaveBeenNthCalledWith(2, {
      data: {
        name: 'test-pagina-2.png',
        type: 'IMAGE',
        format: 'png',
        filePath: '__pdf/test/test-pagina-2.png',
        fileSize: 12345,
        thumbnail: '__pdf/test/test-pagina-2.thumb.jpg',
        folder: '__pdf/test',
        width: 800,
        height: 600
      }
    })

    expect(mockPresentationCreate).toHaveBeenCalledTimes(1)
    const slides = JSON.parse(mockPresentationCreate.mock.calls[0][0].data.slides)
    expect(slides).toHaveLength(2)
    expect(slides[0]).toEqual({
      id: 'slide-0',
      type: 'MEDIA',
      mediaId: 1,
      items: [{ id: 'item-0-0', type: 'MEDIA', accessData: '1', layer: 0 }]
    })
    expect(slides[1]).toEqual({
      id: 'slide-1',
      type: 'MEDIA',
      mediaId: 2,
      items: [{ id: 'item-1-0', type: 'MEDIA', accessData: '2', layer: 0 }]
    })

    expect(mockMediaCreate).toHaveBeenNthCalledWith(3, {
      data: {
        name: 'test',
        type: 'PDF',
        format: 'pdf',
        filePath: 'presentation://42',
        fileSize: 99999,
        folder: undefined,
        presentationId: 42,
        thumbnail: '__pdf/test/test-pagina-1.thumb.jpg'
      }
    })

    expect(result).toMatchObject({
      id: 3,
      name: 'test',
      type: 'PDF',
      filePath: 'presentation://42',
      presentationId: 42
    })
  })

  it('usa thumbnail null si la primera pagina no tiene thumbnail', async () => {
    mockImportPdfPages.mockResolvedValue({
      pages: [buildPageData({ thumbnail: null, width: 800, height: 600 })],
      pdfFileSize: 5000,
      originalName: 'doc'
    })
    mockMediaCreate.mockReset().mockResolvedValueOnce({ id: 10 }).mockResolvedValueOnce({
      id: 11,
      name: 'doc',
      type: 'PDF',
      format: 'pdf',
      filePath: 'presentation://99',
      fileSize: 5000,
      folder: null,
      presentationId: 99,
      thumbnail: null
    })
    mockPresentationCreate.mockReset().mockResolvedValue({ id: 99 })

    const result = await service.importPdfFromMulter(
      buildFile({ originalname: 'doc.pdf', path: '/tmp/doc.pdf' })
    )

    expect(mockMediaCreate).toHaveBeenNthCalledWith(2, {
      data: {
        name: 'doc',
        type: 'PDF',
        format: 'pdf',
        filePath: 'presentation://99',
        fileSize: 5000,
        folder: undefined,
        presentationId: 99,
        thumbnail: null
      }
    })
    expect(result.thumbnail).toBeNull()
  })

  it('maneja un PDF de una sola pagina', async () => {
    mockImportPdfPages.mockResolvedValue({
      pages: [buildPageData({ width: 800, height: 600 })],
      pdfFileSize: 3000,
      originalName: 'single'
    })
    mockMediaCreate.mockReset().mockResolvedValueOnce({ id: 20 }).mockResolvedValueOnce({
      id: 21,
      name: 'single',
      type: 'PDF',
      format: 'pdf',
      filePath: 'presentation://7',
      fileSize: 3000,
      folder: null,
      presentationId: 7,
      thumbnail: '__pdf/test/test-pagina-1.thumb.jpg'
    })
    mockPresentationCreate.mockReset().mockResolvedValue({ id: 7 })

    const result = await service.importPdfFromMulter(
      buildFile({ originalname: 'single.pdf', path: '/tmp/single.pdf' })
    )

    expect(mockMediaCreate).toHaveBeenCalledTimes(2)
    expect(mockPresentationCreate).toHaveBeenCalledTimes(1)
    const slides = JSON.parse(mockPresentationCreate.mock.calls[0][0].data.slides)
    expect(slides).toHaveLength(1)
    expect(slides[0].mediaId).toBe(20)
    expect(result).toMatchObject({ name: 'single', presentationId: 7 })
  })

  it('lanza error si importPdfPages falla', async () => {
    mockImportPdfPages.mockRejectedValue(new Error('PDF corrupto'))

    await expect(service.importPdfFromMulter(buildFile())).rejects.toThrow('PDF corrupto')
    expect(mockMediaCreate).not.toHaveBeenCalled()
    expect(mockPresentationCreate).not.toHaveBeenCalled()
  })
})
