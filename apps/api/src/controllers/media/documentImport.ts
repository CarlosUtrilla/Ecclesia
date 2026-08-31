/**
 * Tronco común de la importación de documentos (PDF y PPTX).
 *
 * Ambos formatos acaban en lo mismo: una imagen por página/diapositiva
 * guardada en una carpeta oculta, una `Presentation` con una diapositiva por
 * imagen, y un `Media` envoltorio que apunta a esa presentación. Antes esto
 * estaba triplicado (los dos métodos del controller y el handler IPC).
 *
 * El PDF se rasteriza aquí mismo con `pdfjs-dist`. El PPTX no: su rasterizador
 * necesita una ventana de Electron, así que el proceso principal lo registra
 * con `setPptxRasterizer()` al arrancar (mismo patrón que
 * `setOnMediaChangeCallback` en `prisma-init.ts`).
 */

import fs from 'fs'
import path from 'path'
import { getPrisma } from '../../prisma'
import { resolveFilesRoot } from '../../config'
import { importMediaFromSourcePath, sanitizeFileName } from './media.storage'
import type { MediaDto } from './media.dto'

/** Una página o diapositiva ya rasterizada. */
export interface RenderedDocumentPage {
  /** 1-indexado. */
  pageNumber: number
  pngBuffer: Buffer
  width: number
  height: number
}

export type PptxRasterizer = (pptxPath: string) => Promise<RenderedDocumentPage[]>

let pptxRasterizer: PptxRasterizer | null = null

/**
 * Lo llama el proceso principal al arrancar con el rasterizador de
 * `electron/main/pptxRenderer`. Sin esto, importar un PPTX falla con un
 * mensaje explícito en vez de producir diapositivas en blanco.
 */
export function setPptxRasterizer(rasterizer: PptxRasterizer | null): void {
  pptxRasterizer = rasterizer
}

export function getPptxRasterizer(): PptxRasterizer {
  if (!pptxRasterizer) {
    throw new Error(
      'El rasterizador de PPTX no está disponible: la importación de PPTX requiere el proceso principal de Electron'
    )
  }
  return pptxRasterizer
}

export type DocumentImportSpec = {
  /** Ruta del archivo original en disco. */
  sourcePath: string
  /** Nombre con el que lo subió el usuario, para derivar el título. */
  originalFileName?: string
  /** Extensión del documento, sin punto: 'pdf' | 'pptx'. */
  format: 'pdf' | 'pptx'
  mediaType: 'PDF' | 'PPTX'
  /** Prefijo de la carpeta oculta: '__pdf' | '__pptx'. */
  hiddenFolderPrefix: string
  /** Prefijo del título de la Presentation: '__pdf_' | '__pptx_'. */
  titlePrefix: string
  /** Sufijo del nombre de cada imagen: 'pagina' | 'diapositiva'. */
  pageLabel: string
  /** Si se conserva una copia del original junto a las imágenes. */
  keepSourceCopy?: boolean
  pages: RenderedDocumentPage[]
}

/** Nombre del archivo original conservado dentro de la carpeta oculta. */
export function sourceCopyFileName(baseName: string, format: string): string {
  return `${baseName}.${format}`
}

/** Carpeta oculta donde viven las imágenes (y la copia del original). */
export function documentHiddenFolder(hiddenFolderPrefix: string, baseName: string): string {
  return `${hiddenFolderPrefix}/${baseName}`
}

/**
 * Crea las imágenes, la `Presentation` y el `Media` envoltorio de un documento
 * ya rasterizado.
 */
export async function createDocumentPresentation(spec: DocumentImportSpec): Promise<MediaDto> {
  const prisma = getPrisma()
  const rawName = spec.originalFileName
    ? path.basename(spec.originalFileName, `.${spec.format}`)
    : path.basename(spec.sourcePath, `.${spec.format}`)
  const originalName = sanitizeFileName(rawName)
  const hiddenFolder = documentHiddenFolder(spec.hiddenFolderPrefix, originalName)
  const fileSize = fs.statSync(spec.sourcePath).size

  const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ecclesia-doc-import-'))
  try {
    // 1. Una imagen (Media de tipo IMAGE) por página, en la carpeta oculta.
    const pageMedia = await Promise.all(
      spec.pages.map(async (page) => {
        const tempPath = path.join(tempDir, `page-${page.pageNumber}.png`)
        fs.writeFileSync(tempPath, page.pngBuffer)
        const fileData = await importMediaFromSourcePath(
          tempPath,
          hiddenFolder,
          `${originalName}-${spec.pageLabel}-${page.pageNumber}.png`
        )
        return prisma.media.create({
          data: { ...fileData, width: page.width, height: page.height }
        })
      })
    )

    // 2. Copia del original junto a las imágenes, para poder re-rasterizar más
    //    adelante (p. ej. a mayor escala) sin volver a pedir el archivo.
    if (spec.keepSourceCopy) {
      const destDir = path.join(resolveFilesRoot(), ...hiddenFolder.split('/'))
      try {
        fs.mkdirSync(destDir, { recursive: true })
        fs.copyFileSync(
          spec.sourcePath,
          path.join(destDir, sourceCopyFileName(originalName, spec.format))
        )
      } catch (err) {
        // No es crítico: sin la copia se pierde el re-rasterizado, no la importación.
        console.warn(`[media] No se pudo conservar el original de ${originalName}:`, err)
      }
    }

    // 3. Presentation con una diapositiva MEDIA por página.
    const slides = pageMedia.map((media, index) => ({
      id: `slide-${index}`,
      type: 'MEDIA' as const,
      mediaId: media.id,
      items: [
        { id: `item-${index}-0`, type: 'MEDIA' as const, accessData: String(media.id), layer: 0 }
      ]
    }))

    const presentation = await prisma.presentation.create({
      data: {
        title: `${spec.titlePrefix}${originalName}`,
        slides: JSON.stringify(slides)
      }
    })

    // 4. Media envoltorio: no apunta a un archivo real, sino a su presentación.
    return await prisma.media.create({
      data: {
        name: originalName,
        type: spec.mediaType,
        format: spec.format,
        filePath: `presentation://${presentation.id}`,
        fileSize,
        folder: undefined,
        presentationId: presentation.id,
        thumbnail: pageMedia[0]?.thumbnail ?? null
      }
    })
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}
