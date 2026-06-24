import { invoke } from '@tauri-apps/api/core'
import { listen, emit } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile, stat } from '@tauri-apps/plugin-fs'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

type IpcListener = (event: unknown, ...args: unknown[]) => void

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
          listener(null, event.payload)
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
        emit(channel, args.length > 1 ? args : args[0] ?? null)
      },
      invoke(channel: string, ...args: unknown[]) {
        return invoke(channel, args[0] as Record<string, unknown>)
      },
    },
    getMemoryUsage: () => invoke<{ app_mb: number; sidecar_mb: number }>('get_memory_usage'),
    openOAuthWindow: (authUrl: string) => invoke('open_oauth_window', { authUrl }),
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
      invoke('close_app_windows')
    },
    cancelClose: () => {},
    skipSyncAndClose: () => {
      invoke('close_app_windows')
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
    getVersion: async (): Promise<string> => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app')
        return await getVersion()
      } catch {
        return '0.0.0'
      }
    },
    checkForUpdates: async () => {
      updateListeners.checking.forEach((cb) => cb())
      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (update) {
          updateListeners.available.forEach((cb) => cb({ version: update.version }))
          updaterCurrentUpdate = update
        } else {
          updateListeners.notAvailable.forEach((cb) => cb())
        }
      } catch (err: any) {
        updateListeners.error.forEach((cb) => cb(String(err?.message ?? 'Error desconocido')))
      }
    },
    downloadUpdate: async () => {
      if (!updaterCurrentUpdate) return
      try {
        await updaterCurrentUpdate.download((event) => {
          if (event.event === 'Progress') {
            const pct = event.data?.chunkLength ? Math.min(99, Math.round((event.data.chunkLength / (event.data.contentLength || 1)) * 100)) : 0
            updateListeners.progress.forEach((cb) => cb({ percent: pct }))
          }
        })
        updateListeners.downloaded.forEach((cb) => cb())
      } catch (err: any) {
        updateListeners.error.forEach((cb) => cb(String(err?.message ?? 'Error descargando')))
      }
    },
    installUpdate: async () => {
      if (!updaterCurrentUpdate) return
      try {
        await updaterCurrentUpdate.install()
      } catch { /* se reinicia la app */ }
    },
    onCheckingForUpdate: (cb: () => void) => addListener(updateListeners.checking, cb),
    onUpdateAvailable: (cb: (info: { version: string }) => void) => addListener(updateListeners.available, cb),
    onUpdateNotAvailable: (cb: () => void) => addListener(updateListeners.notAvailable, cb),
    onError: (cb: (msg: string) => void) => addListener(updateListeners.error, cb),
    onUpdateDownloaded: (cb: () => void) => addListener(updateListeners.downloaded, cb),
    onDownloadProgress: (cb: (progress: { percent: number }) => void) => addListener(updateListeners.progress, cb),
  }

  let updaterCurrentUpdate: { version: string; download: (cb: any) => Promise<void>; install: () => Promise<void> } | null = null

  const updateListeners: {
    checking: (() => void)[]
    available: ((info: { version: string }) => void)[]
    notAvailable: (() => void)[]
    error: ((msg: string) => void)[]
    downloaded: (() => void)[]
    progress: ((progress: { percent: number }) => void)[]
  } = { checking: [], available: [], notAvailable: [], error: [], downloaded: [], progress: [] }

  function addListener<T>(arr: T[], cb: T): () => void {
    arr.push(cb)
    return () => { const idx = arr.indexOf(cb); if (idx >= 0) arr.splice(idx, 1) }
  }

  const remoteControlAPIShim = {
    _connectionState: null as { url: string; port: number } | null,
    _callbacks: new Set<(state: { url: string; port: number } | null) => void>(),
    _init: false,
    _ensureInit() {
      if (this._init) return
      this._init = true
      listen<{ url: string; port: number } | null>('remote-connection-changed', (event) => {
        this._connectionState = event.payload
        this._callbacks.forEach((cb) => cb(event.payload))
      })
    },
    discoverLan: async (): Promise<unknown[]> => {
      try {
        const resp = await fetch('http://127.0.0.1:7777/api/remote/discover-lan')
        const data = await resp.json()
        return data?.response ?? []
      } catch {
        return []
      }
    },
    getConnectionState: (): Promise<{ url: string; port: number } | null> =>
      Promise.resolve(remoteControlAPIShim._connectionState),
    invalidateAllWindows: () => {
      emit('remote-connection-invalidate', true)
    },
    notifyConnectionChanged: (url: string, port: number) => {
      remoteControlAPIShim._connectionState = { url, port }
      emit('remote-connection-changed', { url, port })
    },
    notifyDisconnected: () => {
      remoteControlAPIShim._connectionState = null
      emit('remote-connection-changed', null)
    },
    onConnectionChanged: (callback: (state: { url: string; port: number } | null) => void) => {
      remoteControlAPIShim._ensureInit()
      remoteControlAPIShim._callbacks.add(callback)
      return () => {
        remoteControlAPIShim._callbacks.delete(callback)
      }
    },
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
