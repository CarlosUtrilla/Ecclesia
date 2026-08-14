# Socket System Agent

## Descripción

Sistema de comunicación bidireccional en tiempo real vía Socket.IO entre el API (backend) y el frontend React. Centraliza toda la definición de eventos en un solo lugar.

## Arquitectura

```
apps/api/src/sockets/
├── socket.service.ts       ← Definición de eventos + Proxy runtime
├── socket-handlers.ts      ← Handlers de eventos entrantes (frontend → API)
└── AGENTS.md               ← Este archivo
```

Los eventos de live control se registran como **relay handlers** directos en el `io.on('connection')` dentro de `apps/api/src/index.ts`. Cuando cualquier cliente emite un evento `live*`, el servidor lo re-emite a todos los demás clientes con `socket.broadcast.emit()`, sin lógica de negocio.

## SocketEventMap — Único registro de eventos

Todos los eventos se declaran en `SocketEventMap` (`socket.service.ts`). Un solo registro habilita ambos caminos automáticamente:

| Camino | Frontend | API |
|---|---|---|
| API → Frontend | `Api.socket.listen.syncProgress(cb)` | `socket.emit.syncProgress(data)` |
| Frontend → API | `Api.socket.emit.startSync(data)` | `socket.on.startSync(cb)` |
| Bidireccional (relay) | `Api.socket.emit.liveNextSlide()` | `socket.broadcast.emit('liveNextSlide')` |
| | `Api.socket.listen.liveStateUpdate(cb)` | en `index.ts` connection handler |

Cuando el valor del mapa es `void`, el evento no transporta datos:

```typescript
export interface SocketEventMap {
  syncProgress: { progress: number; message: string; error?: boolean }
  songCreated: void
  ping: void
  liveClearItem: void
  liveNextSlide: void
  livePrevSlide: void
}
```

## Eventos de Live Control

Estos eventos se usan para el control remoto de pantallas en vivo. Cualquier cliente (renderer o remoto) puede emitirlos.

| Evento | Payload | Descripción |
|---|---|---|
| `liveSendToItem` | `{ itemId: string }` | Enviar item del cronograma a live |
| `liveClearItem` | `void` | Limpiar item en vivo |
| `liveNextSlide` | `void` | Avanzar al siguiente slide |
| `livePrevSlide` | `void` | Retroceder al slide anterior |
| `liveGoToSlide` | `{ index: number }` | Ir a un slide específico |
| `liveSetHideText` | `{ active: boolean }` | Ocultar/mostrar texto en live |
| `liveSetShowLogo` | `{ active: boolean }` | Mostrar logo/fallback |
| `liveSetBlackScreen` | `{ active: boolean }` | Pantalla negra |
| `liveSetShowLiveScreen` | `{ active: boolean }` | Encender/apagar la proyección (toggle «En Vivo»). Único camino aceptado para apagarla desde un remoto |
| `liveStateUpdate` | `LiveStateUpdate` (incluye `themeId`) | Espejo bidireccional del estado live entre host y remotos |
| `scheduleStateUpdate` | `ScheduleStateUpdate` | Broadcast de estado del cronograma (host → remotos) |
| `requestScheduleState` | `void` | Cliente remoto pide el estado actual del cronograma al host |

El `LiveContext` en el renderer escucha todos estos eventos y los procesa como si fueran acciones locales del operador.

### Apagar la proyección: orden explícita, no estado espejado

`liveStateUpdate` lo emiten y aplican ambos lados (así controla el remoto: muta su propio `LiveContext` y el host espeja el resultado). El problema es que ese espejo **no distingue una orden del operador de un eco del ciclo de vida del cliente**: al arrancar o cerrarse la app cliente, su `showLiveScreen: false` llegaba al host y le cerraba las pantallas en vivo.

Por eso `showLiveScreen` se saca del espejo y viaja como comando propio:

| Camino | Quién | Efecto en el host |
|---|---|---|
| `liveSetShowLiveScreen { active }` | El toggle «En Vivo» del operador remoto | Enciende **y apaga** — es intención explícita |
| `liveStateUpdate.showLiveScreen` | Espejo pasivo de estado | El host solo acepta `true`; ignora `false` |

Reglas al tocar esto:

- El cliente remoto **no emite** la rama de "todo apagado" de `liveStateUpdate`; usa el comando.
- El host **solo aplica `showLiveScreen: true`** desde `liveStateUpdate`. Encender por espejo debe seguir funcionando: al mandar un item, `itemOnLive` deja de ser null y el propio host activa la proyección.
- El cliente remoto sí espeja ambos valores: para él, el `showLiveScreen` del host es la verdad.
- `setShowLiveScreen` del `LiveContext` ya emite el comando cuando `isRemoteMode`; llamar al setter interno de React directamente se saltaría esa señal.

## Eventos de salida de texto para OBS (subtítulos)

Alimentan la página `/obs` (browser source de OBS) servida por `apps/api/src/controllers/obs/obsOverlay.controller.ts`. También se relayan (allowlist en `index.ts`).

| Evento | Payload | Descripción |
|---|---|---|
| `obsTextUpdate` | `{ text: string; reference?: string; contentType?: string }` | El host emite el texto plano + referencia bíblica + tipo (`itemOnLive.type`) actualmente en vivo (vacío si oculto/negro/logo, TIMER o medio). Lo calcula `liveContext` con `extractOverlayText`/`extractOverlayReference` (`app/lib/presentationOverlayText.ts`). Cada página `/obs/subtitle/<slug>` filtra por `contentType` según su `types` |
| `obsConfigUpdate` | `ObsOverlayConfig` | El diálogo lo emite al guardar; cada página recarga su `/obs/subtitle/<slug>/config` y se re-estiliza (el payload se ignora) |
| `requestObsText` | `void` | La página `/obs/subtitle/<slug>`, al conectar, pide el estado actual (late join); `liveContext` responde con `obsTextUpdate` |

`ObsOverlayConfig` (estilo) y `ObsSubtitle` (`= ObsOverlayConfig + { slug, name, types }`) se definen en `apps/api/src/controllers/obs/obsOverlayConfig.ts`. La **lista** de subtítulos se persiste como blob JSON en `Setting` bajo la clave pública `OBS_SUBTITLES` (migra del antiguo `OBS_TEXT_OVERLAY_CONFIG`). Ver [`controllers/obs/agents.md`](../controllers/obs/agents.md).

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
4. Si es bidirectional/relay: agregar el nombre del evento al array `liveRelayEvents` en el `io.on('connection')` de `index.ts`:
   ```typescript
   const liveRelayEvents = ['liveNextSlide', 'myNewEvent', ...]
   ```
5. Frontend lo recibe tipado automáticamente vía `Api.socket.listen.eventName(cb)` o emite con `Api.socket.emit.eventName(data)`

No hay que tocar `packages/queries/` para agregar eventos.

## Runtime

### `socket.service.ts`
- `setSocketIO(instance)` — inyecta el `SocketIOServer` (llamado desde `index.ts`)
- `getSocket()` — devuelve el singleton `{ emit, on }`

### `socket-handlers.ts`
- `registerSocketHandlers()` — registra todos los handlers de eventos frontend → API
- Se llama después de `setSocketIO()` en `index.ts`
- Usa `import()` dinámico para evitar circular dependencies con los services que escucha

### Proxy `on` — wiring automático per-connection
- Cuando se registra un handler con `socket.on.eventName(cb)`, se aplica a todas las conexiones **actuales** y **futuras**
- Retorna una función `unsubscribe` que remueve el handler de todas las conexiones

### Relay handlers en `index.ts`
- Los eventos live:* se registran como relay dentro del callback `io.on('connection')`
- También se relayan `scheduleStateUpdate` y `requestScheduleState` para sincronización de cronograma
- Usan `socket.broadcast.emit(event, data)` para re-enviar a todos los clientes excepto el emisor
- No requieren lógica de negocio del lado del servidor

## Dependencia con queries

`packages/queries/src/socket.ts` importa `SocketEventMap` desde `@ecclesia/api` y deriva automáticamente los tipos de `Api.socket.listen` y `Api.socket.emit`. No hay definiciones duplicadas.
