import { ElectronAPI } from '@electron-toolkit/preload'

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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    windowAPI: {
      openSongWindow: (songId?: number) => void
      openThemeWindow: (themeId?: number) => void
    }
    systemAPI: {
      getSystemFonts: () => Promise<string[]>
      getDisplays: () => Promise<DisplayInfo[]>
    }
  }
}
