import dgram from 'dgram'
import os from 'os'

const DISCOVERY_PORT = 7777
const DISCOVERY_TIMEOUT_MS = 2500
const DISCOVER_MESSAGE = JSON.stringify({ type: 'ECCLESIA_DISCOVER' })
const MAX_RESPONSE_SIZE = 1024

interface LanDevice {
  ip: string
  name: string
}

let udpListener: dgram.Socket | null = null

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

/**
 * Todas las direcciones IPv4 de este equipo (incluida la loopback). Se usa para
 * descartar la respuesta del propio dispositivo durante el descubrimiento LAN:
 * al hacer broadcast, este equipo también se responde a sí mismo y no debe
 * aparecer en la lista de dispositivos a los que controlar remotamente.
 */
function getLocalIpAddresses(): Set<string> {
  const addresses = new Set<string>(['127.0.0.1'])
  const interfaces = os.networkInterfaces()
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue
    for (const info of iface) {
      if (info.family === 'IPv4') {
        addresses.add(info.address)
      }
    }
  }
  return addresses
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
      // Ignore malformed messages
    }
  })

  socket.on('error', () => {
    udpListener = null
  })

  try {
    socket.bind(DISCOVERY_PORT, () => {
      socket.setBroadcast(true)
    })
    udpListener = socket
  } catch {
    // Port may be in use
  }
}

export function initializeUdpDiscovery(): void {
  startUdpListener()
}

export function discoverLanDevices(): Promise<LanDevice[]> {
  return new Promise((resolve) => {
    const devices: Map<string, LanDevice> = new Map()
    const localAddresses = getLocalIpAddresses()
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    socket.on('message', (msg, rinfo) => {
      try {
        const parsed = JSON.parse(msg.toString('utf8', 0, MAX_RESPONSE_SIZE))
        if (parsed.type === 'ECCLESIA_RESPONSE' && parsed.name && rinfo.address) {
          // Excluir el propio dispositivo (responde a su propio broadcast).
          if (localAddresses.has(rinfo.address)) return
          devices.set(rinfo.address, { ip: rinfo.address, name: parsed.name })
        }
      } catch {
        // Ignore malformed responses
      }
    })

    socket.on('error', () => {
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

      // Broadcast to 255.255.255.255
      socket.send(message, 0, message.length, DISCOVERY_PORT, '255.255.255.255')

      // Calculate subnet broadcast
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
    })
  })
}
