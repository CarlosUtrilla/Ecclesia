import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { createCanvas, type Canvas } from '@napi-rs/canvas'

// pdfjs-dist v3 doesn't have types, use CJS require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjs = require('pdfjs-dist')

export interface RenderedPage {
  pageNumber: number
  pngBuffer: Buffer
  width: number
  height: number
}

export async function pdfToPngBuffers(pdfPath: string, scale = 2): Promise<RenderedPage[]> {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  return pdfBufferToPngBuffers(data, scale)
}

export async function pdfBufferToPngBuffers(pdfData: Uint8Array | Buffer, scale = 2): Promise<RenderedPage[]> {
  const data = pdfData instanceof Buffer ? new Uint8Array(pdfData) : pdfData

  // Provide custom canvas factory using @napi-rs/canvas so pdfjs-dist
  // doesn't try to load node-canvas (which would fail without native build)
  const napiCanvasFactory = {
    create: (width: number, height: number) => {
      const c = createCanvas(width, height)
      return { canvas: c, context: c.getContext('2d') }
    },
    reset: (canvasAndContext: { canvas: Canvas; context: CanvasRenderingContext2D }, width: number, height: number) => {
      canvasAndContext.canvas.width = width
      canvasAndContext.canvas.height = height
    },
    destroy: (_canvasAndContext: { canvas: Canvas; context: CanvasRenderingContext2D }) => {}
  }

  const doc = await pdfjs.getDocument({ data, canvasFactory: napiCanvasFactory }).promise
  const pages: RenderedPage[] = []

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const viewport = page.getViewport({ scale })
      const canvas: Canvas = createCanvas(viewport.width, viewport.height)
      const ctx = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise
      const raw = await canvas.encode('png')
      pages.push({
        pageNumber: i,
        pngBuffer: Buffer.from(raw),
        width: viewport.width,
        height: viewport.height
      })
    }
  } finally {
    doc.destroy()
  }

  return pages
}

export function createTempDir(): string {
  const tempRoot = path.join(os.tmpdir(), 'ecclesia-pdf-imports')
  const dir = path.join(tempRoot, `pdf-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function writePagesToTemp(pages: RenderedPage[], tempDir: string): string[] {
  const pagePaths: string[] = []
  for (const page of pages) {
    const pagePath = path.join(tempDir, `page-${page.pageNumber}.png`)
    fs.writeFileSync(pagePath, page.pngBuffer)
    pagePaths.push(pagePath)
  }
  return pagePaths
}

export function cleanupTempDir(tempDir: string) {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}
