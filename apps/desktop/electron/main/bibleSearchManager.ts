import { ipcMain, BrowserWindow } from 'electron'
import type { BibleSearchData } from './bibleSearchAPI'

function broadcastToAllWindows(event: string, data: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(event, data)
    }
  })
}

export function initializeBibleSearchManager(): void {
  ipcMain.on('bible-search', (_event, data: BibleSearchData) => {
    broadcastToAllWindows('bible-search', data)
  })
}
