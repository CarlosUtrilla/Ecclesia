/**
 * NDI Manager — salida de vídeo NDI de la pantalla de proyección.
 *
 * Flujo: ventana offscreen (`ndiCaptureWindow`) → evento `paint` (BGRA) →
 * ticker a los fps configurados → `sender.video()` (`ndiSender`).
 *
 * El ticker reenvía el último frame capturado aunque no haya repintado, para que
 * los receptores NDI mantengan un flujo estable con contenido estático.
 */

import { app, BrowserWindow } from 'electron'
import log from 'electron-log'
import SettingsService from '@ecclesia/api/src/controllers/settings/settings.service'
import { handleIpc } from '../ipcHelpers'
import {
  DEFAULT_NDI_CONFIG,
  NdiOutputConfig,
  parseNdiConfig,
  requiresNdiRestart,
  serializeNdiConfig
} from './ndiConfig'
import { createNdiCaptureWindow, NdiCaptureWindowHandle } from './ndiCaptureWindow'
import {
  createNdiSender,
  getNdiLoadError,
  getNdiVersion,
  isNdiAvailable,
  NdiSenderHandle,
  NdiVideoFrame
} from './ndiSender'

export const NDI_SETTING_KEY = 'NDI_OUTPUT_CONFIG'

/** Cada cuánto se refresca el número de receptores conectados (ms). */
const CONNECTIONS_POLL_INTERVAL_MS = 2000

export type NdiStatus = {
  /** El addon nativo se pudo cargar en esta máquina. */
  available: boolean
  /** Hay un sender emitiendo ahora mismo. */
  active: boolean
  /** Nombre completo de la fuente NDI (con hostname), si está activa. */
  sourceName: string | null
  /** Receptores NDI conectados. */
  connections: number
  ndiVersion: string | null
  error: string | null
  config: NdiOutputConfig
}

const settingsService = new SettingsService()

let currentConfig: NdiOutputConfig = { ...DEFAULT_NDI_CONFIG }
let sender: NdiSenderHandle | null = null
let capture: NdiCaptureWindowHandle | null = null
let lastFrame: NdiVideoFrame | null = null
let frameTicker: NodeJS.Timeout | null = null
let connectionsTicker: NodeJS.Timeout | null = null
let lastConnections = 0
let lastError: string | null = null
let starting = false

function broadcastStatus(): void {
  const status = getNdiStatus()
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('ndi:status-changed', status)
  })
}

export function getNdiStatus(): NdiStatus {
  return {
    available: isNdiAvailable(),
    active: sender !== null,
    sourceName: sender?.sourceName ?? null,
    connections: lastConnections,
    ndiVersion: getNdiVersion(),
    error: lastError ?? getNdiLoadError(),
    config: currentConfig
  }
}

async function loadStoredConfig(): Promise<NdiOutputConfig> {
  try {
    const rows = await settingsService.getAllSettings([NDI_SETTING_KEY])
    const row = rows.find((setting) => setting.key === NDI_SETTING_KEY)
    return parseNdiConfig(row?.value)
  } catch (error) {
    log.error('[ndi] No se pudo leer la configuración NDI:', error)
    return { ...DEFAULT_NDI_CONFIG }
  }
}

async function persistConfig(config: NdiOutputConfig): Promise<void> {
  try {
    await settingsService.updateSetting([
      { key: NDI_SETTING_KEY, value: serializeNdiConfig(config) }
    ])
  } catch (error) {
    log.error('[ndi] No se pudo guardar la configuración NDI:', error)
  }
}

export async function startNdiOutput(): Promise<NdiStatus> {
  if (sender || starting) return getNdiStatus()

  starting = true
  lastError = null

  try {
    const newSender = await createNdiSender(currentConfig)

    if (!newSender) {
      lastError = getNdiLoadError() ?? 'NDI no disponible en este sistema'
      return getNdiStatus()
    }

    sender = newSender
    lastFrame = null
    lastConnections = 0

    capture = createNdiCaptureWindow({
      width: currentConfig.width,
      height: currentConfig.height,
      fps: currentConfig.fps,
      onFrame: (frame) => {
        if (!lastFrame) {
          log.info(`[ndi] Primer frame capturado: ${frame.width}x${frame.height}`)
        }
        lastFrame = frame
      }
    })

    frameTicker = setInterval(() => {
      if (!sender || !lastFrame) return
      sender.sendVideo(lastFrame)
    }, Math.round(1000 / currentConfig.fps))

    connectionsTicker = setInterval(() => {
      if (!sender) return
      const connections = sender.connections()
      if (connections !== lastConnections) {
        lastConnections = connections
        log.info(`[ndi] Receptores conectados: ${connections}`)
        broadcastStatus()
      }
    }, CONNECTIONS_POLL_INTERVAL_MS)

    log.info(`[ndi] Salida NDI activa: ${newSender.sourceName}`)
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error)
    log.error('[ndi] Error arrancando la salida NDI:', error)
    await stopNdiOutput()
  } finally {
    starting = false
  }

  return getNdiStatus()
}

export async function stopNdiOutput(): Promise<NdiStatus> {
  if (frameTicker) {
    clearInterval(frameTicker)
    frameTicker = null
  }

  if (connectionsTicker) {
    clearInterval(connectionsTicker)
    connectionsTicker = null
  }

  capture?.destroy()
  capture = null
  lastFrame = null
  lastConnections = 0

  const activeSender = sender
  sender = null

  if (activeSender) {
    await activeSender.destroy()
    log.info('[ndi] Salida NDI detenida')
  }

  return getNdiStatus()
}

/**
 * Aplica una config nueva: la persiste y arranca/para/reinicia la salida según
 * lo que haya cambiado.
 */
export async function updateNdiConfig(raw: unknown): Promise<NdiStatus> {
  const previous = currentConfig
  const next = parseNdiConfig(raw)
  currentConfig = next

  await persistConfig(next)

  const wasActive = sender !== null

  if (!next.enabled) {
    if (wasActive) await stopNdiOutput()
  } else if (!wasActive) {
    await startNdiOutput()
  } else if (requiresNdiRestart(previous, next)) {
    await stopNdiOutput()
    await startNdiOutput()
  }

  broadcastStatus()
  return getNdiStatus()
}

export async function initializeNdiManager(): Promise<void> {
  handleIpc('ndi:get-status', () => getNdiStatus())
  handleIpc('ndi:update-config', (config: unknown) => updateNdiConfig(config))
  handleIpc('ndi:start', async () => {
    currentConfig = { ...currentConfig, enabled: true }
    await persistConfig(currentConfig)
    const status = await startNdiOutput()
    broadcastStatus()
    return status
  })
  handleIpc('ndi:stop', async () => {
    currentConfig = { ...currentConfig, enabled: false }
    await persistConfig(currentConfig)
    const status = await stopNdiOutput()
    broadcastStatus()
    return status
  })

  app.on('will-quit', () => {
    void stopNdiOutput()
  })

  currentConfig = await loadStoredConfig()

  if (currentConfig.enabled) {
    await startNdiOutput()
    broadcastStatus()
  }
}
