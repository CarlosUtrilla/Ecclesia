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
- Canal IPC `window:trigger-close`: llama a `mainWindow.close()` desde el renderer (usado por `UpdateNotification` para instalar actualizaciones respetando el flujo de sync).
- `getMainWindow()` exportado desde `windowManager.ts` devuelve la referencia a la ventana principal activa.

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
- **Optimización idle**: en ciclos normales, el snapshot solo se construye/sube si existe outbox local pendiente (`SyncOutboxChange.ackedAt = null`). Tras upload exitoso, se confirma outbox (`ackedAt`) para evitar re-subidas de snapshot en ciclos sin cambios de BD.
- **Flujo pull**: `pullAllRemoteSnapshots()` → descarga snapshots de otros dispositivos → `applySnapshotRows()` (lastWriteWins por `updatedAt`) → `syncMediaManifest pull` → `syncBibleFiles pull`.
- **Ping-pong fix**: Prisma `@updatedAt` auto-incrementa en cada write. Se usa `$executeRawUnsafe` dentro de `prisma.$transaction` para restaurar el `updatedAt` original del snapshot después de cada apply.
- **Archivos en Drive**: `ecclesia-snapshot-{workspaceId}-{deviceId}.json` (un snapshot por dispositivo).
- **deviceId / deviceName**: basado en `os.hostname()`; dos dispositivos con el mismo hostname no pueden sincronizarse correctamente.

#### Sincronizacion de archivos

- **Media (imágenes/videos)**: Manifest `ecclesia-media-manifest-{workspaceId}.json` con checksum SHA-256. Incluye también archivos de fuentes (`Font` model, `userData/media/fonts/`).
- El build de manifests local (media y biblias) reutiliza checksum previo cuando `size` y `mtime` no cambian, evitando recalcular hash de archivos sin cambios en cada ciclo.
- Cuando se reutiliza checksum local, también se preserva `driveFileId` del manifest local anterior para evitar depender de `files.list()` en cada ciclo.
- **Optimización de búsqueda de blobs:** Cada entry de manifest ahora incluye campo opcional `driveFileId` (Google Drive fileId del blob). En push, al subir un blob, se guarda el `driveFileId` en el manifest remoto. En pull, se carga primero desde `driveFileId` (búsqueda directa vía API), y solo en manifests viejos sin `driveFileId` se hace fallback a búsqueda lenta por nombre (`files.list()` con `name contains`). Esto elimina latencia de indexación de Google Drive que causaba que blobs recién subidos no se encontraran en syncs subsecuentes.
- **Descarga con verificación rápida**: Se introdujo `downloadAndVerifyBlobChecksum()` que descarga blob directo por fileId (sin esperar `files.list()` indexing) y verifica checksum antes de confirmar descarga. En **push**, cuando manifest remoto válido pero blob no está aún indexado: si tenemos `driveFileId` conocido, intenta descargar+verificar primero (evita grace window innecesario si el blob está disponible). En **pull**, todas las descargas usan verificación de checksum para detectar blobs corruptos/incompletos durante transfer.
- En push, cuando checksum coincide y hay blob remoto, se hace **backfill automático** de `driveFileId` en manifest local/remoto si faltaba (sin re-subir blob), facilitando migración de manifests viejos.
- Para detectar `driveFileId` stale sin saturar cuota, se valida existencia remota de IDs en forma acotada (`MAX_DRIVE_FILEID_VERIFICATIONS_PER_CYCLE`), y solo si falla se fuerza re-upload/reparación.
- En push de media, el manifest remoto/local solo se actualiza cuando el blob queda confirmado en Drive. Si `uploadMediaBlob` falla (sin fileId o error de red/archivo bloqueado), se registra el error (con contexto completo) y ese entry se salta; el ciclo continúa con los demás (no se publica checksum huérfano, se loguea para observabilidad). Igual para biblias en `syncBibleFiles push`.
- Si un manifest remoto conserva el mismo checksum pero el blob físico ya no existe en Drive, el siguiente push local reintenta subir ese blob y sana el manifest huérfano automáticamente en vez de saltarlo por igualdad de checksum.
- Para evitar loops de re-upload cuando Drive todavía está asentando/indexando un blob recién subido, el push de media y biblias aplica una ventana de gracia (`BLOB_REUPLOAD_GRACE_MS`, basada en `lastSyncedAt`) antes de reintentar subida por checksum igual + blob no visible. La misma gracia se aplica en pull antes de "reparar" blobs remotos desde copia local. Sin embargo, si hay `driveFileId` conocido, la descarga+verificación intenta primero sin gracia.
- En pull de media, entradas de manifest con checksum sin blob remoto se registran como `missingRemoteBlobs` para observabilidad (sin marcar descarga falsa ni sobrescribir archivo local).
- En pull de media, si `downloadAndVerifyBlobChecksum()` falla por checksum mismatch (blob corrupto/incompleto), la descarga se rechaza y se log como error; el ciclo continúa y marca como faltante. Si falla por 404/notFound del fileId, se marca como `missingRemoteBlobs` y se limpia ese checksum del mapa.
- En pull de media, si falta blob remoto pero existe copia local con el mismo checksum, se re-sube automáticamente el blob para reparar el estado remoto en el mismo ciclo; solo se incrementa `missingRemoteBlobs` cuando no hay forma de reparar.
- En push de media para tombstones (`deletedAt`), no se indexan entradas remotas ya eliminadas para búsqueda por checksum; esto evita trabajo innecesario cuando hay muchos eliminados.
- Si `drive.files.delete(media-blob)` responde `404/notFound`, se considera ya eliminado y se limpia `driveFileId` del tombstone local/remoto para no reintentar borrado en cada ciclo.
- **Biblias importadas**: Manifest `ecclesia-bible-manifest-{workspaceId}.json` + blobs `ecclesia-bible-blob-{workspaceId}-{checksum}.bin`. Las biblias bundled en `resources/bibles/` se excluyen de la sincronización. Usan el mismo sistema de `driveFileId` que media.
- `media_manifest` propaga tombstones (`deletedAt`) para borrado remoto/local.
- El listado de blobs remotos (media y biblias) usa paginación de Drive (`nextPageToken`) para evitar omitir descargas cuando existen más de 1000 archivos en la carpeta de Ecclesia.

#### Observabilidad y scheduler

- OAuth se carga con `loadAppEnv()` (`.env`, `.env.local` o `userData/.env`).
- `status` reporta: `nextRunAt`, `lastRunStatus`, `lastRunReason`, `lastRunAt`, `lastRunError`, `deviceName`, `systemHostname`.
- El sync manager detecta y loguea explícitamente respuestas de rate limit/quota de Google Drive (`429` y `403` con razones `rateLimitExceeded`, `userRateLimitExceeded`, `quotaExceeded`, `dailyLimitExceeded`, `sharingRateLimitExceeded`) incluyendo operación y contexto del archivo/checksum cuando aplica.
- El scheduler tiene backoff exponencial persistido: `retryCount`, `nextRetryAt`, `schedulerHealthy`, `lastSchedulerHeartbeatAt`.
- Helpers puros de retry exportados: `calculateRetryDelayMs()` y `buildRetryBackoffState()`.
- `executeSyncCycle()` se exporta para pruebas de recovery del scheduler.
- En `buildSnapshot`, el acceso dinámico a delegates de Prisma debe usar cast intermedio vía `unknown` (`prisma as unknown as Record<string, unknown>`) para evitar errores de solapamiento de tipos en `tsconfig.node`.

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
  - Valida integridad de media (dedupe por checksum, descarga diferencial, tombstones, manifest remoto invalido), transferencia por delta y paginación de blobs remotos (>1000 archivos).

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

- `settings`, `stage-control` y `stage-layout` son ventana única: si ya existen, se enfocan.
- Apertura de ventanas via IPC (`ipcMain.on(...)`) delega en `window.windowAPI.*`.
- `createThemeWindow()` y `createPresentationWindow()` interceptan el evento nativo `close`, cancelan el cierre inicial y notifican al renderer (`theme-close-requested` / `presentation-close-requested`) para que el editor decida si debe confirmar o bloquear el cierre.

#### Estrategia de pre-warming (Performance)

Todas las ventanas secundarias se pre-calientan al arranque de la app (4s después del `ready-to-show` de la ventana principal):

```text
prewarmEditorWindows()  →  crea hidden BrowserWindows para:
  song, theme, presentation, tagSongEditor,
  settings, stage-control, stage-layout
```

- Cada ventana pre-calentada tiene su `warm*WindowRef` correspondiente.
- Al abrir: si el ref warm está vivo → `showWarmWindow()` (navega + `show()` en 30ms), el pool se repone con `setTimeout(prewarmEditorWindows, 1500)`.
- Si el ref warm no está disponible: flujo normal (crea `BrowserWindow` desde cero + `ready-to-show`).
- `settings`, `stage-control`, `stage-layout`: son singleton — el warm ref se asigna al singleton ref en el momento de mostrar; `focusExistingWindow` sigue funcionando correctamente.
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
- `mediaHandlers.ts`: importacion de medios.
  - Copia archivos al directorio de datos.
  - Soporta importación de imágenes pegadas desde portapapeles sin ruta de archivo (`media:import-clipboard-image`) escribiendo temporal local y reutilizando el flujo normal de importación.
  - Genera thumbnails para imagenes/videos.
  - Para imágenes, intenta `sharp` con carga diferida; si `sharp` no está disponible para el runtime actual, hace fallback a `ffmpeg` para evitar crash del proceso principal.
  - Extrae metadatos (dimensiones, duracion).
  - Registra en DB via `MediaService`.
  - El borrado de carpetas (`media:delete-folder`) es recursivo en filesystem para permitir eliminar carpetas con subcarpetas y contenido completo desde Library.
  - Expone extracción de ZIP para flujo Canva (`media:extract-zip-mp4`) que extrae `.mp4` a temporales seguros.
  - Expone limpieza de temporales (`media:cleanup-temp-path`) restringida al root temporal de importaciones Canva.
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
- `updateLiveScreenContent` admite payload parcial (`itemIndex`, `contentScreen`, `presentationVerseBySlideKey`, `liveControls`) para evitar broadcasts de contenido completo cuando solo cambian controles en vivo.
- `displayManager/index.ts` importa explícitamente los tipos usados en IPC (`ThemeWithMedia` y `StageScreenConfigUpdate`) para mantener tipado estricto en build de main process.
- `showLiveScreen` y `showStageScreen` reutilizan instancia por `displayId` si ya existe.
- `showLiveScreen` refuerza `setBounds(display.bounds)` + `setFullScreen(true)` tanto en creación como en reuso de ventana para evitar aperturas parciales/pequeñas en algunos entornos Windows multi-display.
- `showStageScreen` también refuerza `setBounds(display.bounds)` + `setFullScreen(true)` tanto en creación como en reuso de ventana para evitar recortes al adaptar resoluciones o reconectar pantallas.

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
| `media-saved` | Media importers (Library/PresentationEditor) | Refetch de biblioteca de medios en todas las ventanas |
| `display-update` | displayManager | Refetch de displays |
| `live-screen-ready` | LiveScreen window | Marca pantalla como lista |
| `liveScreen-hide` | LiveScreen window | Notifica ocultamiento |

## APIs expuestas al renderer (preload)

Definidas en `electron/preload/index.ts`:

| API global | Metodos principales |
| --- | --- |
| `window.api` | Namespaces de `database/routes.ts` |
| `window.mediaAPI` | `getMediaServerPort()`, `importMedia()`, `extractZipMp4()`, `cleanupTempPath()` |
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
