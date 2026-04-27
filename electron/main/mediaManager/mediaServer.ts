import { createServer, IncomingMessage, ServerResponse } from 'http'
import { app, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import log from 'electron-log'

let server: ReturnType<typeof createServer> | null = null
let serverPort = 0

export const mimeTypes: Record<string, string> = {
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

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const userDataPath = app.getPath('userData')

  // Decode URL y eliminar query params
  const urlPath = decodeURIComponent(req.url?.split('?')[0] || '')

  // Construir path completo y normalizar para Windows
  const filePath = path.normalize(path.join(userDataPath, 'media', urlPath.slice(1)))

  // Log de la petición para debugging (solo en development o cuando hay errores)
  const isVideo = urlPath.match(/\.(mp4|webm|mov|avi)$/i)
  if (isVideo) {
    log.info(`[mediaServer] Request: ${req.method} ${urlPath} (${path.basename(filePath)})`)
  }

  // Verificar que el archivo existe
  if (!fs.existsSync(filePath)) {
    log.warn(`[mediaServer] File not found: ${filePath}`)
    res.writeHead(404, {
      'Access-Control-Allow-Origin': '*'
    })
    res.end('Not found')
    return
  }

  // Verificar permisos de lectura antes de intentar servir
  try {
    fs.accessSync(filePath, fs.constants.R_OK)
  } catch (err) {
    log.error(`[mediaServer] Permission denied for file: ${filePath}`, err)
    res.writeHead(403, {
      'Access-Control-Allow-Origin': '*'
    })
    res.end('Permission denied')
    return
  }

  let stats: fs.Stats
  try {
    stats = fs.statSync(filePath)
  } catch (err) {
    log.error(`[mediaServer] Error getting file stats: ${filePath}`, err)
    res.writeHead(500, {
      'Access-Control-Allow-Origin': '*'
    })
    res.end('Internal server error')
    return
  }

  const ext = path.extname(filePath).toLowerCase()
  const mime = mimeTypes[ext] || 'application/octet-stream'

  // Manejar range requests para video
  const range = req.headers.range

  if (range && mime.startsWith('video/')) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1
    const chunksize = end - start + 1

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stats.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*'
    })

    const stream = fs.createReadStream(filePath, { start, end })
    
    stream.on('error', (err) => {
      log.error(`[mediaServer] Stream error for ${filePath}:`, err)
      if (!res.headersSent) {
        res.writeHead(500)
      }
      res.end()
    })
    
    stream.pipe(res)
  } else {
    // Servir archivo completo
    res.writeHead(200, {
      'Content-Length': stats.size,
      'Content-Type': mime,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*'
    })

    const stream = fs.createReadStream(filePath)
    
    stream.on('error', (err) => {
      log.error(`[mediaServer] Stream error for ${filePath}:`, err)
      if (!res.headersSent) {
        res.writeHead(500)
      }
      res.end()
    })
    
    stream.pipe(res)
  }
}

export function startMediaServer(): number {
  if (server) return serverPort

  server = createServer(handleRequest)

  // Escuchar en 0.0.0.0 para permitir conexiones desde la red local
  // Esto permitirá que apps móviles se conecten al servidor
  // Usar puerto 0 para asignar automáticamente un puerto disponible
  server.listen(0, '0.0.0.0', () => {
    const address = server!.address()
    if (address && typeof address === 'object') {
      serverPort = address.port
      console.log(`📡 Media server listening on port ${serverPort}`)
      console.log(`   Local: http://127.0.0.1:${serverPort}`)
      console.log(`   Network: http://<your-ip>:${serverPort}`)
    }
  })

  // Obtener puerto del servidor de medios
  ipcMain.handle('get-media-server-port', () => {
    return getMediaServerPort()
  })
  return serverPort
}

export function getMediaServerPort(): number {
  return serverPort
}

export function stopMediaServer() {
  if (server) {
    server.close()
    server = null
    serverPort = 0
  }
}
