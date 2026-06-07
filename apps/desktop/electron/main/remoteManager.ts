import { ipcMain, BrowserWindow } from 'electron'
import dgram from 'dgram'
import os from 'os'
import Logger from 'electron-log'

const DISCOVERY_PORT = 7777
const DISCOVERY_TIMEOUT_MS = 2500

const DISCOVER_MESSAGE = JSON.stringify({ type: 'ECCLESIA_DISCOVER' })
const MAX_RESPONSE_SIZE = 1024

interface LanDevice {
  ip: string
  name: string
}

let udpListener: dgram.Socket | null = null

let currentRemoteUrl: string | null = null
let currentRemotePort: number | null = null

function getLocalIp(): string {
  const interfaces = os.networkInterfaces()
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address
      }
    }
  }
  return '127.0.0.1'
}

function startUdpListener(): void {
  if (udpListener) return

  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

  socket.on('message', (msg, rinfo) => {
    try {
      const parsed = JSON.parse(msg.toString('utf8', 0, MAX_RESPONSE_SIZE))
      if (parsed.type === 'ECCLESIA_DISCOVER') {
        const response = JSON.stringify({
          type: 'ECCLESIA_RESPONSE',
          name: os.hostname(),
          ip: getLocalIp()
        })
        socket.send(response, 0, Buffer.byteLength(response), rinfo.port, rinfo.address)
      }
    } catch {
      // Ignorar mensajes malformados
    }
  })

  socket.on('error', (err) => {
    Logger.error('[Remote] Error en listener UDP:', err.message)
    udpListener = null
  })

  socket.on('listening', () => {
    const addr = socket.address()
    Logger.info(`[Remote] Escuchando broadcasts UDP en puerto ${addr.port}`)
  })

  try {
    socket.bind(DISCOVERY_PORT, () => {
      socket.setBroadcast(true)
    })
    udpListener = socket
  } catch (err: any) {
    Logger.error(`[Remote] No se pudo iniciar listener UDP en puerto ${DISCOVERY_PORT}:`, err.message)
  }
}

function discoverLanDevices(): Promise<LanDevice[]> {
  return new Promise((resolve) => {
    const devices: Map<string, LanDevice> = new Map()
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    socket.on('message', (msg, rinfo) => {
      try {
        const parsed = JSON.parse(msg.toString('utf8', 0, MAX_RESPONSE_SIZE))
        if (parsed.type === 'ECCLESIA_RESPONSE' && parsed.name && rinfo.address) {
          Logger.info(`[Remote] Descubierto: ${parsed.name} en ${rinfo.address}`)
          devices.set(rinfo.address, { ip: rinfo.address, name: parsed.name })
        }
      } catch {
        // Ignorar respuestas malformadas
      }
    })

    socket.on('error', (err) => {
      Logger.error('[Remote] Error en socket de descubrimiento:', err.message)
      clearTimeout(timer)
      socket.close()
      resolve(Array.from(devices.values()))
    })

    const timer = setTimeout(() => {
      socket.close()
      resolve(Array.from(devices.values()))
    }, DISCOVERY_TIMEOUT_MS)

    socket.bind(0, () => {
      socket.setBroadcast(true)
      const message = Buffer.from(DISCOVER_MESSAGE)

      // Enviar broadcast a 255.255.255.255
      socket.send(message, 0, message.length, DISCOVERY_PORT, '255.255.255.255')

      // Calcular broadcast de subred desde la primera interfaz IPv4 no interna
      const interfaces = os.networkInterfaces()
      for (const iface of Object.values(interfaces)) {
        if (!iface) continue
        for (const info of iface) {
          if (info.family === 'IPv4' && !info.internal && info.netmask) {
            const ipParts = info.address.split('.').map(Number)
            const maskParts = info.netmask.split('.').map(Number)
            const broadcast = ipParts.map((part, i) => part | (~maskParts[i] & 255))
            const subnet = broadcast.join('.')
            socket.send(message, 0, message.length, DISCOVERY_PORT, subnet)
            break
          }
        }
        break
      }

      Logger.info('[Remote] Broadcast de descubrimiento enviado')
    })
  })
}

function broadcastToAllWindows(event: string, data: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(event, data)
    }
  })
}

export function initializeRemoteManager() {
  startUdpListener()

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
}

export function getCurrentRemoteState(): { url: string; port: number } | null {
  if (currentRemoteUrl && currentRemotePort) {
    return { url: currentRemoteUrl, port: currentRemotePort }
  }
  return null
}
