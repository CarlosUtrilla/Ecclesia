import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getPrisma } from './prisma'
import { importMediaFromSourcePath, sanitizeFileName } from './controllers/media/media.storage'
import { PPTX_PRESENTATION_TITLE_PREFIX } from './controllers/presentations/importedPresentationTitle'

export interface ParsedPptxSlide {
  slideNumber: number
  texts: { content: string; left: number; top: number; width: number; height: number }[]
  images: string[] // file paths of extracted images
}

export interface PptxParseResult {
  slides: ParsedPptxSlide[]
}

export async function parsePptxFile(pptxPath: string): Promise<PptxParseResult> {
  const data = fs.readFileSync(pptxPath)
  const zip = await JSZip.loadAsync(data)

  const slideFiles = Object.keys(zip.files)
    .filter((name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
    .sort()

  const results: ParsedPptxSlide[] = []

  for (const slideFile of slideFiles) {
    const slideNumber = parseInt(slideFile.match(/slide(\d+)\.xml/)?.[1] || '0', 10)
    const xmlContent = await zip.files[slideFile].async('string')

    // Extract text from slide XML
    const texts: ParsedPptxSlide['texts'] = []
    const textRuns = xmlContent.match(/<a:t[^>]*>([^<]*)<\/a:t>/g)
    if (textRuns) {
      const combinedText = textRuns.map((t) => t.replace(/<\/?a:t[^>]*>/g, '')).join(' ').trim()
      if (combinedText) {
        texts.push({ content: combinedText, left: 0, top: 0, width: 0, height: 0 })
      }
    }

    // Extract image references
    const images: string[] = []
    const imgRefs = xmlContent.match(/r:embed="[^"]+"/g)
    if (imgRefs) {
      for (const ref of imgRefs) {
        const rId = ref.match(/"(rId\d+)"/)?.[1]
        if (!rId) continue

        // Find the relationship in slide's rels file
        const relsFile = slideFile.replace('slides/', 'slides/_rels/') + '.rels'
        const relsContent = zip.files[relsFile]?.async('string')
        if (!relsContent) continue

        const relsXml = await relsContent
        const targetMatch = relsXml.match(new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`))
        if (!targetMatch) continue

        let target = targetMatch[1]
        if (target.startsWith('../')) {
          target = target.replace('../', '')
        }

        // Extract the media file from ZIP
        const mediaPath = `ppt/${target}`
        const mediaFile = zip.files[mediaPath]
        if (!mediaFile) continue

        const mediaData = await mediaFile.async('nodebuffer')
        const ext = path.extname(mediaFile.name).toLowerCase()
        if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) continue

        const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ecclesia-pptx-media-'))
        const mediaFileName = `slide${slideNumber}-${crypto.randomUUID().slice(0, 8)}${ext}`
        const tmpPath = path.join(tmpDir, mediaFileName)
        fs.writeFileSync(tmpPath, mediaData)
        images.push(tmpPath)
      }
    }

    results.push({ slideNumber, texts, images })
  }

  return { slides: results }
}

export interface PptxImportResult {
  slideMediaRecords: { id: number; filePath: string; thumbnail: string | null; width: number | null; height: number | null }[]
  slides: { id: string; type: 'MEDIA'; mediaId: number; items: { id: string; type: 'MEDIA' | 'TEXT'; accessData?: string; content?: string; layer: number }[] }[]
  presentationId: number
  originalName: string
}

export async function importPptxToPresentation(pptxPath: string): Promise<PptxImportResult> {
  const prisma = getPrisma()
  const originalName = path.basename(pptxPath, path.extname(pptxPath))
  const safeName = sanitizeFileName(originalName)
  const hiddenFolder = `__pptx/${safeName}`
  const { slides } = await parsePptxFile(pptxPath)

  const slideMediaRecords: PptxImportResult['slideMediaRecords'] = []
  const presentationSlides: PptxImportResult['slides'] = []

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const slideId = `slide-${i}`
    const items: PptxImportResult['slides'][0]['items'] = []
    let mediaId: number | undefined

    // Add images as MEDIA items
    for (let j = 0; j < slide.images.length; j++) {
      const imgPath = slide.images[j]
      const ext = path.extname(imgPath)
      const imgFileName = `${safeName}-slide${slide.slideNumber}-img${j}${ext}`
      const fileData = await importMediaFromSourcePath(imgPath, hiddenFolder, imgFileName)
      const media = await prisma.media.create({ data: fileData })
      mediaId = media.id
      slideMediaRecords.push({ id: media.id, filePath: media.filePath, thumbnail: media.thumbnail, width: media.width, height: media.height })
      items.push({
        id: `item-${i}-${j}`,
        type: 'MEDIA',
        accessData: String(media.id),
        layer: j,
      })
    }

    // Add text as TEXT items
    for (let j = 0; j < slide.texts.length; j++) {
      items.push({
        id: `item-${i}-text-${j}`,
        type: 'TEXT',
        content: slide.texts[j].content,
        layer: slide.images.length + j,
      })
    }

    presentationSlides.push({
      id: slideId,
      type: 'MEDIA',
      mediaId: mediaId ?? 0,
      items,
    })

    // Clean up temp image files
    slide.images.forEach((p) => {
      try { fs.rmSync(p, { force: true }) } catch { /* ignore */ }
      try { fs.rmSync(path.dirname(p), { recursive: true, force: true }) } catch { /* ignore */ }
    })
  }

  const presentation = await prisma.presentation.create({
    data: {
      title: `${PPTX_PRESENTATION_TITLE_PREFIX}${originalName}`,
      slides: JSON.stringify(presentationSlides),
    },
  })

  return {
    slideMediaRecords,
    slides: presentationSlides,
    presentationId: presentation.id,
    originalName,
  }
}
