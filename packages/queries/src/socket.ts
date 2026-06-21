import { io, Socket } from 'socket.io-client'
import type { SocketEventMap } from '@ecclesia/api'

let socketInstance: Socket | null = null
let currentUrl = ''
let currentPort = 0

type ListenerMap = Map<string, Set<(...args: unknown[]) => void>>
const pendingListeners: ListenerMap = new Map()

function reattachListeners(socket: Socket, listeners: ListenerMap): void {
  for (const [event, cbs] of listeners) {
    for (const cb of cbs) {
      socket.on(event, cb as any)
    }
  }
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
    reattachListeners(socketInstance, pendingListeners)
  }
  return socketInstance
}

export function createSocketProxy(apiUrl: string, port: number): SocketShape {
  const socket = getOrCreateSocket(apiUrl, port)

  const listen = new Proxy({} as any, {
    get: (_, eventName) => (callback: any) => {
      const event = eventName as string
      socket.on(event, callback)
      if (!pendingListeners.has(event)) {
        pendingListeners.set(event, new Set())
      }
      pendingListeners.get(event)!.add(callback)
      return () => {
        socket.off(event, callback)
        pendingListeners.get(event)?.delete(callback)
      }
    },
  }) as SocketListenShape

  const emit = new Proxy({} as any, {
    get: (_, eventName) => (data?: any) => {
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
  pendingListeners.clear()
}

export function getSocketInstance(): Socket | null {
  return socketInstance
}
