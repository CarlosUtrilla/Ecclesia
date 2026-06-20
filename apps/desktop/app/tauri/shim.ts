import { invoke } from '@tauri-apps/api/core'
import { listen, emit } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile, stat } from '@tauri-apps/plugin-fs'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

type IpcListener = (...args: unknown[]) => void

type DisplayInfoTauri = {
  id: number
  name: string
  width: number
  height: number
  x: number
  y: number
  is_primary: boolean
  scale_factor: number
}

type DisplayInfoElectron = {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  workArea: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  rotation: number
  internal: boolean
  aspectRatio: number
  isMain: boolean
}

function toElectronDisplay(d: DisplayInfoTauri): DisplayInfoElectron {
  return {
    id: d.id,
    label: d.name,
    bounds: { x: d.x, y: d.y, width: d.width, height: d.height },
    workArea: { x: d.x, y: d.y, width: d.width, height: d.height },
    scaleFactor: d.scale_factor,
    rotation: 0,
    internal: false,
    aspectRatio: d.width / d.height,
    isMain: d.is_primary,
  }
}

const needsShim = typeof window !== 'undefined' && !('electron' in window)

if (needsShim) {
  let currentWindow: ReturnType<typeof getCurrentWebviewWindow> | null = null
  try {
    currentWindow = getCurrentWebviewWindow()
  } catch (e) {
    console.warn('[Tauri Shim] getCurrentWebviewWindow() failed:', e)
  }
  const ipcListeners = new Map<string, Set<(...args: unknown[]) => void>>()

  const electronShim = {
    ipcRenderer: {
      on(channel: string, listener: IpcListener) {
        let cleanup: (() => void) | null = null
        listen(channel, (event) => {
          listener(event.payload)
        }).then((unlisten) => {
          cleanup = unlisten
        })
        if (!ipcListeners.has(channel)) {
          ipcListeners.set(channel, new Set())
        }
        ipcListeners.get(channel)!.add(listener)
        return () => {
          cleanup?.()
          ipcListeners.get(channel)?.delete(listener)
        }
      },
      send(channel: string, ...args: unknown[]) {
        emit(channel, args[0])
      },
      invoke(channel: string, ...args: unknown[]) {
        return invoke(channel, args[0] as Record<string, unknown>)
      },
    },
    getMemoryUsage: () => invoke<{ app_mb: number; sidecar_mb: number }>('get_memory_usage'),
  }

  const displayAPIShim = {
    getDisplays: (): Promise<DisplayInfoElectron[]> =>
      invoke<DisplayInfoTauri[]>('get_displays').then((displays) =>
        displays.map(toElectronDisplay),
      ),
    showLiveScreen: (displayId: number): Promise<number> =>
      invoke<DisplayInfoTauri[]>('get_displays').then((displays) => {
        const display = displays.find((d) => d.id === displayId)
        if (!display) throw new Error(`Display ${displayId} not found`)
        return invoke<number>('open_live_window', { display })
      }),
    showStageScreen: (displayId: number): Promise<number> =>
      invoke<DisplayInfoTauri[]>('get_displays').then((displays) => {
        const display = displays.find((d) => d.id === displayId)
        if (!display) throw new Error(`Display ${displayId} not found`)
        return invoke<number>('open_stage_window', { display })
      }),
    closeLiveScreen: (windowId: number): Promise<boolean> =>
      invoke<boolean>('close_screen_window', { label: `live-${windowId}` }),
    closeStageScreen: (windowId: number): Promise<boolean> =>
      invoke<boolean>('close_screen_window', { label: `stage-${windowId}` }),
    closeAllScreens: (): Promise<void> => invoke('close_all_screens'),
    showNewDisplayConnected: (): Promise<void> => {
      emit('open-new-display-connected', true)
      return Promise.resolve()
    },
    updateLiveScreenContent: (data: unknown) => {
      emit('liveScreen-update', data)
    },
    updateLiveScreenTheme: (theme: unknown) => {
      emit('liveScreen-update-theme', theme)
    },
    updateStageScreenConfig: (data: unknown) => {
      emit('stageScreen-config-update', data)
    },
  }

  const windowAPIShim = {
    openSongWindow: (songId?: number) =>
      invoke('open_song_editor', { songId: String(songId ?? '') }),
    openThemeWindow: (themeId?: number) =>
      invoke('open_theme_editor', { themeId: String(themeId ?? '') }),
    openPresentationWindow: (presentationId?: number) =>
      invoke('open_presentation_window', {
        presentationId: String(presentationId ?? ''),
      }),
    openTagSongsWindow: () => invoke('open_tag_songs_window'),
    openSettingsWindow: () => invoke('open_settings_window'),
    openStageControlWindow: () => invoke('open_stage_control_window'),
    closeCurrentWindow: async () => {
      await currentWindow?.close()
    },
    confirmClose: () => {
      currentWindow?.close()
    },
    cancelClose: () => {},
    skipSyncAndClose: () => {
      currentWindow?.close()
    },
    confirmThemeClose: () => {
      currentWindow?.close()
    },
    confirmPresentationClose: () => {
      currentWindow?.close()
    },
    triggerClose: () => {
      currentWindow?.close()
    },
  }

  const mediaAPIShim = {
    selectFiles: async (
      type: string,
    ): Promise<{ fileName: string; bytes: Uint8Array; fileSize: number }[]> => {
      const filters: Record<string, string[]> = {
        image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
        video: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
        audio: ['mp3', 'wav', 'ogg', 'm4a'],
        all: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'mov', 'mp3', 'wav'],
      }
      const filterExt = filters[type] ?? filters.all
      const selected = await open({
        multiple: true,
        filters: [{ name: type, extensions: filterExt }],
      })
      if (!selected) return []
      const paths = Array.isArray(selected) ? selected : [selected]
      const results = []
      for (const p of paths) {
        try {
          const fileStats = await stat(p)
          const contents = await readFile(p)
          results.push({
            fileName: p.split('/').pop() ?? p,
            bytes: contents,
            fileSize: Number(fileStats.size),
          })
        } catch (err) {
          console.error(`[shim] Failed to read file ${p}:`, err)
        }
      }
      return results
    },
    getPathForFile: (_file: File): string => {
      return ''
    },
    selectBibleFiles: async (): Promise<
      { fileName: string; bytes: Uint8Array; fileSize: number }[]
    > => {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Bible', extensions: ['ebbl'] }],
      })
      if (!selected) return []
      const paths = Array.isArray(selected) ? selected : [selected]
      const results = []
      for (const p of paths) {
        try {
          const fileStats = await stat(p)
          const contents = await readFile(p)
          results.push({
            fileName: p.split('/').pop() ?? p,
            bytes: contents,
            fileSize: Number(fileStats.size),
          })
        } catch (err) {
          console.error(`[shim] Failed to read bible file ${p}:`, err)
        }
      }
      return results
    },
    getServerPort: (): Promise<number> => Promise.resolve(7777),
  }

  const updaterAPIShim = {
    getVersion: (): Promise<string> => Promise.resolve('0.14.2'),
    checkForUpdates: () => {},
    downloadUpdate: () => {},
    installUpdate: () => {},
    onUpdateAvailable: () => () => {},
    onUpdateDownloaded: () => () => {},
    onDownloadProgress: () => () => {},
  }

  const remoteControlAPIShim = {
    discoverLan: (): Promise<unknown[]> => Promise.resolve([]),
    getConnectionState: (): Promise<{ url: string; port: number } | null> => Promise.resolve(null),
    invalidateAllWindows: () => {},
    onConnectionChanged: (_callback: (state: unknown) => void) => () => {},
    notifyConnectionChanged: (_url: string, _port: number) => {},
    notifyDisconnected: () => {},
  }

  Object.assign(window, {
    electron: electronShim,
    displayAPI: displayAPIShim,
    windowAPI: windowAPIShim,
    mediaAPI: mediaAPIShim,
    updaterAPI: updaterAPIShim,
    remoteControlAPI: remoteControlAPIShim,
  })
}
