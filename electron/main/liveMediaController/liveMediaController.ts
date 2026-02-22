import { ipcMain, BrowserWindow } from 'electron'

/**
 * Manager de media en vivo
 * Todos los managers deben:
 * - Tener función de inicialización (initializeXManager)
 * - Registrar handlers IPC en esa función
 * - Ser importados y llamados en main/index.ts
 * - Documentar canal y propósito en agents.md
 */
export function initializeLiveMediaManager() {
  ipcMain.on('live-media-state', (_event, state) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('live-media-state', state)
    })
  })
}
