import { ElectronAPI } from '@electron-toolkit/preload'
import { HandleManagers } from './electron/preload/index'

type HandleManagersType = typeof HandleManagers

declare global {
  interface Window extends ElectronAPI, HandleManagersType {}
  interface BigInt {
    toJSON(): number | string
  }
}
