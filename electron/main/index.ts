import { app, shell, BrowserWindow, ipcMain, protocol } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerRoutes } from '../../database'
import { initPrisma } from './prisma'

import 'reflect-metadata'
import { authStore } from '../../database/stores/authStore'
import fs from 'fs'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../../app/assets/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  await initPrisma()
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  registerRoutes()
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  app.on('web-contents-created', (_event, contents) => {
    contents.on('destroyed', () => {
      const frameId = (contents.mainFrame as any)?.frameId
      if (frameId) {
        console.log(`🧹 Limpiando sesión para frameId ${frameId} desde main.ts`)
        authStore.clear(frameId)
      }
    })
  })

  //Protocolo seguro para cargar imagen en frontend
  protocol.handle('myapp', async (request) => {
    const userDataPath = app.getPath('userData')
    const imagesPath = path.join(userDataPath, 'images')
    const url = new URL(request.url)
    const fileName = url.pathname.slice(1) // quitar "/"
    const filePath = path.join(imagesPath, fileName)

    if (!fs.existsSync(filePath)) {
      return new Response('File not found', { status: 404 })
    }

    const buffer = await fs.promises.readFile(filePath)
    const uint8 = new Uint8Array(buffer) // ← Convertir a Uint8Array

    const ext = path.extname(filePath).toLowerCase()
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : 'application/octet-stream'

    return new Response(uint8, { headers: { 'Content-Type': mime } })
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
