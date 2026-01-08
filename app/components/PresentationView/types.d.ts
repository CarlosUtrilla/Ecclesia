import { Themes, Media } from '@prisma/client'

export type ThemeWithMedia = Themes & {
  backgroundMedia?: Media | null
}

export type PresentationViewsItemsProps = {
  text: string
  preview?: boolean
  screenSize: ScreenSize
  theme: ThemeWithMedia
  live?: boolean
}

export type PresentationViewProps = {
  maxHeight?: number
  preview?: boolean
  theme: ThemeWithMedia
  live?: boolean
  items: {
    text: string
    customStyle?: string
  }[]
}

export type ScreenSize = { width: number; height: number; aspectRatio: string }
