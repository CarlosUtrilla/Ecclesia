import { ipcRenderer } from 'electron'

export type UpdateInfo = {
  version: string
  releaseDate: string
  releaseNotes?: string
}

export type DownloadProgress = {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

export const updaterAPI = {
  // Verificar actualizaciones manualmente
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),

  // Descargar la actualización disponible
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),

  // Instalar actualización descargada y reiniciar
  installUpdate: () => ipcRenderer.send('updater:install'),

  // Obtener versión actual
  getVersion: (): Promise<string> => ipcRenderer.invoke('updater:get-version'),

  // Escuchar evento: verificando actualizaciones
  onCheckingForUpdate: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('updater:checking-for-update', listener)
    return () => ipcRenderer.removeListener('updater:checking-for-update', listener)
  },

  // Escuchar evento: actualización disponible
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
    const listener = (_event: unknown, info: UpdateInfo) => callback(info)
    ipcRenderer.on('updater:update-available', listener)
    return () => ipcRenderer.removeListener('updater:update-available', listener)
  },

  // Escuchar evento: sin actualizaciones disponibles
  onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) => {
    const listener = (_event: unknown, info: UpdateInfo) => callback(info)
    ipcRenderer.on('updater:update-not-available', listener)
    return () => ipcRenderer.removeListener('updater:update-not-available', listener)
  },

  // Escuchar evento: error en actualización
  onError: (callback: (message: string) => void) => {
    const listener = (_event: unknown, message: string) => callback(message)
    ipcRenderer.on('updater:error', listener)
    return () => ipcRenderer.removeListener('updater:error', listener)
  },

  // Escuchar evento: progreso de descarga
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const listener = (_event: unknown, progress: DownloadProgress) => callback(progress)
    ipcRenderer.on('updater:download-progress', listener)
    return () => ipcRenderer.removeListener('updater:download-progress', listener)
  },

  // Escuchar evento: actualización descargada y lista para instalar
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => {
    const listener = (_event: unknown, info: UpdateInfo) => callback(info)
    ipcRenderer.on('updater:update-downloaded', listener)
    return () => ipcRenderer.removeListener('updater:update-downloaded', listener)
  }
}
