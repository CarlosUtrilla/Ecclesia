import { ScheduleItemType } from '@prisma/client'
import { ThemeWithMedia } from 'database/controllers/themes/themes.dto'

export { ThemeWithMedia }

export type TextBoundsValues = {
  paddingInline: number
  paddingBlock: number
  translateX: number
  translateY: number
}

export type EditableBoundsTarget = 'text' | 'verse'

export type PresentationViewProps = {
  maxHeight?: number
  presentationHeight?: number
  theme: ThemeWithMedia
  live?: boolean
  currentIndex?: number
  presentationVerseBySlideKey?: Record<string, number>
  themeTransitionKey?: number
  hideTextInLive?: boolean
  items: PresentationViewItems[]
  onClick?: (e?: React.MouseEvent) => void
  selected?: boolean
  tagSongId?: number | null
  className?: string
  displayId?: number
  customAspectRatio?: string
  style?: React.CSSProperties
  showTextBounds?: boolean
  textBoundsIsSelected?: boolean
  bibleVerseIsSelected?: boolean
  onTextBoundsChange?: (next: TextBoundsValues) => void
  onBibleVersePositionChange?: (next: number) => void
  onEditableTargetSelect?: (target: EditableBoundsTarget) => void
}

export type PresentationViewItems = {
  id?: string
  text: string
  theme?: ThemeWithMedia
  videoLiveBehavior?: 'auto' | 'manual'
  customStyle?: string
  animationSettings?: string
  transitionSettings?: string
  layer?: number
  media?: {
    id: number
    name: string
    type: 'IMAGE' | 'VIDEO'
    filePath: string
    duration?: number | null
    thumbnail?: string | null
    format?: string
  }
  presentationItems?: PresentationLayerItem[]
  verse?: {
    bookId: number
    chapter: number
    verse: number
    verseEnd?: number
    version: string
  }
  resourceType: ScheduleItemType | 'TEXT'
}

export type PresentationLayerItem = {
  id: string
  text: string
  customStyle?: string
  animationSettings?: string
  layer?: number
  media?: PresentationViewItems['media']
  verse?: PresentationViewItems['verse']
  resourceType: ScheduleItemType | 'TEXT'
}

export type ScreenSize = { width: number; height: number; aspectRatio: string }
