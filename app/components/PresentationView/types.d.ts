import { Themes } from '@prisma/client'

export type PresentationViewsItemsProps = {
  text: string
  preview?: boolean
  screenSize: ScreenSize
  theme: Themes
  live?: boolean
}

export type PresentationViewProps = {
  maxHeight?: number
  preview?: boolean
  theme: Themes
  live?: boolean
  items: {
    text: string
    customStyle?: string
  }[]
}

export type ScreenSize = { width: number; height: number; aspectRatio: string }
