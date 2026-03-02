export type PresentationSlideType = 'TEXT' | 'BIBLE' | 'MEDIA'

export type PresentationSlideItemType = 'TEXT' | 'BIBLE' | 'SONG' | 'MEDIA' | 'GROUP'

export type PresentationItemAnimationSettings = {
  type?: string
  duration?: number
  delay?: number
  easing?: string
}

export type PresentationSlideItem = {
  id: string
  type: PresentationSlideItemType
  accessData?: string
  text?: string
  customStyle?: string
  layer?: number
  animationSettings?: string | PresentationItemAnimationSettings
}

export type PresentationSlideTextStyle = {
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
  letterSpacing?: number
  color?: string
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline'
  offsetX?: number
  offsetY?: number
  mediaWidth?: number
  mediaHeight?: number
}

export type PresentationSlide = {
  id: string
  items?: PresentationSlideItem[]
  type: PresentationSlideType
  text?: string
  mediaId?: number
  bible?: {
    bookId: number
    chapter: number
    verseStart: number
    verseEnd?: number
    version: string
  }
  textStyle?: PresentationSlideTextStyle
}

export type CreatePresentationDTO = {
  title: string
  slides: PresentationSlide[]
}

export type UpdatePresentationDTO = CreatePresentationDTO

export type GetPresentationsDTO = {
  search?: string
}

export type PresentationResponseDTO = {
  id: number
  title: string
  slides: PresentationSlide[]
  createdAt: Date
  updatedAt: Date
}
