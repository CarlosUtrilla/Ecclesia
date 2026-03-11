# Electron (Main Process) Agent

> **Agent router:** [`/agents.md`](../agents.md)

## Descripcion

Proceso principal de Electron. Gestiona ventanas, servidor de medios locales, manejo de pantallas/displays, importacion de biblias e inicializacion de la base de datos.

## Archivos

```text
electron/
├── main/
│   ├── index.ts
│   ├── windowManager.ts
│   ├── prisma.ts
│   ├── liveMediaController.ts
│   ├── updaterManager/
│   │   ├── updaterManager.ts    # Auto-update con electron-updater (canal beta)
│   │   └── updaterAPI.ts        # IPC API expuesta al renderer
│   ├── googleDriveSyncManager/
│   ├── bibleManager/
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
3. registerRoutes()               -> Registra IPC handlers de database/
4. initializeBibleManager()       -> Registra IPC handlers de biblia
5. initializeDisplayManager()     -> Registra IPC handlers de pantallas
6. initializeLiveMediaManager()   -> Registra canal IPC de media en vivo
7. initializeUpdaterManager()     -> Registra auto-updater (canal beta, check a los 10s)
8. Registra IPC locales           -> Fuentes, ventanas, notificaciones
9. createMainWindow()             -> Crea ventana principal
```

## Flujo de cierre

- En `before-quit` se limpian los timers persistidos de `StageScreenConfig.state`.
- Solo se vacia `state.timers`; `message` y `clock` se conservan.

## Modulos

### GoogleDriveSyncManager (`googleDriveSyncManager/`)

- Manager dedicado para sincronizacion **snapshot-based** con Google Drive usando `appDataFolder`.
- El login OAuth se abre en ventana interna de Electron.
- Canales IPC:
  - `sync:google-drive:status`
  - `sync:google-drive:configure`
  - `sync:google-drive:connect`
  - `sync:google-drive:disconnect`
  - `sync:google-drive:push`
  - `sync:google-drive:pull`
  - `sync:google-drive:reconcile`
- Evento IPC adicional: `sync:google-drive:auto-save-event` para autosync al guardar.
- Emite `sync-state` al renderer con `{ syncing, progress }`.

#### Arquitectura snapshot-based (actual)

- **Flujo push**: `reconcileSyncData()` → `buildSnapshot()` (todos los modelos de BD) → `uploadSnapshot()` → `syncMediaManifest push` → `syncBibleFiles push` → `writeRemoteManifest`.
- **Flujo pull**: `pullAllRemoteSnapshots()` → descarga snapshots de otros dispositivos → `applySnapshotRows()` (lastWriteWins por `updatedAt`) → `syncMediaManifest pull` → `syncBibleFiles pull`.
- **Ping-pong fix**: Prisma `@updatedAt` auto-incrementa en cada write. Se usa `$executeRawUnsafe` dentro de `prisma.$transaction` para restaurar el `updatedAt` original del snapshot después de cada apply.
- **Archivos en Drive**: `ecclesia-snapshot-{workspaceId}-{deviceId}.json` (un snapshot por dispositivo).
- **deviceId / deviceName**: basado en `os.hostname()`; dos dispositivos con el mismo hostname no pueden sincronizarse correctamente.

#### Sincronizacion de archivos

- **Media (imágenes/videos)**: Manifest `ecclesia-media-manifest-{workspaceId}.json` con checksum SHA-256. Incluye también archivos de fuentes (`Font` model, `userData/media/fonts/`).
- **Biblias importadas**: Manifest `ecclesia-bible-manifest-{workspaceId}.json` + blobs `ecclesia-bible-blob-{workspaceId}-{checksum}.bin`. Las biblias bundled en `resources/bibles/` se excluyen de la sincronización.
- `media_manifest` propaga tombstones (`deletedAt`) para borrado remoto/local.

#### Observabilidad y scheduler

- OAuth se carga con `loadAppEnv()` (`.env`, `.env.local` o `userData/.env`).
- `status` reporta: `nextRunAt`, `lastRunStatus`, `lastRunReason`, `lastRunAt`, `lastRunError`, `deviceName`, `systemHostname`.
- El scheduler tiene backoff exponencial persistido: `retryCount`, `nextRetryAt`, `schedulerHealthy`, `lastSchedulerHeartbeatAt`.
- Helpers puros de retry exportados: `calculateRetryDelayMs()` y `buildRetryBackoffState()`.
- `executeSyncCycle()` se exporta para pruebas de recovery del scheduler.

#### Micro-sync (push diferencial inmediato)

- **`scheduleMicroPush()`**: Debounce de 1 s → llama `pushSnapshotOnly()`. Se dispara desde `setOnOutboxWriteCallback` (cualquier write a BD).
- **`scheduleMicroMediaPush()`**: Debounce de 1 s → llama `pushMediaOnly()`. Se dispara desde `setOnMediaChangeCallback` (writes a `Media` o `Font`). Llama también a `scheduleMicroPush()`.
- `pushSnapshotOnly` / `pushMediaOnly`: leen config y token del disco, aplican defaults de `workspaceId`/`deviceName`, verifican `!isSyncing`, luego ejecutan. Loguean errores via `log.error` (nunca silenciosos).
- **`getOrCreateEcclesiaFolder`**: usa `cachedDriveFolderId` + `folderCreationPromise` (mutex de promise) para evitar race condition en llamadas concurrentes cuando la carpeta no existe.

#### Bug crítico corregido: `notifySyncState` en dispositivo secundario

- Antes: si `conflictStrategy=primaryDevice` y el dispositivo era secundario, se llamaba `notifySyncState(true, 100)` sin el correspondiente `notifySyncState(false)`, dejando `isSyncing=true` permanentemente.
- Ahora: se llama `notifySyncState(false)` antes de retornar en ese caso.

#### IMPORTANTE: electron-log solo en main

- `electron-log` NO debe importarse en archivos del directorio `database/` porque esos archivos se bundlean en el preload (renderer). Usar `console.warn`/`console.error` en su lugar.
- Solo los archivos en `electron/main/` usan `electron-log`.

#### Cobertura de tests

- `electron/main/googleDriveSyncManager/googleDriveSyncManager.test.ts`
- `electron/main/googleDriveSyncManager/googleDriveSyncManager.scheduler.test.ts`
  - Incluye escenario de retry disparado por temporizador (sin invocacion manual del ciclo).
- `electron/main/googleDriveSyncManager/googleDriveSyncManager.media.test.ts`
  - Valida integridad de media (dedupe por checksum, descarga diferencial, tombstones, manifest remoto invalido) y transferencia por delta.

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
| `createStageLayoutWindow()` | `/stage-layout` | Ventana de layout stage |

- `settings`, `stage-control` y `stage-layout` son ventana unica: si ya existen, se enfocan.
- Apertura de ventanas via IPC (`ipcMain.on(...)`) delega en `window.windowAPI.*`.

### LiveMediaController (`liveMediaController.ts`)

- Manager dedicado para media en vivo.
- Canal IPC: `live-media-state`.
- Expone API en preload como `liveMediaAPI`.

### Updater Manager (`updaterManager/`)

- `updaterManager.ts`: logica de auto-update usando `electron-updater`.
  - Canal configurado: `beta`.
  - `autoDownload: false` — el usuario decide cuando descargar.
  - Verifica actualizaciones automaticamente 10 segundos despues del arranque.
  - `setFeedURL` con `private: true` y `channel: 'beta'` para repos privados de GitHub.
  - Emite eventos IPC a todas las ventanas: `updater:checking-for-update`, `updater:update-available`, `updater:update-not-available`, `updater:error`, `updater:download-progress`, `updater:update-downloaded`.
  - Canales IPC manejados:
    - `updater:check` (invoke) — verificacion manual
    - `updater:download` (invoke) — iniciar descarga
    - `updater:install` (on) — instalar y reiniciar
    - `updater:get-version` (invoke) — version actual
- `updaterAPI.ts`: API expuesta al renderer via contextBridge en `window.updaterAPI`.
- La configuracion del proveedor esta en `electron-builder.yml` (GitHub, canal beta).

> **TODO (cuando se lance la version estable):** cambiar `beta` → `latest` en 3 lugares:
> 1. `electron-builder.yml` → `publish.channel: latest` (genera `latest.yml` en el release)
> 2. `dev-app-update.yml` → `channel: latest`
> 3. `updaterManager.ts` → `autoUpdater.channel = 'latest'` y `setFeedURL({ channel: 'latest' })`

### Media Manager (`mediaManager/`)

- `mediaServer.ts`: servidor HTTP local para servir archivos de medios.
- `mediaHandlers.ts`: importacion de medios.
  - Copia archivos al directorio de datos.
  - Genera thumbnails para imagenes/videos.
  - Extrae metadatos (dimensiones, duracion).
  - Registra en DB via `MediaService`.
- El renderer construye URLs `http://localhost:{port}/{filePath}` con `useMediaServer()`.

### Bible Manager (`bibleManager/`)

- Gestiona archivos `.ebbl` (SQLite separadas).
- Fuentes de biblias: `resources/bibles/` y directorio de datos del usuario.
- Usa `better-sqlite3` para consultas directas.
- IPC handlers:
  - `bible.getVerses(version, book, chapter, verseStart, verseEnd)`
  - `bible.getCompleteChapter(version, book, chapter)`
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
- `showLiveScreen` y `showStageScreen` reutilizan instancia por `displayId` si ya existe.

### Prisma Initialization (`prisma.ts`)

Maneja la inicializacion robusta de la base de datos:

1. Ruta de DB:
   - Desarrollo: `{proyecto}/prisma/dev.db`
   - Produccion: `{home}/Library/Application Support/ecclesia/dev.db`
2. Backups automaticos antes de migrar.
3. Validacion de schema antes de conectar.
4. Migracion automatica con fallback a SQL.
5. Preservacion de datos ante corrupcion de schema.
6. Middleware de sync outbox para registrar cambios de dominio y mutaciones bulk best-effort.
7. Bypass controlado con `runWithoutSyncOutboxTracking()` para reconciliacion interna.

## IPC Events (entre ventanas)

| Evento IPC | Disparado por | Efecto en main window |
| --- | --- | --- |
| `theme-saved` | ThemesEditor | Refetch de temas (`useThemes()`) |
| `tags-saved` | TagSongsEditor | Refetch de tags (`useTagSongs()`) |
| `song-saved` | SongEditor | Refetch de canciones |
| `schedule-group-templates-saved` | GroupTemplateManager | Refetch de plantillas |
| `display-update` | displayManager | Refetch de displays |
| `live-screen-ready` | LiveScreen window | Marca pantalla como lista |
| `liveScreen-hide` | LiveScreen window | Notifica ocultamiento |

## APIs expuestas al renderer (preload)

Definidas en `electron/preload/index.ts`:

| API global | Metodos principales |
| --- | --- |
| `window.api` | Namespaces de `database/routes.ts` |
| `window.mediaAPI` | `getMediaServerPort()`, `importMedia()` |
| `window.displayAPI` | `getDisplays()`, `showLiveScreen()`, `closeLiveScreen()`, `showStageScreen()`, `closeStageScreen()`, `updateLiveScreenContent()`, `updateLiveScreenTheme()`, `updateStageScreenConfig()` |
| `window.windowAPI` | `openSongWindow()`, `openThemeWindow()`, `openTagsSongWindow()`, `openStageControlWindow()`, `openStageLayoutWindow()`, `closeCurrentWindow()` |
| `window.bibleAPI` | Wrappers del bible manager |
| `window.googleDriveSyncAPI` | `getStatus()`, `connect()`, `disconnect()`, `pushNow()`, `pullNow()` |
| `window.updaterAPI` | `checkForUpdates()`, `downloadUpdate()`, `installUpdate()`, `getVersion()`, `onUpdateAvailable()`, `onUpdateDownloaded()`, `onDownloadProgress()` |

## Convenciones

- `ipcMain.handle()` para request-response.
- `ipcMain.on()` para fire-and-forget.
- `ipcRenderer.send()` envia al main; `ipcRenderer.on()` escucha eventos del main.
- Los medios se almacenan fuera de la DB, en el directorio de datos de la app.
- Cada manager mantiene su propio punto de registro de handlers.

## Agents relacionados

- Rutas IPC de database: `database/agents.md`
- Modelos de datos: `prisma/agents.md`
- Consumo de APIs en frontend: `app/contexts/agents.md`
- Pantallas live: `app/screens/panels/schedule/agents.md`
