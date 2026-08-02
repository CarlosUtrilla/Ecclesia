import path from 'path'
import fs from 'fs'
import type { Express } from 'express'
import { getPrisma } from '../../prisma'
import { toStorageSettingKey } from '../settings/settingKeys'
import { DEFAULT_OBS_CONFIG, parseObsConfig, type ObsOverlayConfig } from './obsOverlayConfig'
import Logger from 'electron-log'

const OBS_CONFIG_STORAGE_KEY = toStorageSettingKey('OBS_TEXT_OVERLAY_CONFIG')

type SettingRow = { value: string }

async function loadObsConfig(): Promise<ObsOverlayConfig> {
  try {
    const prisma = getPrisma()
    const rows = await prisma.$queryRawUnsafe<SettingRow[]>(
      'SELECT value FROM Setting WHERE key = ? LIMIT 1',
      OBS_CONFIG_STORAGE_KEY
    )
    return parseObsConfig(rows[0]?.value)
  } catch (err) {
    Logger.error('[OBS] No se pudo cargar la config del overlay:', (err as Error)?.message)
    return DEFAULT_OBS_CONFIG
  }
}

async function resolveBackground(
  mediaId: number | null
): Promise<{ url: string; isVideo: boolean } | null> {
  if (mediaId == null) return null
  try {
    const prisma = getPrisma()
    const media = await prisma.media.findUnique({ where: { id: mediaId } })
    if (!media || media.deletedAt) return null
    return { url: `/media/${media.filePath}`, isVideo: media.type === 'VIDEO' }
  } catch {
    return null
  }
}

// Ruta al cliente de Socket.IO. El serveClient nativo de socket.io falla cuando el
// proceso main va empaquetado (no resuelve su client-dist), así que lo servimos aquí.
let socketIoClientPath: string | null | undefined
function resolveSocketIoClientPath(): string | null {
  if (socketIoClientPath !== undefined) return socketIoClientPath

  // El `exports` de socket.io bloquea require.resolve del subpath client-dist,
  // así que resolvemos el entry principal (exportado) y llegamos al fichero por ruta.
  const candidates: string[] = []
  const pkgFiles: Array<[string, string]> = [
    ['socket.io', path.join('client-dist', 'socket.io.min.js')],
    ['socket.io-client', path.join('dist', 'socket.io.min.js')]
  ]
  for (const [pkg, rel] of pkgFiles) {
    try {
      // require.resolve del entry → .../<pkg>/dist/index.js ; subimos a la raíz del paquete
      const entry = require.resolve(pkg)
      const marker = `${path.sep}${pkg.replace('/', path.sep)}${path.sep}`
      const rootIdx = entry.lastIndexOf(marker)
      const root =
        rootIdx >= 0 ? entry.slice(0, rootIdx + marker.length - 1) : path.dirname(path.dirname(entry))
      candidates.push(path.join(root, rel))
    } catch {
      // paquete no resoluble; probar siguiente
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      socketIoClientPath = candidate
      return candidate
    }
  }
  socketIoClientPath = null
  return null
}

let socketIoClientJs: string | null | undefined
function getSocketIoClientJs(): string | null {
  if (socketIoClientJs !== undefined) return socketIoClientJs
  const clientPath = resolveSocketIoClientPath()
  if (!clientPath) {
    socketIoClientJs = null
    return null
  }
  try {
    socketIoClientJs = fs.readFileSync(clientPath, 'utf8')
  } catch (err) {
    Logger.error('[OBS] No se pudo leer el cliente socket.io:', (err as Error)?.message)
    socketIoClientJs = null
  }
  return socketIoClientJs
}

/**
 * Registra las rutas de la salida de texto para OBS:
 * - GET /obs             → página HTML autocontenida (browser source de subtítulos)
 * - GET /obs/config      → JSON { config, backgroundImageUrl, backgroundVideoUrl }
 * - GET /obs/socket.io.js → cliente de Socket.IO (servido por nosotros)
 */
export function registerObsOverlayRoutes(app: Express) {
  app.get('/obs', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.send(OBS_OVERLAY_HTML)
  })

  app.get('/obs/socket.io.js', (_req, res) => {
    const clientJs = getSocketIoClientJs()
    if (!clientJs) {
      res.status(404).type('application/javascript').send('// socket.io client no encontrado')
      return
    }
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(clientJs)
  })

  app.get('/obs/config', async (_req, res) => {
    const config = await loadObsConfig()
    const background = await resolveBackground(config.backgroundMediaId)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.json({
      config,
      backgroundImageUrl: background && !background.isVideo ? background.url : null,
      backgroundVideoUrl: background && background.isVideo ? background.url : null
    })
  })
}

// Página autocontenida. El texto se inyecta con textContent (nunca innerHTML).
// Carga el cliente de Socket.IO servido automáticamente por el servidor.
const OBS_OVERLAY_HTML = /* html */ `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Ecclesia — Subtítulos OBS</title>
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    overflow: hidden;
    font-family: Arial, sans-serif;
  }
  #stage {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 4vh 0;
  }
  #stage[data-position="top"] { justify-content: flex-start; }
  #stage[data-position="center"] { justify-content: center; }
  #stage[data-position="bottom"] { justify-content: flex-end; }
  #stage[data-halign="left"] { align-items: flex-start; }
  #stage[data-halign="center"] { align-items: center; }
  #stage[data-halign="right"] { align-items: flex-end; }
  #box {
    position: relative;
    display: flex;
    box-sizing: border-box;
    max-width: 90%;
    border-radius: 0.4vh;
    line-height: 1.25;
    background-size: cover;
    background-position: center;
    overflow: hidden;
    transition: opacity 180ms ease;
    opacity: 0;
  }
  #box[data-refpos="below"] { flex-direction: column; }
  #box[data-refpos="above"] { flex-direction: column-reverse; }
  #box.visible { opacity: 1; }
  #bgvideo {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
    display: none;
  }
  #bgtint {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: none;
  }
  #text, #reference {
    position: relative;
    z-index: 2;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    width: 100%;
  }
  #reference { margin: 0.4em 0 0; opacity: 0.95; }
  #box[data-refpos="above"] #reference { margin: 0 0 0.4em; }
  #debug {
    position: fixed;
    top: 8px;
    left: 8px;
    z-index: 99999;
    display: none;
    white-space: pre;
    font: 12px/1.5 monospace;
    color: #7CFC00;
    background: rgba(0, 0, 0, 0.7);
    padding: 6px 9px;
    border-radius: 4px;
  }
</style>
<style id="custom-css"></style>
</head>
<body>
  <div id="stage" data-position="bottom" data-halign="center">
    <div id="box" data-refpos="below">
      <video id="bgvideo" autoplay loop muted playsinline></video>
      <div id="bgtint"></div>
      <span id="text"></span>
      <span id="reference"></span>
    </div>
  </div>
  <div id="debug"></div>
  <script src="/obs/socket.io.js"></script>
  <script>
    (function () {
      var stage = document.getElementById('stage')
      var box = document.getElementById('box')
      var text = document.getElementById('text')
      var reference = document.getElementById('reference')
      var bgVideo = document.getElementById('bgvideo')
      var bgTint = document.getElementById('bgtint')
      var customCssEl = document.getElementById('custom-css')
      var debugEl = document.getElementById('debug')
      var isDebug = /[?&]debug/.test(location.search)
      if (isDebug) debugEl.style.display = 'block'
      var currentConfig = null
      var currentText = ''
      var currentReference = ''

      function dbg(status) {
        if (!isDebug) return
        debugEl.textContent =
          '/obs overlay\\n' +
          'socket: ' + (status || (socket && socket.connected ? 'conectado' : 'desconectado')) + '\\n' +
          'enabled: ' + (currentConfig ? !!currentConfig.enabled : '(sin config)') + '\\n' +
          'texto: ' + (currentText ? currentText.length + ' car.' : '(vacío)') + '\\n' +
          'referencia: ' + (currentReference || '-')
      }

      function hexToRgba(hex, opacity) {
        var h = String(hex || '#000000').replace('#', '')
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
        var num = parseInt(h, 16)
        if (isNaN(num)) return 'rgba(0,0,0,' + opacity + ')'
        var r = (num >> 16) & 255
        var g = (num >> 8) & 255
        var b = num & 255
        return 'rgba(' + r + ',' + g + ',' + b + ',' + opacity + ')'
      }

      function applyStroke(el, config) {
        if (config.textBorder && config.textBorderWidth > 0) {
          el.style.webkitTextStroke = config.textBorderWidth + 'px ' + config.textBorderColor
          el.style.paintOrder = 'stroke fill'
        } else {
          el.style.webkitTextStroke = ''
          el.style.paintOrder = ''
        }
      }

      function applyConfig(config, backgroundImageUrl, backgroundVideoUrl) {
        currentConfig = config
        stage.setAttribute('data-position', config.position || 'bottom')
        stage.setAttribute('data-halign', config.horizontalAlign || 'center')
        box.setAttribute('data-refpos', config.referencePosition || 'below')

        var vh = function (px) { return (px / 1080 * 100).toFixed(3) + 'vh' }
        box.style.color = config.textColor
        box.style.fontFamily = config.fontFamily
        box.style.fontSize = vh(config.fontSize)
        box.style.fontWeight = String(config.fontWeight)
        box.style.textAlign = config.textAlign
        box.style.alignItems =
          config.textAlign === 'left' ? 'flex-start' : config.textAlign === 'right' ? 'flex-end' : 'center'
        box.style.padding = vh(config.paddingY) + ' ' + vh(config.paddingX)
        box.style.maxWidth = config.maxWidth + '%'
        box.style.textTransform = config.uppercase ? 'uppercase' : 'none'
        box.style.textShadow = config.textShadow ? '0 0.2vh 0.6vh rgba(0,0,0,0.85)' : 'none'

        reference.style.color = config.referenceColor
        reference.style.fontSize = vh(config.fontSize * config.referenceFontScale)
        applyStroke(text, config)
        applyStroke(reference, config)

        var tint = hexToRgba(config.backgroundColor, config.backgroundOpacity)
        // Reset de capas de fondo
        bgVideo.style.display = 'none'
        bgTint.style.display = 'none'
        box.style.background = 'transparent'

        if (config.transparentBackground) {
          if (!bgVideo.paused) bgVideo.pause()
          bgVideo.removeAttribute('src')
        } else if (backgroundVideoUrl) {
          // Vídeo de fondo detrás del texto, con capa de tinte encima del vídeo
          if (bgVideo.getAttribute('src') !== backgroundVideoUrl) {
            bgVideo.setAttribute('src', backgroundVideoUrl)
          }
          bgVideo.style.display = 'block'
          var playPromise = bgVideo.play()
          if (playPromise && playPromise.catch) playPromise.catch(function () {})
          bgTint.style.background = tint
          bgTint.style.display = 'block'
        } else if (backgroundImageUrl) {
          if (!bgVideo.paused) bgVideo.pause()
          bgVideo.removeAttribute('src')
          box.style.background =
            'linear-gradient(' + tint + ',' + tint + '), url("' + backgroundImageUrl + '")'
          box.style.backgroundSize = 'cover'
          box.style.backgroundPosition = 'center'
        } else {
          if (!bgVideo.paused) bgVideo.pause()
          bgVideo.removeAttribute('src')
          box.style.background = tint
        }

        customCssEl.textContent = config.customCss || ''

        render()
        dbg()
      }

      function render() {
        var enabled = currentConfig && currentConfig.enabled
        var hasText = currentText && currentText.trim().length > 0
        var showRef = currentConfig && currentConfig.showReference && currentReference
        if (enabled && hasText) {
          text.textContent = currentText
          reference.textContent = showRef ? currentReference : ''
          reference.style.display = showRef ? '' : 'none'
          box.classList.add('visible')
        } else {
          box.classList.remove('visible')
          text.textContent = ''
          reference.textContent = ''
        }
      }

      function loadConfig() {
        fetch('/obs/config', { cache: 'no-store' })
          .then(function (r) { return r.json() })
          .then(function (data) { applyConfig(data.config, data.backgroundImageUrl, data.backgroundVideoUrl) })
          .catch(function () {})
      }

      loadConfig()

      var socket = io()
      socket.on('connect', function () { socket.emit('requestObsText'); dbg('conectado') })
      socket.on('disconnect', function () { dbg('desconectado') })
      socket.on('connect_error', function () { dbg('error de conexión') })
      socket.on('obsTextUpdate', function (data) {
        currentText = (data && data.text) || ''
        currentReference = (data && data.reference) || ''
        render()
        dbg()
      })
      socket.on('obsConfigUpdate', function () {
        // Re-cargar para resolver la URL de la imagen de fondo en el servidor.
        loadConfig()
      })
    })()
  </script>
</body>
</html>`
