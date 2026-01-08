import { app, BrowserWindow, ipcMain, protocol, screen } from 'electron'
import path from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerRoutes } from '../../database'
import { initPrisma } from './prisma'
import { createMainWindow, createSongWindow, createThemeWindow } from './windowManager'
import { registerMediaHandlers } from './mediaHandlers'

import 'reflect-metadata'
import { authStore } from '../../database/stores/authStore'
import fs from 'fs'
import fontList from 'font-list'

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

  // Registrar handlers de medios
  registerMediaHandlers()

  // Obtener fuentes del sistema
  ipcMain.handle('get-system-fonts', async () => {
    try {
      const fonts = await fontList.getFonts()
      return fonts
    } catch (error) {
      console.error('Error al obtener fuentes del sistema:', error)
      return []
    }
  })

  // Obtener todas las pantallas disponibles
  ipcMain.handle('get-displays', () => {
    const displays = screen.getAllDisplays()
    return displays.map((display) => ({
      id: display.id,
      label: display.label || `Display ${display.id}`,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      internal: display.internal,
      aspectRatio: display.bounds.width / display.bounds.height
    }))
  })

  // Abrir ventana para crear/editar canción
  ipcMain.on('open-song-window', (_event, songId?: number) => {
    createSongWindow(songId)
  })

  // Abrir ventana para crear/editar tema
  ipcMain.on('open-theme-window', (_event, themeId?: number) => {
    createThemeWindow(themeId)
  })

  registerRoutes()
  createMainWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })

  app.on('web-contents-created', (_event, contents) => {
    // Capturar el frameId ANTES de que se destruya
    const frameId = (contents.mainFrame as any)?.frameId

    contents.on('destroyed', () => {
      if (frameId) {
        console.log(`🧹 Limpiando sesión para frameId ${frameId} desde main.ts`)
        authStore.clear(frameId)
      }
    })
  })

  //Protocolo seguro para cargar medios en frontend
  protocol.handle('myapp', async (request) => {
    const userDataPath = app.getPath('userData')
    const url = new URL(request.url)
    const encodedFileName = url.pathname.slice(1) // quitar "/"

    // Decodificar el nombre del archivo para manejar espacios y caracteres especiales
    const fileName = decodeURIComponent(encodedFileName)

    // Validar que fileName no esté vacío
    if (!fileName) {
      return new Response('Bad request: No filename provided', { status: 400 })
    }

    // Intentar primero en media/, luego en images/ para retrocompatibilidad
    const mediaPath = path.join(userDataPath, 'media', fileName)
    const imagePath = path.join(userDataPath, 'images', fileName)
    const filePath = fs.existsSync(mediaPath) ? mediaPath : imagePath

    if (!fs.existsSync(filePath)) {
      return new Response('File not found', { status: 404 })
    }

    // Verificar que sea un archivo, no un directorio
    const stats = await fs.promises.stat(filePath)
    if (!stats.isFile()) {
      return new Response('Not a file', { status: 400 })
    }

    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.ogg': 'video/ogg'
    }

    const mime = mimeTypes[ext] || 'application/octet-stream'

    // Para videos, soportar range requests
    const rangeHeader = request.headers.get('range')
    if (rangeHeader && mime.startsWith('video/')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1
      const chunksize = end - start + 1

      const buffer = Buffer.alloc(chunksize)
      const fd = await fs.promises.open(filePath, 'r')
      await fd.read(buffer, 0, chunksize, start)
      await fd.close()

      return new Response(buffer, {
        status: 206,
        headers: {
          'Content-Type': mime,
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString()
        }
      })
    }

    // Para imágenes u otros archivos, cargar completo
    const buffer = await fs.promises.readFile(filePath)
    const uint8 = new Uint8Array(buffer)

    return new Response(uint8, {
      headers: {
        'Content-Type': mime,
        'Content-Length': stats.size.toString(),
        'Accept-Ranges': 'bytes'
      }
    })
  })

  // Protocolo para cargar medios (imágenes y videos)
  protocol.handle('media', async (request) => {
    const userDataPath = app.getPath('userData')
    const mediaPath = path.join(userDataPath, 'media')
    const url = new URL(request.url)
    const fileName = url.pathname.slice(1) // quitar "/"
    const filePath = path.join(mediaPath, fileName)

    if (!fs.existsSync(filePath)) {
      return new Response('File not found', { status: 404 })
    }

    const buffer = await fs.promises.readFile(filePath)
    const uint8 = new Uint8Array(buffer)

    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo'
    }

    const mime = mimeTypes[ext] || 'application/octet-stream'

    return new Response(uint8, { headers: { 'Content-Type': mime } })
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
