import { ThemeWithMedia } from 'database/controllers/themes/themes.dto'

export { ThemeWithMedia }
export type PresentationViewProps = {
  maxHeight?: number
  theme: ThemeWithMedia
  live?: boolean
  currentIndex?: number
  items: PresentationViewItems[]
  onClick?: () => void
  selected?: boolean
  tagSongId?: number | null
  className?: string
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
}

export type ScreenSize = { width: number; height: number; aspectRatio: string }
