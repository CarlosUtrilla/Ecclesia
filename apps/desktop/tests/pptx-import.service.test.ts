import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MediaService } from '@ecclesia/api/src/controllers/media/media.service'
import {
  setPptxRasterizer,
  type RenderedDocumentPage
} from '@ecclesia/api/src/controllers/media/documentImport'

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

const { mockImportMediaFromSourcePath } = vi.hoisted(() => ({
  mockImportMediaFromSourcePath: vi.fn()
}))

vi.mock('@ecclesia/api/src/controllers/media/media.storage', async () => {
  const actual = await vi.importActual('@ecclesia/api/src/controllers/media/media.storage')
  return { ...actual, importMediaFromSourcePath: mockImportMediaFromSourcePath }
})

vi.mock('@ecclesia/api/src/config', () => ({
  resolveFilesRoot: () => '/tmp/ecclesia-test/files',
  resolveMediaRoot: () => '/tmp/ecclesia-test',
  resolveThumbnailsRoot: () => '/tmp/ecclesia-test/thumbnails'
}))

// `documentImport.ts` usa `import fs from 'fs'`, así que el mock tiene que
// cubrir también el export por defecto o se cuela el fs real.
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  const mocked = {
    ...actual,
    statSync: vi.fn(() => ({ size: 4242 })),
    mkdtempSync: vi.fn(() => '/tmp/ecclesia-doc-import-test'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    copyFileSync: vi.fn(),
    rmSync: vi.fn()
  }
  return { ...mocked, default: mocked }
})

function renderedPage(pageNumber: number): RenderedDocumentPage {
  return {
    pageNumber,
    pngBuffer: Buffer.from(`png-${pageNumber}`),
    width: 2560,
    height: 1440
  }
}

const file = { path: '/tmp/upload/abc123', originalname: 'Culto Domingo.pptx' } as never

describe('MediaService.importPptxFromMulter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setPptxRasterizer(null)
    mockImportMediaFromSourcePath.mockImplementation(async (_src, folder, name) => ({
      name,
      type: 'IMAGE',
      format: 'png',
      filePath: `${folder}/${name}`,
      fileSize: 100,
      thumbnail: `thumbnails/thumb-${name}.jpg`,
      folder
    }))
    let nextId = 10
    mockMediaCreate.mockImplementation(async ({ data }) => ({ id: nextId++, ...data }))
    mockPresentationCreate.mockImplementation(async ({ data }) => ({ id: 77, ...data }))
  })

  it('debería crear una imagen por diapositiva, la presentación y el Media envoltorio', async () => {
    setPptxRasterizer(async () => [renderedPage(1), renderedPage(2), renderedPage(3)])

    const result = await new MediaService().importPptxFromMulter(file)

    // 3 imágenes + el Media envoltorio
    expect(mockMediaCreate).toHaveBeenCalledTimes(4)
    expect(mockPresentationCreate).toHaveBeenCalledTimes(1)

    const presentationArg = mockPresentationCreate.mock.calls[0][0].data
    expect(presentationArg.title).toBe('__pptx_Culto Domingo')
    expect(JSON.parse(presentationArg.slides)).toHaveLength(3)

    expect(result.type).toBe('PPTX')
    expect(result.format).toBe('pptx')
    expect(result.presentationId).toBe(77)
    expect(result.filePath).toBe('presentation://77')
    expect(result.name).toBe('Culto Domingo')
  })

  it('debería guardar las imágenes en la carpeta oculta __pptx/', async () => {
    setPptxRasterizer(async () => [renderedPage(1)])

    await new MediaService().importPptxFromMulter(file)

    const [, folder, name] = mockImportMediaFromSourcePath.mock.calls[0]
    expect(folder).toBe('__pptx/Culto Domingo')
    expect(name).toBe('Culto Domingo-diapositiva-1.png')
  })

  it('debería conservar una copia del .pptx original junto a las imágenes', async () => {
    setPptxRasterizer(async () => [renderedPage(1)])
    const fs = (await import('fs')).default

    await new MediaService().importPptxFromMulter(file)

    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/tmp/upload/abc123',
      '/tmp/ecclesia-test/files/__pptx/Culto Domingo/Culto Domingo.pptx'
    )
  })

  it('debería usar la primera diapositiva como miniatura del PPTX', async () => {
    setPptxRasterizer(async () => [renderedPage(1), renderedPage(2)])

    const result = await new MediaService().importPptxFromMulter(file)

    expect(result.thumbnail).toBe('thumbnails/thumb-Culto Domingo-diapositiva-1.png.jpg')
  })

  it('debería fallar con un mensaje claro si no hay rasterizador registrado', async () => {
    await expect(new MediaService().importPptxFromMulter(file)).rejects.toThrow(
      /rasterizador de PPTX no está disponible/
    )
    expect(mockPresentationCreate).not.toHaveBeenCalled()
  })

  it('debería fallar si el PPTX no produce diapositivas visibles', async () => {
    setPptxRasterizer(async () => [])

    await expect(new MediaService().importPptxFromMulter(file)).rejects.toThrow(
      /no tiene diapositivas visibles/
    )
    expect(mockPresentationCreate).not.toHaveBeenCalled()
  })

  it('debería propagar el error del rasterizador sin crear nada', async () => {
    setPptxRasterizer(async () => {
      throw new Error('La diapositiva 3 falló al renderizar: sin memoria')
    })

    await expect(new MediaService().importPptxFromMulter(file)).rejects.toThrow(/diapositiva 3/)
    expect(mockMediaCreate).not.toHaveBeenCalled()
    expect(mockPresentationCreate).not.toHaveBeenCalled()
  })
})
