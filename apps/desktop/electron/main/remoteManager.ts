import { ipcMain, BrowserWindow } from 'electron'
import Logger from 'electron-log'
import { initializeUdpDiscovery, discoverLanDevices } from '@ecclesia/api/src/services/udp-discovery.service'

let currentRemoteUrl: string | null = null
let currentRemotePort: number | null = null

function broadcastToAllWindows(event: string, data: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(event, data)
    }
  })
}

export function initializeRemoteManager() {
  initializeUdpDiscovery()

  ipcMain.handle('remote:discover-lan', async () => {
    return await discoverLanDevices()
  })

  ipcMain.on('remote:state-changed', (_event, state: { url: string; port: number }) => {
    currentRemoteUrl = state.url
    currentRemotePort = state.port
    broadcastToAllWindows('remote:connection-changed', { url: state.url, port: state.port })
  })

  ipcMain.on('remote:disconnected', () => {
    currentRemoteUrl = null
    currentRemotePort = null
    broadcastToAllWindows('remote:connection-changed', null)
  })

  ipcMain.handle('remote:get-connection-state', () => {
    if (currentRemoteUrl && currentRemotePort) {
      return { url: currentRemoteUrl, port: currentRemotePort }
    }
    return null
  })

  ipcMain.on('remote:invalidate-all-windows', () => {
    broadcastToAllWindows('invalidate-queries', undefined)
  })
}

export function getCurrentRemoteState(): { url: string; port: number } | null {
  if (currentRemoteUrl && currentRemotePort) {
    return { url: currentRemoteUrl, port: currentRemotePort }
  }
  return null
}
