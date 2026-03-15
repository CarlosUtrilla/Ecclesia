import { getPrisma } from '../../../electron/main/prisma'
import type {
  CreatePresentationDTO,
  GetPresentationsDTO,
  PresentationResponseDTO,
  UpdatePresentationDTO
} from './presentations.dto'

export class PresentationsService {
  private readonly defaultTransitionSettings =
    '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}'

  private prisma = getPrisma()

  private buildLegacyStyleFromSlide(slide: any): string {
    if (!slide?.textStyle) return ''

    const styles: string[] = []
    if (slide.textStyle.fontSize) styles.push(`font-size: ${slide.textStyle.fontSize}px`)
    if (slide.textStyle.fontFamily) styles.push(`font-family: ${slide.textStyle.fontFamily}`)
    if (slide.textStyle.lineHeight) styles.push(`line-height: ${slide.textStyle.lineHeight}`)
    if (slide.textStyle.letterSpacing !== undefined) {
      styles.push(`letter-spacing: ${slide.textStyle.letterSpacing}px`)
    }
    if (slide.textStyle.color) styles.push(`color: ${slide.textStyle.color}`)
    if (slide.textStyle.textAlign) styles.push(`text-align: ${slide.textStyle.textAlign}`)
    if (slide.textStyle.fontWeight) styles.push(`font-weight: ${slide.textStyle.fontWeight}`)
    if (slide.textStyle.fontStyle) styles.push(`font-style: ${slide.textStyle.fontStyle}`)
    if (slide.textStyle.textDecoration) {
      styles.push(`text-decoration: ${slide.textStyle.textDecoration}`)
    }

    const offsetX = Number(slide.textStyle.offsetX || 0)
    const offsetY = Number(slide.textStyle.offsetY || 0)
    if (offsetX !== 0 || offsetY !== 0) {
      styles.push(`transform: translate(${offsetX}px, ${offsetY}px)`)
    }

    return styles.join('; ')
  }

  private buildLegacyItemFromSlide(slide: any, index: number) {
    const common = {
      id: `legacy-item-${slide?.id || index}`,
      layer: 0,
      customStyle: this.buildLegacyStyleFromSlide(slide)
    }

    if (slide?.type === 'MEDIA') {
      return {
        ...common,
        type: 'MEDIA',
        accessData: String(slide.mediaId || '')
      }
    }

    if (slide?.type === 'BIBLE') {
      const bible = slide.bible || {}
      const verseRange = bible.verseEnd
        ? `${bible.verseStart}-${bible.verseEnd}`
        : `${bible.verseStart}`
      return {
        ...common,
        type: 'BIBLE',
        text: slide.text || '',
        accessData: `${bible.bookId || 1},${bible.chapter || 1},${verseRange},${bible.version || 'RVR1960'}`
      }
    }

    return {
      ...common,
      type: 'TEXT',
      text: slide?.text || ''
    }
  }

  private buildLegacyShapeFromItem(item: any) {
    if (item?.type === 'MEDIA') {
      return {
        type: 'MEDIA',
        text: '',
        mediaId: Number(item.accessData || 0) || undefined
      }
    }

    if (item?.type === 'BIBLE') {
      const [bookRaw, chapterRaw, verseRangeRaw, versionRaw] = String(item.accessData || '').split(
        ','
      )
      const [verseStartRaw, verseEndRaw] = String(verseRangeRaw || '').split('-')

      return {
        type: 'BIBLE',
        text: item.text || '',
        bible: {
          bookId: Number(bookRaw || 1),
          chapter: Number(chapterRaw || 1),
          verseStart: Number(verseStartRaw || 1),
          verseEnd: verseEndRaw ? Number(verseEndRaw) : undefined,
          version: versionRaw || 'RVR1960'
        }
      }
    }

    return {
      type: 'TEXT',
      text: item?.text || ''
    }
  }

  private normalizeSlides(rawSlides: unknown): PresentationResponseDTO['slides'] {
    const parsedSlides = Array.isArray(rawSlides) ? rawSlides : []

    return parsedSlides.map((slide: any, index) => {
      const normalizedItems = Array.isArray(slide?.items)
        ? slide.items.map((item: any, itemIndex: number) => ({
            id: item?.id || `item-${index}-${itemIndex}`,
            type: item?.type || 'TEXT',
            accessData: item?.accessData,
            text: item?.text,
            customStyle: item?.customStyle,
            layer: Number(item?.layer || 0),
            animationSettings: item?.animationSettings
          }))
        : [this.buildLegacyItemFromSlide(slide, index)]

      const firstItem = normalizedItems[0]

      return {
        id: slide?.id || `slide-${index}`,
        slideName:
          typeof slide?.slideName === 'string' && slide.slideName.trim().length > 0
            ? slide.slideName.trim()
            : undefined,
        themeId:
          slide?.themeId === null || slide?.themeId === undefined
            ? null
            : Number(slide.themeId) || null,
        canvaSourceKey:
          typeof slide?.canvaSourceKey === 'string' && slide.canvaSourceKey.trim().length > 0
            ? slide.canvaSourceKey.trim()
            : undefined,
        canvaSlideNumber:
          Number.isInteger(slide?.canvaSlideNumber) && Number(slide.canvaSlideNumber) > 0
            ? Number(slide.canvaSlideNumber)
            : undefined,
        transitionSettings: slide?.transitionSettings || this.defaultTransitionSettings,
        videoLiveBehavior: slide?.videoLiveBehavior === 'auto' ? 'auto' : 'manual',
        items: normalizedItems,
        ...this.buildLegacyShapeFromItem(firstItem),
        textStyle: slide?.textStyle
      }
    }) as PresentationResponseDTO['slides']
  }

  private normalizePresentation(record: {
    id: number
    title: string
    slides: string
    createdAt: Date
    updatedAt: Date
  }): PresentationResponseDTO {
    const parsedSlides = JSON.parse(record.slides)

    return {
      ...record,
      slides: this.normalizeSlides(parsedSlides)
    }
  }

  private normalizeSlidesForPersistence(slides: unknown): PresentationResponseDTO['slides'] {
    return this.normalizeSlides(slides)
  }

  async createPresentation(data: CreatePresentationDTO): Promise<PresentationResponseDTO> {
    const presentation = await this.prisma.presentation.create({
      data: {
        title: data.title,
        slides: JSON.stringify(this.normalizeSlidesForPersistence(data.slides))
      }
    })

    return this.normalizePresentation(presentation)
  }

  async getPresentations(params?: GetPresentationsDTO): Promise<PresentationResponseDTO[]> {
    const presentations = await this.prisma.presentation.findMany({
      where: params?.search
        ? {
            deletedAt: null,
            title: { contains: params.search }
          }
        : { deletedAt: null },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    return presentations.map((presentation) => this.normalizePresentation(presentation))
  }

  async getPresentationById(id: number): Promise<PresentationResponseDTO | null> {
    const presentation = await this.prisma.presentation.findFirst({ where: { id, deletedAt: null } })

    if (!presentation) return null

    return this.normalizePresentation(presentation)
  }

  async getPresentationsByIds(ids: number[]): Promise<PresentationResponseDTO[]> {
    const presentations = await this.prisma.presentation.findMany({
      where: { deletedAt: null, id: { in: ids } }
    })

    return presentations.map((presentation) => this.normalizePresentation(presentation))
  }

  async updatePresentation(
    id: number,
    data: UpdatePresentationDTO
  ): Promise<PresentationResponseDTO> {
    const updated = await this.prisma.presentation.update({
      where: { id },
      data: {
        title: data.title,
        slides: JSON.stringify(this.normalizeSlidesForPersistence(data.slides))
      }
    })

    return this.normalizePresentation(updated)
  }

  async deletePresentation(id: number): Promise<void> {
    await this.prisma.presentation.update({ where: { id }, data: { deletedAt: new Date() } })
  }
}
