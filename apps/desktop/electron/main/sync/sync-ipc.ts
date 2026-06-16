import { ipcMain } from 'electron'
import {
  syncStatus,
  syncConfigure,
  syncConnect,
  syncDisconnect,
  syncPush,
  syncPull,
  syncReconcile,
  syncGetRemoteData,
  syncDiagnose,
  syncHeal,
  syncCleanupMedia,
  syncGetAuthUrl,
  syncSetOAuthToken
} from '../syncBridge'

let notifySyncStateToRenderers: ((syncing: boolean, progress?: number, error?: string) => void) | null = null

export function setNotifySyncState(fn: typeof notifySyncStateToRenderers): void {
  notifySyncStateToRenderers = fn
}

function notifySyncState(syncing: boolean, progress = 0, error?: string) {
  if (notifySyncStateToRenderers) {
    notifySyncStateToRenderers(syncing, progress, error)
  }
}

export function registerSyncIpcHandlers(): void {
  ipcMain.handle('sync:google-drive:status', async () => {
    return await syncStatus()
  })

  ipcMain.handle('sync:google-drive:configure', async (_event, config: unknown) => {
    return await syncConfigure(config as Record<string, unknown>)
  })

  ipcMain.handle('sync:google-drive:connect', async (_event, config: unknown) => {
    notifySyncState(true)
    try {
      const result = await syncConnect(config as Record<string, unknown>)
      return result
    } finally {
      notifySyncState(false)
    }
  })

  ipcMain.handle('sync:google-drive:disconnect', async () => {
    return await syncDisconnect()
  })

  ipcMain.handle('sync:google-drive:push', async () => {
    return await syncPush()
  })

  ipcMain.handle('sync:google-drive:pull', async () => {
    return await syncPull()
  })

  ipcMain.handle('sync:google-drive:reconcile', async () => {
    notifySyncState(true)
    try {
      return await syncReconcile()
    } finally {
      notifySyncState(false)
    }
  })

  ipcMain.handle('sync:google-drive:remote-data', async () => {
    return await syncGetRemoteData()
  })

  ipcMain.handle('sync:google-drive:diagnose', async () => {
    notifySyncState(true, 10)
    try {
      return await syncDiagnose()
    } finally {
      notifySyncState(false)
    }
  })

  ipcMain.handle('sync:google-drive:heal', async (_event, diagnostic: unknown) => {
    notifySyncState(true, 10)
    try {
      return await syncHeal(diagnostic)
    } finally {
      notifySyncState(false)
    }
  })

  ipcMain.handle('sync:google-drive:cleanup-media', async () => {
    notifySyncState(true, 10)
    try {
      return await syncCleanupMedia()
    } finally {
      notifySyncState(false)
    }
  })
}

export function getOrCreateAuthUrl(): Promise<string> {
  return syncGetAuthUrl() as Promise<string>
}

export function exchangeOAuthCode(code: string): Promise<unknown> {
  return syncSetOAuthToken({ code })
}
