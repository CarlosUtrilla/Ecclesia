import { Themes, Media, BiblePresentationSettings } from '@prisma/client'

export type ThemeWithMedia = Themes & {
  backgroundMedia?: Media | null
  biblePresentationSettings: BiblePresentationSettings | null
}

export type PresentationViewProps = {
  maxHeight?: number
  theme: ThemeWithMedia
  live?: boolean
  currentIndex?: number
  items: PresentationViewItems[]
  onClick?: () => void
  selected?: boolean
  tagSongId?: number | null
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
