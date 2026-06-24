import { ElectronAPI } from '@electron-toolkit/preload'
import { HandleManagers } from './electron/preload/index'

type HandleManagersType = typeof HandleManagers

declare module '@electron-toolkit/preload' {
  interface ElectronAPI {
    openOAuthWindow?: (authUrl: string) => Promise<void>
    getMemoryUsage?: () => Promise<{ app_mb: number; sidecar_mb: number }>
  }
}

declare global {
  interface Window extends ElectronAPI, HandleManagersType {}
  interface BigInt {
    toJSON(): number | string
  }
}
