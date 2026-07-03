import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron'

export function onIpc(channel: string, handler: (...args: any[]) => void): void {
  ipcMain.on(channel, (_event, ...args) => handler(...args))
}

export function handleIpc<T>(channel: string, handler: (...args: any[]) => T | Promise<T>): void {
  ipcMain.handle(channel, (_event: IpcMainInvokeEvent, ...args: any[]) => handler(...args))
}

export function onIpcFromWindow(
  channel: string,
  handler: (win: BrowserWindow, ...args: any[]) => void
): void {
  ipcMain.on(channel, (event, ...args) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) handler(win, ...args)
  })
}
