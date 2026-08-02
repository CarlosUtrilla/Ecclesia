import { Server as SocketIOServer } from 'socket.io'
import type { ObsOverlayConfig } from '../controllers/obs/obsOverlayConfig'

let io: SocketIOServer | null = null
let _socket: ApiSocketShape | null = null

export interface SocketEventMap {
  // API → Frontend
  syncProgress: { progress: number; message: string; error?: boolean }
  syncState: { connected: boolean }
  songCreated: void
  bibleImported: void
  scheduleChanged: void
  queryKeysInvalidate: { keys: string[][] }

  // Frontend → API
  startSync: { reason: string }
  ping: void
  requestResync: void

  // Live control commands (relayed: any client emits, server broadcasts to others)
  liveSendToItem: { itemId: string }
  liveClearItem: void
  liveNextSlide: void
  livePrevSlide: void
  liveGoToSlide: { index: number }
  liveSetHideText: { active: boolean }
  liveSetShowLogo: { active: boolean }
  liveSetBlackScreen: { active: boolean }

  // Live state sync (renderer broadcasts current state to remotes)
  liveStateUpdate: {
    itemOnLive: { id: string; type: string; accessData: string; label?: string | null } | null
    itemIndex: number
    slideCount: number
    hideTextOnLive: boolean
    showLogoOnLive: boolean
    blackScreenOnLive: boolean
    showLiveScreen: boolean
    themeId: number | null
    liveScreens: Array<{ id: number; label: string; type: string | null; aspectRatioCss: string }>
    stageScreens: Array<{ id: number; label: string; type: string | null; aspectRatioCss: string }>
  }

  // Remote client requests current schedule state from host
  requestScheduleState: void

  // Salida de texto para OBS (browser source de subtítulos)
  // El host emite el texto plano actualmente en vivo; el servidor lo reenvía
  // por broadcast a la página /obs. El diálogo de config emite obsConfigUpdate
  // para re-estilizar en caliente. La página, al conectar, emite requestObsText.
  obsTextUpdate: { text: string; reference?: string }
  obsConfigUpdate: ObsOverlayConfig
  requestObsText: void

  // Schedule state sync (broadcast full schedule form state to all clients)
  scheduleStateUpdate: {
    id: number | null
    title: string
    items: Array<{
      id: string
      order: number
      type: string
      accessData: string
      scheduleId: number
      updatedAt: string
      deletedAt: string | null
    }>
    dateFrom: string | null
    dateTo: string | null
    isTemporary: boolean
  }
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
    },
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
    },
  }) as ApiOnShape

  return { emit, on }
}
