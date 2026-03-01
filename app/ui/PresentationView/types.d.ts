import { ScheduleItemType } from '@prisma/client'
import { ThemeWithMedia } from 'database/controllers/themes/themes.dto'

export { ThemeWithMedia }
export type PresentationViewProps = {
  maxHeight?: number
  theme: ThemeWithMedia
  live?: boolean
  currentIndex?: number
  items: PresentationViewItems[]
  onClick?: (e?: React.MouseEvent) => void
  selected?: boolean
  tagSongId?: number | null
  className?: string
  displayId?: number
  style?: React.CSSProperties
  showTextBounds?: boolean
}

export type PresentationViewItems = {
  text: string
  customStyle?: string
  verse?: {
    bookId: number
    chapter: number
    verse: number
    version: string
  }
  resourceType: ScheduleItemType
}

export type ScreenSize = { width: number; height: number; aspectRatio: string }
