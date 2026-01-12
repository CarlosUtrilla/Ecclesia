import { ElectronAPI } from '@electron-toolkit/preload'
import { HandleManagers } from './index'

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

type HandleManagersType = typeof HandleManagers

declare global {
  interface Window extends ElectronAPI, HandleManagersType {}
}
