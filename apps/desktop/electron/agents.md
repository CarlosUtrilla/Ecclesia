# Electron (Main Process) Agent

> **Agent router:** [`/agents.md`](../agents.md)

## Descripcion

Proceso principal de Electron. Gestiona ventanas, manejo de pantallas/displays, importacion de biblias e inicializacion de la base de datos. El servidor de medios funciona via Express sidecar (puerto 7777).

## Archivos

```text
electron/
├── main/
│   ├── index.ts
│   ├── windowManager.ts
│   ├── prisma.ts
│   ├── updaterManager/
│   │   ├── updaterManager.ts    # Auto-update con electron-updater (canal beta)
│   │   └── updaterAPI.ts        # IPC API expuesta al renderer
│   ├── sync/
│   │   ├── sync-init.ts          # OAuth BrowserWindow, close flow helpers (scheduler migrado a API)
│   │   └── outboxPayload.test.ts
│   ├── bibleManager/
│   ├── displayManager/
│   └── mediaManager/
└── preload/
    └── index.ts
```

## Controladores IPC dedicados

Cada canal IPC debe tener su propio archivo controlador en `electron/main/`, siguiendo el patron:

```ts
export function initializeXManager() {
  ipcMain.handle('channel', handler)
}
```

Patron obligatorio para managers:

- Cada manager debe tener funcion `initializeXManager()`.
- Registrar todos los handlers IPC en esa funcion.
- Ser importado y llamado en `main/index.ts` (no en otro manager).
- Documentar canal y proposito en este archivo.
- No mezclar handlers de diferentes managers en un solo archivo.

## Flujo de inicializacion

En `electron/main/index.ts`, al ejecutar `app.whenReady()`:

```text
1. initPrisma()                   -> Inicializa DB y migraciones
2. initializeMediaManager()       -> Inicia servidor HTTP de medios
3. registerRoutes()               -> Registra IPC handlers de @ecclesia/api
4. initializeBibleManager()       -> Registra IPC handlers de biblia
5. initializeDisplayManager()     -> Registra IPC handlers de pantallas
6. initializeRemoteManager()      -> Inicia listener UDP + registra IPC handlers de descubrimiento LAN
7. initializeUpdaterManager()     -> Registra auto-updater (canal beta, check a los 10s)
8. Registra IPC locales           -> Fuentes, ventanas, notificaciones
9. createMainWindow()            -> Crea ventana principal
```

## Flujo de cierre

- En `before-quit` se limpian los timers persistidos de `StageScreenConfig.state`.
- Solo se vacia `state.timers`; `message` y `clock` se conservan.
- Canal IPC `window:trigger-close`: llama a `mainWindow.close()` desde el renderer (usado por `UpdateNotification` para instalar actualizaciones respetando el flujo de sync).
- `getMainWindow()` exportado desde `windowManager.ts` devuelve la referencia a la ventana principal activa.

## Modulos

### Sync Manager (`sync/`)

Manager modular de sincronización **snapshot-based** con Google Drive. Arquitectura thin Electron + thick API:

- **Electron (`sync/`)**:
  - `sync-init.ts`: OAuth BrowserWindow, close flow helpers (`getIsSyncing`, `executeSyncCycle` llamando a API vía syncBridge).
  - `syncBridge.ts`: Helpers HTTP para que el main process llame a la API.
  - Scheduler (setInterval 5min) y micro-push → migrados a `apps/api/src/services/sync-scheduler.service.ts`.

- **API (`apps/api/src/controllers/sync/`)** — toda la lógica real vive aquí:
  - `sync.controller.ts`: Expone los métodos como endpoints Express (`/api/sync/*`).
  - `sync-drive-ops.service.ts`: Operaciones Drive compartidas (find/upsert file, list by prefix, download blob, verify fileId).
  - `sync-drive-client.service.ts`: OAuth client, Drive API client, carpeta Ecclesia, appInstanceId.
  - `sync-state.service.ts`: Persistencia de estado (state file), retry backoff.
  - `sync-snapshot.service.ts`: Build/upload/download/aplicar snapshots de BD.
  - `sync-media.service.ts`: Manifest + blob sync para media (imágenes/videos).
  - `sync-bible.service.ts`: Manifest + blob sync para biblias importadas.
  - `sync-push.service.ts`: Orquestación push (snapshot + media + bible + outbox acks).
  - `sync-pull.service.ts`: Orquestación pull (snapshots remotos + media + bible).
  - `sync-diagnostic.service.ts`: Diagnóstico y reparación de blobs.
  - `sync-cleanup.service.ts`: Limpieza de huérfanos (disco + Drive).
  - `sync-lazy-fetch.service.ts`: Lazy fetch desde Drive para media server.
  - `sync.config.ts`: Constantes, tipos, helpers, snapshot model definitions.
  - `sync.utils.ts`: Utilidades de I/O, checksum.

El renderer ya no usa IPC para sync — todas las operaciones van por HTTP directo (`Api.fetch.sync.*`) y eventos Socket.IO (`Api.socket.listen.syncProgress`). Electron solo mantiene el scheduler, `before-quit`, OAuth BrowserWindow y micro-push vía `syncBridge.ts`.

- **Eventos IPC**: `sync-state` emitido con `{ syncing, progress, error }`

#### OAuth Flow

- `showOAuthWindow()` en `sync-init.ts` abre `BrowserWindow`, captura el código OAuth de la URL, y llama `exchangeOAuthCode()` que delega en la API vía `syncBridge.ts`.
- La API usa `driveClientService.getAuthUrl()` / `driveClientService.exchangeAuthCode()`.

#### Arquitectura snapshot-based

- **Flujo push**: `syncPushService.push()` → `buildSnapshot()` → `uploadSnapshot()` → Promise.all `syncMediaManifest push` + `syncBibleFiles push` → `writeRemoteManifest`.
- **Micro-sync**: Debounce 1s `scheduleMicroPush()` / `scheduleMicroMediaPush()` en Electron, llama `syncPush()` vía HTTP.
- **Flujo pull**: `syncPullService.pull()` → `pullAndApplySnapshots()` (descarga snapshots de otros dispositivos, `applySnapshotRows` con lastWriteWins) → Promise.all `syncMediaManifest pull` + `syncBibleFiles pull`.
- **Archivos en Drive**: `ecclesia-snapshot-{workspaceId}-{deviceId}.json`, `ecclesia-media-manifest-{workspaceId}.json`, `ecclesia-media-blob-{workspaceId}-{checksum}.bin`, `ecclesia-bible-manifest-{workspaceId}.json`, `ecclesia-bible-blob-{workspaceId}-{checksum}.bin`.
- Ver documentación completa de optimizaciones, grace window, paginación, tombstones, driveFileId backfill, y fixes en `apps/api/src/controllers/sync/sync-media.service.ts` y sus archivos relacionados.

#### IMPORTANTE: electron-log solo en main

- `electron-log` NO debe importarse en archivos de `@ecclesia/api` porque se bundlean en el preload (renderer). Usar `console.warn`/`console.error` en su lugar.
- Solo los archivos en `electron/main/` usan `electron-log`.

### Window Manager (`windowManager.ts`)

Gestiona todas las ventanas de la aplicacion:

| Funcion | Ruta hash | Proposito |
| --- | --- | --- |
| `createMainWindow()` | `/` | Ventana principal con layout de paneles |
| `createSongWindow(songId?)` | `/song/new` o `/song/:id` | Editor de canciones |
| `createThemeWindow(themeId?)` | `/theme/new` o `/theme/:id` | Editor de temas |
| `createPresentationWindow(presentationId?)` | `/presentation/new` o `/presentation/:id` | Editor de presentaciones |
| `createTagsSongWindow()` | `/tagSongEditor` | Editor de tags de canciones |
| `createSettingsWindow()` | `/settings` | Ventana de ajustes |
| `createStageControlWindow()` | `/stage-control` | Ventana de control stage |

- `settings` y `stage-control` son ventana única: si ya existen, se enfocan.
- Apertura de ventanas via IPC (`ipcMain.on(...)`) delega en `window.windowAPI.*`.
- `createThemeWindow()` y `createPresentationWindow()` interceptan el evento nativo `close`, cancelan el cierre inicial y notifican al renderer (`theme-close-requested` / `presentation-close-requested`) para que el editor decida si debe confirmar o bloquear el cierre.

#### Estrategia de pre-warming (Performance)

Todas las ventanas secundarias se pre-calientan al arranque de la app (4s después del `ready-to-show` de la ventana principal):

```text
prewarmEditorWindows()  →  crea hidden BrowserWindows para:
  song, theme, presentation, tagSongEditor,
  settings, stage-control
```

- Cada ventana pre-calentada tiene su `warm*WindowRef` correspondiente.
- Al abrir: si el ref warm está vivo → `showWarmWindow()` (navega + `show()` en 30ms), el pool se repone con `setTimeout(prewarmEditorWindows, 1500)`.
- Si el ref warm no está disponible: flujo normal (crea `BrowserWindow` desde cero + `ready-to-show`).
- `settings` y `stage-control`: son singleton — el warm ref se asigna al singleton ref en el momento de mostrar; `focusExistingWindow` sigue funcionando correctamente.
- `loadRoute(win, route)` y `showWarmWindow(win, route)` son helpers internos del módulo.

### Live Media State — reemplazado por Socket.IO

El broadcast de estado de media en vivo se maneja via Socket.IO en `@ecclesia/api`. `Api.socket.emit.liveMediaState(state)` desde cualquier ventana es recibido por `Api.socket.listen.liveMediaState(cb)` en todas las ventanas conectadas. Los archivos `liveMediaController.ts` y `liveMediaAPI.ts` fueron eliminados.

### Updater Manager (`updaterManager/`)

- `updaterManager.ts`: logica de auto-update usando `electron-updater`.
  - Canal configurado: `latest` (genera `latest.yml` en el release).
  - `autoDownload: false` — el usuario decide cuando descargar.
  - Verifica actualizaciones automaticamente 10 segundos despues del arranque.
  - `setFeedURL` con `private: true` y `channel: 'latest'` para repos privados de GitHub.
  - Emite eventos IPC a todas las ventanas: `updater:checking-for-update`, `updater:update-available`, `updater:update-not-available`, `updater:error`, `updater:download-progress`, `updater:update-downloaded`.
  - **Cleanup pre-actualización** (Windows fix EPERM): Antes de `quitAndInstall`:
    1. Detiene servidor de medios (`stopMediaServer()`)
    2. Desconecta Prisma (`prisma.$disconnect()`) — libera SQLite/archivos de biblias
    - Esto evita archivos bloqueados/permisos corruptos en Windows durante actualización
  - Canales IPC manejados:
    - `updater:check` (invoke) — verificacion manual
    - `updater:download` (invoke) — iniciar descarga
    - `updater:install` (on) — **ahora con cleanup automático antes de instalar**
    - `updater:get-version` (invoke) — version actual
- `updaterAPI.ts`: API expuesta al renderer via contextBridge en `window.updaterAPI`.
- La configuracion del proveedor esta en `electron-builder.yml` (GitHub, canal `latest`).

### Media Manager (`mediaManager/`)

- Servicio de archivos de medios delegado al Express sidecar (puerto 7777) en `@ecclesia/api`. `registerMediaServerRoutes()` monta `express.static` en `/media/*`.
- `mediaHandlers.ts`: importacion de medios (diálogos nativos).
  - `media:select-files`: diálogo nativo de selección de archivos multimedia.
  - `bible:select-bible-file`: diálogo nativo de selección de archivos `.ebbl`.
- `mediaThumbnails.ts`: **módulo compartido** con funciones de generación de thumbnails/fallbacks (`generateImageThumbnail`, `generateVideoThumbnail`, `generateVideoFallback`) y helpers de naming (`buildThumbnailFileName`, `buildFallbackFileName`, `getThumbnailsPath`). Importado tanto por `mediaHandlers.ts` como por `themes.service.ts` para evitar duplicación.
- El renderer construye URLs `http://localhost:7777/media/{filePath}` con `useMediaServer()`.
- Ya no hay servidor HTTP de medios en Electron — el middleware Express en el sidecar lo reemplaza.

### Bible Search — reemplazado por Socket.IO

El broadcast de búsqueda bíblica se maneja via Socket.IO en `@ecclesia/api`. `Api.socket.emit.bibleSearch(data)` desde cualquier ventana es recibido por `Api.socket.listen.bibleSearch(cb)` en todas las ventanas conectadas. Archivos `bibleSearchManager.ts` y `bibleSearchAPI.ts` fueron eliminados.

### Remote Manager (`remoteManager.ts`)

- Manager dedicado para descubrimiento LAN de otras instancias de Ecclesia.
- Delega en `@ecclesia/api/src/services/udp-discovery.service.ts` para toda la lógica UDP (listener + scanner).
- El cliente se conecta al host vía `setApiConfiguration(queryClient, 'http://{ip}', 7777)` (desde el renderer) — todas las llamadas `Api.fetch.*` van directo al host.
- Las actualizaciones fluyen vía SSE: el host emite `query-keys-invalidate` a todos los clientes conectados.
- Canal IPC:
  - `remote:discover-lan` → Invoke, devuelve `LanDevice[]` (`{ ip: string, name: string }`)
- Endpoint HTTP alternativo: `GET /api/remote/discover-lan` (para frontend remoto).

### Bible Manager (`bibleManager/`)

- Gestiona archivos `.ebbl` (SQLite separadas).
- Fuentes de biblias: `resources/bibles/` y directorio de datos del usuario.
- Usa `better-sqlite3` para consultas directas.
- IPC handlers:
  - `bible.getVerses(version, book, chapter, verseStart, verseEnd)`
  - `bible.getCompleteChapter({ version, book, chapter })`
  - `bible.getAvailableBibles()`
  - `bible.importBible(filePath)`
  - `bible.searchTextFragment(version, text)`

### Display Manager (`displayManager/`)

- Detecta pantallas con `screen.getAllDisplays()`.
- Guarda configuracion en `SelectedScreens`.
- Emite `display-update` cuando hay cambios.
- `show-new-display-connected` responde a la ventana invocante para evitar overlays en `live-screen`.
- Gestiona ventanas de live y stage:
  - `showLiveScreen(displayId)`
  - `closeLiveScreen(windowId)`
  - `showStageScreen(displayId)`
  - `closeStageScreen(windowId)`
  - `updateLiveScreenContent(windowId, content)`
  - `updateLiveScreenTheme(windowId, theme)`
- `updateLiveScreenContent` soporta `liveControls` (`hideText`, `showLogo`, `blackScreen`).
- `updateLiveScreenContent` admite payload parcial (`itemIndex`, `contentScreen`, `presentationVerseBySlideKey`, `liveControls`) para evitar broadcasts de contenido completo cuando solo cambian controles en vivo.
- `displayManager/index.ts` importa explícitamente los tipos usados en IPC (`ThemeWithMedia` y `StageScreenConfigUpdate`) para mantener tipado estricto en build de main process.
- `showLiveScreen` y `showStageScreen` reutilizan instancia por `displayId` si ya existe.
- `showLiveScreen` refuerza `setBounds(display.bounds)` + `setFullScreen(true)` tanto en creación como en reuso de ventana para evitar aperturas parciales/pequeñas en algunos entornos Windows multi-display.
- `showLiveScreen` crea y mantiene la ventana con `skipTaskbar: true` (y `setSkipTaskbar(true)` en creación/reuso) para que las pantallas de proyección en vivo no aparezcan en la barra de tareas/dock.
- `showStageScreen` también refuerza `setBounds(display.bounds)` + `setFullScreen(true)` tanto en creación como en reuso de ventana para evitar recortes al adaptar resoluciones o reconectar pantallas.

### Prisma Initialization (`prisma.ts`)

Wrapper fino que delega toda la lógica de inicialización a `@ecclesia/api`:

1. Construye un `DatabaseConfig` con paths de Electron (`app.isPackaged`, `app.getPath('userData')`, `process.resourcesPath`, `process.cwd()`).
2. Llama a `initializeDatabase(config)` desde `@ecclesia/api/src/prisma-init`.
3. Re-exporta `getPrisma()`, `setOnOutboxWriteCallback()`, `setOnMediaChangeCallback()`.
4. Toda la lógica real (migraciones, backup, validación, middleware outbox) vive en `apps/api/src/prisma-init.ts`.

#### Build-safe DB template

- `electron-builder` ejecuta `beforePack` (`scripts/before-pack.cjs`) para regenerar `apps/api/prisma/empty-prod.db` con `prisma migrate deploy` sobre un archivo nuevo.
- El empaquetado excluye `prisma/dev.db` y `prisma/dev.db-*` para evitar incluir datos de pruebas locales en releases.
- `extraResources` incluye `apps/api/prisma/migrations/**`, `apps/api/prisma/schema.prisma` y `apps/api/prisma/empty-prod.db`.

## Eventos entre ventanas

Las ventanas ya no se comunican por IPC directo. La invalidación de queries cross-window se maneja via SSE (`/api/remote/events`) desde el servidor Express. Los eventos de pantalla (live/stage updates) se transmiten via `webContents.send` desde displayManager.

## APIs expuestas al renderer (preload)

Definidas en `electron/preload/index.ts`:

| API global | Metodos principales |
| --- | --- |
| `window.api` | Namespaces de `@ecclesia/api` (routes.ts) |
| `window.mediaAPI` | `selectFiles()`, `getPathForFile()`, `selectBibleFiles()` |
| `window.displayAPI` | `getDisplays()`, `showLiveScreen()`, `closeLiveScreen()`, `showStageScreen()`, `closeStageScreen()`, `updateLiveScreenContent()`, `updateLiveScreenTheme()`, `updateStageScreenConfig()` |
| `window.windowAPI` | `openSongWindow()`, `openThemeWindow()`, `openTagsSongWindow()`, `openStageControlWindow()`, `closeCurrentWindow()` |
| `window.bibleAPI` | Wrappers del bible manager |
El renderer ahora usa `Api.fetch.sync.*` (HTTP directo) en lugar de canales IPC. `window.googleDriveSyncAPI` y `window.liveMediaAPI` fueron eliminados — ambos reemplazados por Socket.IO.
| `window.updaterAPI` | `checkForUpdates()`, `downloadUpdate()`, `installUpdate()`, `getVersion()`, `onUpdateAvailable()`, `onUpdateDownloaded()`, `onDownloadProgress()` |
| `window.remoteControlAPI` | `discoverLan()` |

## Convenciones

- `ipcMain.handle()` para request-response.
- `ipcMain.on()` para fire-and-forget.
- `ipcRenderer.send()` envia al main; `ipcRenderer.on()` escucha eventos del main.
- Los medios se almacenan fuera de la DB, en el directorio de datos de la app.
- Cada manager mantiene su propio punto de registro de handlers.

## Agents relacionados

- Rutas IPC de database: `apps/api/agents.md`
- Modelos de datos: `prisma/agents.md`
- Consumo de APIs en frontend: `app/contexts/agents.md`
- Pantallas live: `app/screens/panels/schedule/agents.md`
