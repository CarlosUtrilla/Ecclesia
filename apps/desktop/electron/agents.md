# Electron (Main Process) Agent

> **Agent router:** [`/agents.md`](../agents.md)

## Descripcion

Proceso principal de Electron. Gestiona ventanas, servidor de medios locales, manejo de pantallas/displays, importacion de biblias e inicializacion de la base de datos.

## Archivos

```text
electron/
├── main/
│   ├── index.ts
│   ├── ipcHelpers.ts             # Helpers onIpc/onIpcFromWindow/handleIpc para registro IPC
│   ├── windowManager.ts
│   ├── prisma.ts
│   ├── liveMediaController.ts
│   ├── updaterManager/
│   │   ├── updaterManager.ts    # Auto-update con electron-updater (canal beta)
│   │   └── updaterAPI.ts        # IPC API expuesta al renderer
│   ├── sync/
│   │   ├── sync-init.ts          # OAuth BrowserWindow, close flow helpers (scheduler migrado a API)
│   │   └── outboxPayload.test.ts
│   ├── bibleManager/
│   ├── bibleSearchManager.ts
│   ├── bibleSearchAPI.ts
│   ├── displayManager/
│   └── mediaManager/
└── preload/
    └── index.ts
```

## Controladores IPC dedicados

Cada canal IPC debe tener su propio archivo controlador en `electron/main/`, siguiendo el patron:

```ts
// electron/main/liveMediaController.ts
export function initializeLiveMediaManager() {
  ipcMain.on('live-media-state', () => {
    // handler
  })
}
```

Luego se importa y se inicializa en `main/index.ts`:

```ts
import { initializeLiveMediaManager } from './liveMediaController'

app.whenReady().then(() => {
  initializeLiveMediaManager()
})
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
6. initializeLiveMediaManager()   -> Registra canal IPC de media en vivo
7. initializeRemoteManager()      -> Inicia listener UDP + registra IPC handlers de descubrimiento LAN
8. initializeUpdaterManager()     -> Registra auto-updater (canal beta, check a los 10s)
9. Registra IPC locales           -> Fuentes, ventanas, notificaciones
10. createMainWindow()            -> Crea ventana principal
```

## Helpers IPC

`ipcHelpers.ts` exporta tres helpers que reducen boilerplate al registrar canales IPC:

- `onIpc(channel, handler)` → `ipcMain.on` sin acceso al sender window (fire-and-forget sin WebContents).
- `onIpcFromWindow(channel, handler)` → `ipcMain.on` que resuelve `BrowserWindow.fromWebContents(event.sender)` automáticamente y verifica que no esté destruida.
- `handleIpc(channel, handler)` → `ipcMain.handle` para request-response (invoke).

Usar siempre estos helpers en lugar de `ipcMain.on/handle` directo en `index.ts` para handlers locales.

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

- `open-oauth-window` IPC handler en `index.ts` llama `showOAuthWindow()`.
- `showOAuthWindow()` en `sync-init.ts`:
  1. Llama `syncGetAuthUrl()` → `POST /api/sync/getAuthUrl` con PKCE
  2. Abre `BrowserWindow` con la URL de auth de Google
  3. Captura `code` interceptando redirect loopback (`http://127.0.0.1/*`) via `webRequest.onBeforeRequest` (más confiable que `will-redirect`/`will-navigate`)
  4. Llama `syncExchangeOAuthToken(code)` → `POST /api/sync/exchangeOAuthCode`
  5. Emite `oauth-complete` a todas las ventanas vía `notifyWindowsOAuthComplete()`
- `syncBridge.ts` llama `POST /api/sync/getAuthUrl` y `POST /api/sync/exchangeOAuthCode`.
- La API usa `driveClientService.getAuthUrl(redirectUri?)` con PKCE / `driveClientService.exchangeAuthCode(code)`.
- El redirect URI por defecto es `http://127.0.0.1` (loopback IP, debe estar registrado en Google Cloud Console como Authorized redirect URI).

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

### LiveMediaController (`liveMediaController.ts`)

- Manager dedicado para media en vivo.
- Canal IPC: `live-media-state`.
- Expone API en preload como `liveMediaAPI`.
- `liveMediaAPI.onMediaState` desuscribe con `ipcRenderer.removeListener` del handler registrado (no usar `removeAllListeners`) para no romper otros suscriptores del mismo canal dentro de una misma ventana.

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

- `mediaServer.ts`: servidor HTTP local para servir archivos de medios.
  - **Logging detallado**: registra todas las peticiones de videos y errores específicos para facilitar debugging en Windows.
  - **Normalización de rutas**: usa `path.normalize()` para manejar correctamente separadores de Windows.
  - **Validación de permisos**: verifica `fs.constants.R_OK` antes de servir archivos (detecta archivos bloqueados).
  - **Manejo de errores en streams**: captura y loguea errores de `fs.createReadStream()` para detectar problemas de lectura.
- `mediaThumbnails.ts`: **módulo compartido** con funciones de generación de thumbnails/fallbacks (`generateImageThumbnail`, `generateVideoThumbnail`, `generateVideoFallback`) y helpers de naming (`buildThumbnailFileName`, `buildFallbackFileName`, `getThumbnailsPath`). Importado tanto por `mediaHandlers.ts` como por `themes.service.ts` para evitar duplicación.
- `mediaHandlers.ts`: importacion de medios.
  - Copia archivos al directorio de datos.
  - **Permisos en Windows**: establece `chmod 0o644` (rw-r--r--) después de copiar para asegurar lectura.
  - Soporta importación de imágenes pegadas desde portapapeles sin ruta de archivo (`media:import-clipboard-image`) escribiendo temporal local y reutilizando el flujo normal de importación.
  - Genera thumbnails para imagenes/videos (delegando a `mediaThumbnails.ts`).
  - Para imágenes, intenta `sharp` con carga diferida; si `sharp` no está disponible para el runtime actual, hace fallback a `ffmpeg` para evitar crash del proceso principal.
  - Extrae metadatos (dimensiones, duracion).
  - Registra en DB via `MediaService`.
  - El borrado de carpetas (`media:delete-folder`) es recursivo en filesystem para permitir eliminar carpetas con subcarpetas y contenido completo desde Library.
  - Expone extracción de ZIP para flujo Canva (`media:extract-zip-mp4`) que extrae `.mp4` a temporales seguros.
  - Expone limpieza de temporales (`media:cleanup-temp-path`) restringida al root temporal de importaciones Canva.
- El renderer construye URLs `http://localhost:{port}/{filePath}` con `useMediaServer()`.

### Bible Search Manager (`bibleSearchManager.ts`)

- Manager dedicado para enviar un versículo desde la vista live al buscador de biblia.
- Canal IPC:
  - `bible-search` (on): Recibe `BibleSearchData { version, bookId, chapter, verse }` y lo retransmite a todas las ventanas.
- API preload (`bibleSearchAPI.ts`):
  - `sendBibleSearch(data)`: Envía versículo al buscador.
  - `onBibleSearch(callback)`: Escucha eventos de búsqueda; retorna función de cleanup.

### Remote Manager (`remoteManager.ts`)

- Manager dedicado para descubrimiento LAN de otras instancias de Ecclesia.
- Delega en `@ecclesia/api/src/services/udp-discovery.service.ts` para toda la lógica UDP (listener + scanner).
- El cliente se conecta al host vía `setApiConfiguration(queryClient, 'http://{ip}', 7777)` (desde el renderer) — todas las llamadas `Api.fetch.*` van directo al host.
- Las actualizaciones fluyen vía Socket.IO: el host emite `queryKeysInvalidate` a todos los clientes conectados.
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

La comunicación API ↔ frontend es vía HTTP + Socket.IO. La invalidación de queries post-mutación se maneja via Socket.IO (`queryKeysInvalidate`), emitida desde el callback de `registerRoutes` en `apps/api/src/index.ts`. Los eventos de pantalla (live/stage updates) se transmiten via `webContents.send` desde displayManager.

## APIs expuestas al renderer (preload)

Definidas en `electron/preload/index.ts`:

| API global | Metodos principales |
| --- | --- |
| `window.api` | Namespaces de `@ecclesia/api` (routes.ts) |
| `window.mediaAPI` | `getMediaServerPort()`, `selectFiles()`, `getPathForFile()`, `selectBibleFiles()`, `selectDirectory()`, `writeFileToDir()`, `copyFileToDir()`, `saveFile()` |
| `window.displayAPI` | `getDisplays()`, `showLiveScreen()`, `closeLiveScreen()`, `showStageScreen()`, `closeStageScreen()`, `updateLiveScreenContent()`, `updateLiveScreenTheme()`, `updateStageScreenConfig()` |
| `window.windowAPI` | `openSongWindow()`, `openThemeWindow()`, `openTagsSongWindow()`, `openStageControlWindow()`, `closeCurrentWindow()` |
| `window.bibleAPI` | Wrappers del bible manager |
El renderer ahora usa `Api.fetch.sync.*` (HTTP directo) en lugar de canales IPC. `window.googleDriveSyncAPI` fue eliminado.
| `window.updaterAPI` | `checkForUpdates()`, `downloadUpdate()`, `installUpdate()`, `getVersion()`, `onUpdateAvailable()`, `onUpdateDownloaded()`, `onDownloadProgress()` |
| `window.remoteControlAPI` | `discoverLan()` |
| `window.bibleSearchAPI` | `sendBibleSearch()`, `onBibleSearch()` |

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
