export type IpcListener = (event: unknown, ...args: unknown[]) => void
export type IpcTypedListener<T = unknown> = (event: unknown, data: T) => void

export type MemoryUsage = {
  app_mb: number
  sidecar_mb: number
}

export type PlatformBridgeShape = {
  ipcRenderer: {
    on: <T = unknown>(channel: string, listener: IpcTypedListener<T>) => () => void
    send: (channel: string, ...args: unknown[]) => void
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  }
  getMemoryUsage: () => Promise<MemoryUsage>
  openOAuthWindow: (authUrl: string) => Promise<void>
}

function getBridge(): PlatformBridgeShape {
  if (typeof window === 'undefined') {
    throw new Error(
      '[PlatformBridge] No hay objeto window. ¿Estás corriendo fuera del renderer?'
    )
  }

  const electron = (window as unknown as { electron?: Partial<PlatformBridgeShape> }).electron
  if (!electron) {
    throw new Error(
      '[PlatformBridge] window.electron no está disponible. Asegurate de correr la app desde Tauri o Electron.'
    )
  }

  return {
    ipcRenderer: {
      on: (channel, listener) => {
        if (!electron.ipcRenderer?.on) {
          throw new Error(
            `[PlatformBridge] window.electron.ipcRenderer.on no está disponible. Canal: ${channel}`
          )
        }
        return electron.ipcRenderer.on(channel, listener as IpcListener)
      },
      send: (channel, ...args) => {
        if (!electron.ipcRenderer?.send) {
          throw new Error(
            `[PlatformBridge] window.electron.ipcRenderer.send no está disponible. Canal: ${channel}`
          )
        }
        return electron.ipcRenderer.send(channel, ...args)
      },
      invoke: (channel, ...args) => {
        if (!electron.ipcRenderer?.invoke) {
          throw new Error(
            `[PlatformBridge] window.electron.ipcRenderer.invoke no está disponible. Canal: ${channel}`
          )
        }
        return electron.ipcRenderer.invoke(channel, ...args) as Promise<unknown>
      }
    },
    getMemoryUsage: () => {
      if (!electron.getMemoryUsage) {
        throw new Error('[PlatformBridge] window.electron.getMemoryUsage no está disponible.')
      }
      return electron.getMemoryUsage()
    },
    openOAuthWindow: (authUrl) => {
      if (!electron.openOAuthWindow) {
        throw new Error(
          '[PlatformBridge] window.electron.openOAuthWindow no está disponible. ¿Olvidaste registrar el comando de Tauri?'
        )
      }
      return electron.openOAuthWindow(authUrl)
    }
  }
}

export type TauriEventListener<T = unknown> = (payload: T) => void

export const platformBridge = {
  ipcRenderer: {
    on: <T = unknown>(channel: string, listener: IpcTypedListener<T>) =>
      getBridge().ipcRenderer.on(channel, listener),
    send: (channel: string, ...args: unknown[]) =>
      getBridge().ipcRenderer.send(channel, ...args),
    invoke: (channel: string, ...args: unknown[]) =>
      getBridge().ipcRenderer.invoke(channel, ...args)
  },
  getMemoryUsage: () => getBridge().getMemoryUsage(),
  openOAuthWindow: (authUrl: string) => getBridge().openOAuthWindow(authUrl),
  /**
   * Escucha un evento nativo de Tauri. En Electron o entornos sin Tauri retorna un cleanup no-op.
   * Usar exclusivamente para eventos que emite el main process de Tauri (ej. oauthCodeCaptured).
   */
  listen: async <T = unknown>(
    event: string,
    callback: TauriEventListener<T>
  ): Promise<() => void> => {
    if (typeof window === 'undefined' || !isTauriOAuthAvailable()) {
      return () => {}
    }
    try {
      const { listen } = await import('@tauri-apps/api/event')
      return await listen(event, (event) => {
        callback(event.payload as T)
      })
    } catch (error) {
      console.warn(`[PlatformBridge] No se pudo escuchar el evento ${event}:`, error)
      return () => {}
    }
  }
}

export function isTauriOAuthAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!((window as unknown as { electron?: Partial<PlatformBridgeShape> }).electron?.openOAuthWindow)
  )
}
