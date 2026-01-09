import { Themes, Media } from '@prisma/client'

export type ThemeWithMedia = Themes & {
  backgroundMedia?: Media | null
}

export type PresentationViewProps = {
  maxHeight?: number
  preview?: boolean
  theme: ThemeWithMedia
  live?: boolean
  currentIndex?: number
  items: PresentationViewItems[]
  onClick?: () => void
  selected?: boolean
}

export type PresentationViewItems = {
  text: string
  customStyle?: string
}

export type ScreenSize = { width: number; height: number; aspectRatio: string }
