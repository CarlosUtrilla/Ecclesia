import { io as createSocketIOClient, Socket } from 'socket.io-client'

type ProgressCallback = (data: {
  syncing: boolean
  progress: number
  message?: string
  error?: string
}) => void

let client: Socket | null = null
let currentUrl: string | null = null
const listeners = new Set<ProgressCallback>()

function notifyListeners(data: Parameters<ProgressCallback>[0]): void {
  for (const fn of listeners) {
    try {
      fn(data)
    } catch { /* noop */ }
  }
}

export function connectSyncProgress(serverUrl: string, port = 7777): void {
  const url = `${serverUrl}:${port}`
  if (client?.connected && currentUrl === url) return

  disconnectSyncProgress()

  currentUrl = url
  client = createSocketIOClient(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10
  })

  client.on('connect', () => {
    console.warn('[sync-progress] Conectado a Socket.IO:', url)
  })

  client.on('sync-progress', (data: { progress: number; message: string; error?: boolean }) => {
    if (data.error) {
      notifyListeners({ syncing: false, progress: 0, message: data.message, error: data.message })
    } else if (data.progress >= 100) {
      notifyListeners({ syncing: true, progress: 100, message: data.message })
      setTimeout(() => notifyListeners({ syncing: false, progress: 0 }), 500)
    } else {
      notifyListeners({ syncing: true, progress: data.progress, message: data.message })
    }
  })

  client.on('disconnect', () => {
    console.warn('[sync-progress] Desconectado de Socket.IO')
  })

  client.on('connect_error', (err) => {
    console.warn('[sync-progress] Error de conexión:', err.message)
  })
}

export function disconnectSyncProgress(): void {
  if (client) {
    client.disconnect()
    client = null
  }
  currentUrl = null
}

export function onSyncProgress(fn: ProgressCallback): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function offSyncProgress(fn: ProgressCallback): void {
  listeners.delete(fn)
}
