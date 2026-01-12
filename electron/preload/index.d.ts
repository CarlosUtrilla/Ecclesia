import { ElectronAPI } from '@electron-toolkit/preload'
import { HandleManagers } from './index'

type HandleManagersType = typeof HandleManagers

declare global {
  interface Window extends ElectronAPI, HandleManagersType {}
}
