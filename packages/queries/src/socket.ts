import { io, Socket } from 'socket.io-client'
import type { SocketEventMap } from '@ecclesia/api'

let socketInstance: Socket | null = null
let currentUrl = ''
let currentPort = 0
const socketReconnectListeners = new Set<() => void>()
const socketChangeListeners = new Set<() => void>()

export function onSocketReconnect(cb: () => void): () => void {
  socketReconnectListeners.add(cb)
  return () => socketReconnectListeners.delete(cb)
}

export function onSocketChange(cb: () => void): () => void {
  socketChangeListeners.add(cb)
  return () => socketChangeListeners.delete(cb)
}

type SocketListenShape = {
  [K in keyof SocketEventMap]: SocketEventMap[K] extends void
    ? (cb: () => void) => () => void
    : (cb: (data: SocketEventMap[K]) => void) => () => void
}

type SocketEmitShape = {
  [K in keyof SocketEventMap]: SocketEventMap[K] extends void
    ? () => void
    : (data: SocketEventMap[K]) => void
}

export type SocketShape = {
  listen: SocketListenShape
  emit: SocketEmitShape
}

function getOrCreateSocket(apiUrl: string, port: number): Socket {
  if (!socketInstance || apiUrl !== currentUrl || port !== currentPort) {
    socketInstance?.disconnect()
    currentUrl = apiUrl
    currentPort = port
    socketInstance = io(`${apiUrl}:${port}`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    })

    socketInstance.on('connect', () => {
      console.warn(`[DEBUG-SOCKET] Connected: ${socketInstance?.id}`)
    })
    socketInstance.on('disconnect', (reason) => {
      console.warn(`[DEBUG-SOCKET] Disconnected: ${reason}`)
    })
    socketInstance.on('connect_error', (err) => {
      console.warn(`[DEBUG-SOCKET] Connection error: ${err.message}`)
    })

    // Notify all change listeners that the socket has been replaced
    socketReconnectListeners.forEach((cb) => cb())
    socketChangeListeners.forEach((cb) => cb())
  }
  return socketInstance
}

export function createSocketProxy(apiUrl: string, port: number): SocketShape {
  const socket = getOrCreateSocket(apiUrl, port)

  const listen = new Proxy({} as any, {
    get: (_, eventName) => (callback: any) => {
      socket.on(eventName as string, callback)
      return () => socket.off(eventName as string, callback)
    },
  }) as SocketListenShape

  const emit = new Proxy({} as any, {
    get: (_, eventName) => (data?: any) => {
      console.warn(`[DEBUG-SOCKET] Emitting event: ${eventName}`, data)
      socket.emit(eventName as string, data)
    },
  }) as SocketEmitShape

  return { listen, emit }
}

export function disconnectSocket(): void {
  socketInstance?.disconnect()
  socketInstance = null
  currentUrl = ''
  currentPort = 0
}

export function getSocketInstance(): Socket | null {
  return socketInstance
}
