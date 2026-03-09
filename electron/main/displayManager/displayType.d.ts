export interface DisplayInfo {
  id: number
  label: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  workArea: {
    x: number
    y: number
    width: number
    height: number
  }
  scaleFactor: number
  rotation: number
  internal: boolean
  aspectRatio: number
  isMain: boolean
}

export type ScreenContentUpdate = {
  itemIndex: number
  contentScreen: ContentScreen | null
  presentationVerseBySlideKey?: Record<string, number>
  liveControls?: {
    hideText?: boolean
    showLogo?: boolean
    blackScreen?: boolean
  }
}

export type StageScreenConfigUpdate = {
  selectedScreenId: number
}
