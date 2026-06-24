# Socket System Agent

## Descripción

Sistema de comunicación bidireccional en tiempo real vía Socket.IO entre el API (backend) y el frontend React. Centraliza toda la definición de eventos en un solo lugar.

## Arquitectura

```
apps/api/src/sockets/
├── socket.service.ts     ← Definición de eventos + Proxy runtime
├── socket-handlers.ts    ← Handlers de eventos entrantes (frontend → API)
└── AGENTS.md             ← Este archivo
```

## SocketEventMap — Único registro de eventos

Todos los eventos se declaran en `SocketEventMap` (`socket.service.ts`). Un solo registro habilita ambos caminos automáticamente:

| Camino | Frontend | API |
|---|---|---|
| API → Frontend | `Api.socket.listen.syncProgress(cb)` | `socket.emit.syncProgress(data)` |
| API → Frontend | `Api.socket.listen.oauthComplete(cb)` | `socket.emit.oauthComplete(data)` |
| Frontend → API | `Api.socket.emit.startSync(data)` | `socket.on.startSync(cb)` |
| Bidireccional (relay) | `Api.socket.emit.bibleSearch(data)` / `Api.socket.listen.bibleSearch(cb)` | `socket.on.bibleSearch((data) => socket.emit.bibleSearch(data))` |

Cuando el valor del mapa es `void`, el evento no transporta datos:

```typescript
export interface SocketEventMap {
  syncProgress: { progress: number; message: string; error?: boolean }
  oauthComplete: { success: boolean; email?: string; error?: string }
  songCreated: void          // sin datos
  ping: void                 // sin datos
  bibleSearch: { version: string; bookId: number; chapter: number; verse: number }
}
```

El evento `bibleSearch` es bidireccional: cualquier cliente lo emite y el servidor lo retransmite a todos los demás como relay. Esto reemplazó el antiguo canal IPC `bible-search` de Electron.

## Cómo agregar un nuevo evento

1. Agregar entrada en `SocketEventMap` en `socket.service.ts`:
   ```typescript
   myNewEvent: { someField: string }
   ```
2. Si es API → Frontend: emitir con `socket.emit.myNewEvent(data)` desde cualquier service
3. Si es Frontend → API: registrar handler en `socket-handlers.ts`:
   ```typescript
   socket.on.myNewEvent((data) => { ... })
   ```
4. Frontend lo recibe tipado automáticamente vía `Api.socket.listen.myNewEvent(cb)` o emite con `Api.socket.emit.myNewEvent(data)`

No hay que tocar `packages/queries/` para agregar eventos.

## Runtime

### `socket.service.ts`
- `setSocketIO(instance)` — inyecta el `SocketIOServer` (llamado desde `index.ts`)
- `getSocket()` — devuelve el singleton `{ emit, on }`
- `getIO()` — devuelve el `SocketIOServer` nativo (para casos excepcionales)

### `socket-handlers.ts`
- `registerSocketHandlers()` — registra todos los handlers de eventos frontend → API
- Se llama después de `setSocketIO()` en `index.ts`
- Usa `import()` dinámico para evitar circular dependencies con los services que escucha

### Proxy `on` — wiring automático per-connection
- Cuando se registra un handler con `socket.on.eventName(cb)`, se aplica a todas las conexiones **actuales** y **futuras**
- Retorna una función `unsubscribe` que remueve el handler de todas las conexiones

## Dependencia con queries

`packages/queries/src/socket.ts` importa `SocketEventMap` desde `@ecclesia/api` y deriva automáticamente los tipos de `Api.socket.listen` y `Api.socket.emit`. No hay definiciones duplicadas.
