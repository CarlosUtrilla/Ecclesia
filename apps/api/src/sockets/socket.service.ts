/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { Server as SocketIOServer } from 'socket.io'

let io: SocketIOServer | null = null
let _socket: ApiSocketShape | null = null

export interface SocketEventMap {
  // API → Frontend
  syncProgress: { progress: number; message: string; error?: boolean }
  oauthComplete: { success: boolean; email?: string; error?: string }
  songCreated: void
  bibleImported: void
  scheduleChanged: void
  queryKeysInvalidate: { keys: string[][] }

  // Frontend → API
  startSync: { reason: string }
  ping: void
  requestResync: void

  // Bidireccional (relay)
  bibleSearch: { version: string; bookId: number; chapter: number; verse: number }

  // Bidireccional (broadcast a todos los clientes conectados)
      liveMediaState: { action: 'play' | 'pause' | 'seek' | 'restart'; time: number; volume?: number }
}

type ApiEmitShape = {
  [K in keyof SocketEventMap]: SocketEventMap[K] extends void
    ? () => void
    : (data: SocketEventMap[K]) => void
}

type ApiOnShape = {
  [K in keyof SocketEventMap]: SocketEventMap[K] extends void
    ? (cb: () => void) => () => void
    : (cb: (data: SocketEventMap[K]) => void) => () => void
}

export type ApiSocketShape = {
  emit: ApiEmitShape
  on: ApiOnShape
}

export function setSocketIO(instance: SocketIOServer): void {
  io = instance
  _socket = createSocketProxy(instance)
}

export function getSocket(): ApiSocketShape {
  if (!_socket) {
    throw new Error('Socket no inicializado. Llama a setSocketIO primero.')
  }
  return _socket
}

export function getIO(): SocketIOServer | null {
  return io
}

const globalHandlers = new Map<string, Set<Function>>()

function createSocketProxy(io: SocketIOServer): ApiSocketShape {
  io.on('connection', (socket) => {
    for (const [eventName, cbs] of globalHandlers) {
      for (const cb of cbs) {
        socket.on(eventName, cb as any)
      }
    }
  })

  const emit = new Proxy({} as any, {
    get: (_, event) => (data?: any) => {
      io?.emit(event as string, data)
    }
  }) as ApiEmitShape

  const on = new Proxy({} as any, {
    get: (_, event) => (cb: Function) => {
      const eventName = event as string
      if (!globalHandlers.has(eventName)) {
        globalHandlers.set(eventName, new Set())
      }
      globalHandlers.get(eventName)!.add(cb)

      for (const [, socket] of io.sockets.sockets) {
        socket.on(eventName, cb as any)
      }

      return () => {
        globalHandlers.get(eventName)?.delete(cb)
        for (const [, socket] of io.sockets.sockets) {
          socket.removeListener(eventName, cb as any)
        }
      }
    }
  }) as ApiOnShape

  return { emit, on }
}
