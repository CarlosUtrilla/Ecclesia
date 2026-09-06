import path from 'path'
import fs from 'fs'
import type { Express } from 'express'
import { getPrisma } from '../../prisma'
import { toStorageSettingKey } from '../settings/settingKeys'
import { parseObsConfig, parseObsSubtitles, type ObsSubtitle } from './obsOverlayConfig'
import Logger from 'electron-log'

const OBS_CONFIG_STORAGE_KEY = toStorageSettingKey('OBS_TEXT_OVERLAY_CONFIG')
const OBS_SUBTITLES_STORAGE_KEY = toStorageSettingKey('OBS_SUBTITLES')

type SettingRow = { value: string }

async function readSettingValue(storageKey: string): Promise<string | undefined> {
  try {
    const prisma = getPrisma()
    const rows = await prisma.$queryRawUnsafe<SettingRow[]>(
      'SELECT value FROM Setting WHERE key = ? LIMIT 1',
      storageKey
    )
    return rows[0]?.value
  } catch (err) {
    Logger.error('[OBS] No se pudo leer setting', storageKey, (err as Error)?.message)
    return undefined
  }
}

async function loadSubtitles(): Promise<ObsSubtitle[]> {
  const subtitles = parseObsSubtitles(await readSettingValue(OBS_SUBTITLES_STORAGE_KEY))
  if (subtitles.length > 0) return subtitles
  // Migración: si existe el overlay único antiguo, exponerlo como 'text-1'.
  const legacy = await readSettingValue(OBS_CONFIG_STORAGE_KEY)
  if (legacy) {
    return [{ ...parseObsConfig(legacy), slug: 'text-1', name: 'Subtítulo 1', types: [] }]
  }
  return []
}

async function findSubtitle(slug: string): Promise<ObsSubtitle | null> {
  const subtitles = await loadSubtitles()
  return subtitles.find((s) => s.slug === slug) ?? null
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
 * Registra las rutas de la salida para OBS. Cada subtítulo se sirve bajo su propio
 * slug para no saturar `/obs` (que queda como paraguas; el vídeo irá a /obs/video/…):
 * - GET /obs/socket.io.js          → cliente de Socket.IO (servido por nosotros)
 * - GET /obs/subtitle/:slug        → página HTML del subtítulo (browser source)
 * - GET /obs/subtitle/:slug/config → JSON { config, types, backgroundImageUrl, backgroundVideoUrl }
 */
export function registerObsOverlayRoutes(app: Express) {
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

  app.get('/obs/subtitle/:slug/config', async (req, res) => {
    const subtitle = await findSubtitle(req.params.slug)
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (!subtitle) {
      res.status(404).json({ error: 'subtitle not found' })
      return
    }
    const background = await resolveBackground(subtitle.backgroundMediaId)
    res.json({
      config: subtitle,
      types: subtitle.types,
      backgroundImageUrl: background && !background.isVideo ? background.url : null,
      backgroundVideoUrl: background && background.isVideo ? background.url : null
    })
  })

  app.get('/obs/subtitle/:slug', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.send(OBS_OVERLAY_HTML)
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
  /*
   * El stage es un lienzo virtual de 1080px de alto que se escala al tamaño real
   * del Browser Source. Así todo se mide en px de un lienzo conocido y cualquier
   * unidad absoluta (px, rem, em) rinde igual aquí que en la vista previa de la
   * app, que usa exactamente el mismo montaje.
   */
  #viewport {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }
  #stage {
    position: absolute;
    top: 0;
    left: 0;
    height: 1080px;
    transform-origin: top left;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 43.2px 0;
  }
  #box {
    position: relative;
    display: flex;
    box-sizing: border-box;
    border-radius: 4px;
    line-height: 1.25;
    background-size: cover;
    background-position: center;
    overflow: hidden;
    transition: opacity 180ms ease;
    opacity: 0;
  }
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
<style id="base-css"></style>
<style id="custom-css"></style>
</head>
<body>
  <div id="viewport">
    <div id="stage">
      <div id="box">
        <video id="bgvideo" autoplay loop muted playsinline></video>
        <div id="bgtint"></div>
        <span id="text"></span>
        <span id="reference"></span>
      </div>
    </div>
  </div>
  <div id="debug"></div>
  <script src="/obs/socket.io.js"></script>
  <script>
    (function () {
      var stage = document.getElementById('stage')
      var box = document.getElementById('box')

      /*
       * Ajusta el lienzo virtual (1080px de alto) al tamaño real del Browser
       * Source. La escala va por altura para conservar el tamaño de fuente que
       * daban las unidades vh anteriores; el ancho virtual se estira para
       * cubrir el lienzo aunque no sea 16:9.
       */
      function applyStageScale() {
        var h = window.innerHeight || 1080
        var w = window.innerWidth || 1920
        var scale = h / 1080
        if (!isFinite(scale) || scale <= 0) scale = 1
        stage.style.transform = 'scale(' + scale + ')'
        stage.style.width = (w / scale) + 'px'
      }
      applyStageScale()
      window.addEventListener('resize', applyStageScale)
      var text = document.getElementById('text')
      var reference = document.getElementById('reference')
      var bgVideo = document.getElementById('bgvideo')
      var bgTint = document.getElementById('bgtint')
      var customCssEl = document.getElementById('custom-css')
      var baseCssEl = document.getElementById('base-css')
      var debugEl = document.getElementById('debug')
      var isDebug = /[?&]debug/.test(location.search)
      if (isDebug) debugEl.style.display = 'block'
      var currentConfig = null
      var currentText = ''
      var currentReference = ''
      var currentContentType = ''
      // slug del subtítulo: última parte de /obs/subtitle/<slug>
      var slug = decodeURIComponent((location.pathname.split('/').filter(Boolean).pop()) || '')

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

      // Construye la hoja de estilos BASE (del editor) como reglas por id. Va antes de
      // #custom-css, así el CSS del usuario gana por la cascada SIN necesidad de !important.
      function buildBaseCss(config, backgroundImageUrl, backgroundVideoUrl) {
        // El stage mide 1080px de alto de verdad, así que los valores del editor
        // (que ya están referidos a 1080) se emiten como px literales.
        var vh = function (px) { return px + 'px' }
        var vw = vh
        var tint = hexToRgba(config.backgroundColor, config.backgroundOpacity)
        var justify = config.position === 'top' ? 'flex-start' : config.position === 'center' ? 'center' : 'flex-end'
        var halign = config.horizontalAlign === 'left' ? 'flex-start' : config.horizontalAlign === 'right' ? 'flex-end' : 'center'
        var boxAlign = config.textAlign === 'left' ? 'flex-start' : config.textAlign === 'right' ? 'flex-end' : 'center'
        var mTop = config.position === 'top' ? vh(config.offsetY) : '0'
        var mBottom = config.position === 'bottom' ? vh(config.offsetY) : '0'
        var mLeft = config.horizontalAlign === 'left' ? vw(config.offsetX) : '0'
        var mRight = config.horizontalAlign === 'right' ? vw(config.offsetX) : '0'
        var boxBg = config.transparentBackground || backgroundVideoUrl
          ? 'transparent'
          : backgroundImageUrl
            ? 'linear-gradient(' + tint + ',' + tint + '), url("' + backgroundImageUrl + '") center / cover'
            : tint
        var refAbove = config.referencePosition === 'above'
        var css = ''
        css += '#stage{justify-content:' + justify + ';align-items:' + halign + ';}'
        css += '#box{'
        css += 'flex-direction:' + (refAbove ? 'column-reverse' : 'column') + ';'
        css += 'align-items:' + boxAlign + ';'
        css += 'color:' + config.textColor + ';'
        css += 'font-family:' + config.fontFamily + ';'
        css += 'font-size:' + vh(config.fontSize) + ';'
        css += 'font-weight:' + config.fontWeight + ';'
        css += 'text-align:' + config.textAlign + ';'
        css += 'padding:' + vh(config.paddingY) + ' ' + vh(config.paddingX) + ';'
        css += 'max-width:' + config.maxWidth + '%;'
        css += 'margin:' + mTop + ' ' + mRight + ' ' + mBottom + ' ' + mLeft + ';'
        css += 'line-height:1.25;'
        css += 'border-radius:' + vh(4) + ';'
        css += 'text-transform:' + (config.uppercase ? 'uppercase' : 'none') + ';'
        css += 'text-shadow:' + (config.textShadow ? '0 2px 6px rgba(0,0,0,0.85)' : 'none') + ';'
        css += 'background:' + boxBg + ';'
        css += '}'
        css += '#reference{color:' + config.referenceColor + ';font-size:' + vh(config.fontSize * config.referenceFontScale) + ';'
        css += 'margin:' + (refAbove ? '0 0 0.4em' : '0.4em 0 0') + ';}'
        if (config.textBorder && config.textBorderWidth > 0) {
          css += '#text,#reference{-webkit-text-stroke:' + vh(config.textBorderWidth) + ' ' + config.textBorderColor + ';paint-order:stroke fill;}'
        }
        css += '#bgtint{background:' + tint + ';}'
        return css
      }

      function applyConfig(config, backgroundImageUrl, backgroundVideoUrl) {
        currentConfig = config

        // Estilos del editor → hoja base; los del usuario → #custom-css (después, gana sin !important)
        baseCssEl.textContent = buildBaseCss(config, backgroundImageUrl, backgroundVideoUrl)
        customCssEl.textContent = config.customCss || ''

        // Capas de fondo estructurales (vídeo/tinte se muestran vía display)
        if (!config.transparentBackground && backgroundVideoUrl) {
          if (bgVideo.getAttribute('src') !== backgroundVideoUrl) bgVideo.setAttribute('src', backgroundVideoUrl)
          bgVideo.style.display = 'block'
          bgTint.style.display = 'block'
          var playPromise = bgVideo.play()
          if (playPromise && playPromise.catch) playPromise.catch(function () {})
        } else {
          bgVideo.style.display = 'none'
          bgTint.style.display = 'none'
          if (!bgVideo.paused) bgVideo.pause()
          bgVideo.removeAttribute('src')
        }

        render()
        dbg()
      }

      function matchesType() {
        var types = (currentConfig && currentConfig.types) || []
        if (!types.length) return true
        return types.indexOf(currentContentType) !== -1
      }

      function render() {
        var enabled = currentConfig && currentConfig.enabled
        var hasText = currentText && currentText.trim().length > 0
        var showRef = currentConfig && currentConfig.showReference && currentReference
        if (enabled && hasText && matchesType()) {
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
        if (!slug) return
        fetch('/obs/subtitle/' + encodeURIComponent(slug) + '/config', { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : null })
          .then(function (data) {
            if (data && data.config) applyConfig(data.config, data.backgroundImageUrl, data.backgroundVideoUrl)
          })
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
        currentContentType = (data && data.contentType) || ''
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
