## Controladores IPC dedicados

Cada canal IPC debe tener su propio archivo controlador en `electron/main/`, siguiendo el patrón:

```ts
// electron/main/liveMediaController.ts
export function initializeLiveMediaManager() {
  ipcMain.on('live-media-state', ...)
}
```
Luego se importa y se inicializa en `main/index.ts`:

```ts
import { initializeLiveMediaManager } from './liveMediaController'

Esto asegura modularidad, trazabilidad y seguridad.
# Electron (Main Process) Agent

> **Agent router:** [`/agents.md`](../agents.md)

## Descripcion

Proceso principal de Electron. Gestiona ventanas, servidor de medios locales, manejo de pantallas/displays, importacion de biblias e inicializacion de la base de datos.

## Archivos

```
electron/
├── main/
│   ├── index.ts                # Entry point del main process
│   ├── windowManager.ts        # Creacion y gestion de ventanas
│   ├── prisma.ts               # Inicializacion de Prisma, backups, migraciones
│   ├── bibleManager/
│   │   ├── index.tsx            # IPC handlers para biblia
## Controladores IPC dedicados

Cada canal IPC debe tener su propio archivo controlador en `electron/main/`, siguiendo el patrón:

```ts
// electron/main/liveMediaController.ts
export function initializeLiveMediaManager() {
  ipcMain.on('live-media-state', ...)
}
```
Luego se importa y se inicializa en `main/index.ts`:

```ts
import { initializeLiveMediaManager } from './liveMediaController'
app.whenReady().then(() => {
  initializeLiveMediaManager()
})
```

**Patrón obligatorio para managers:**
- Cada manager debe tener función `initializeXManager()`
- Registrar todos los handlers IPC en esa función
- Ser importado y llamado en `main/index.ts` (no en otro manager)
- Documentar canal y propósito en agents.md
- No mezclar handlers de diferentes managers en un solo archivo

Esto asegura modularidad, trazabilidad y seguridad.

# Electron (Main Process) Agent

> **Agent router:** [`/agents.md`](../agents.md)

## Descripcion

Proceso principal de Electron. Gestiona ventanas, servidor de medios locales, manejo de pantallas/displays, importacion de biblias e inicializacion de la base de datos.

## Archivos

```
6. Registra IPC handlers locales (fonts, ventanas, notificaciones)
7. createMainWindow()        -> Crea la ventana principal
```

## Modulos

### GoogleDriveSyncManager (`googleDriveSyncManager/`)

- Manager dedicado para sincronizacion de respaldo completo con Google Drive.
- El login OAuth se abre en una ventana interna de Electron (no en navegador externo).
- Canales IPC:
  - `sync:google-drive:status`
  - `sync:google-drive:configure`
  - `sync:google-drive:connect`
  - `sync:google-drive:disconnect`
  - `sync:google-drive:push`
  - `sync:google-drive:pull`
- Evento IPC adicional: `sync:google-drive:auto-save-event` para autosync al guardar desde editores.
- Emite `sync-state` a renderer con `{ syncing, progress }` para mostrar indicador global `Sincronizando...` y porcentaje en tiempo real.
- La descarga (`pull`) deja una restauracion pendiente para aplicar al iniciar la app.
- En startup se ejecuta `applyPendingDriveRestoreOnStartup()` antes de `initPrisma()` y luego se evalúa autosync inicial.
- Las credenciales OAuth se cargan desde variables de entorno leídas en startup con `loadAppEnv()` (`.env`, `.env.local` o `userData/.env`).

### Window Manager (`windowManager.ts`)

Gestiona todas las ventanas de la aplicacion:

| Funcion | Ruta hash | Proposito |
|---------|-----------|-----------|
| `createMainWindow()` | `/` | Ventana principal con layout de paneles |
| `createSongWindow(songId?)` | `/song/new` o `/song/:id` | Editor de canciones (ventana modal) |
| `createThemeWindow(themeId?)` | `/theme/new` o `/theme/:id` | Editor de temas (ventana modal) |
| `createTagsSongWindow()` | `/tagSongEditor` | Editor de tags de canciones |
| `createSettingsWindow()` | `/settings` | Ventana de ajustes (tema de colores y sincronización) |

Ventanas modales se abren via IPC:
- `ipcMain.on('open-song-window', ...)` -> `window.windowAPI.openSongWindow(id)`
- `ipcMain.on('open-theme-window', ...)` -> `window.windowAPI.openThemeWindow(id)`
- `ipcMain.on('open-tag-songs-window', ...)` -> `window.windowAPI.openTagsSongWindow()`
- `ipcMain.on('open-settings-window', ...)` -> `window.windowAPI.openSettingsWindow()`

### Media Manager (`mediaManager/`)


## Flujo de inicializacion

En `electron/main/index.ts`, al ejecutar `app.whenReady()`:

```
1. initPrisma()              -> Inicializa DB, aplica migraciones
2. initializeMediaManager()  -> Inicia servidor HTTP para medios
3. registerRoutes()          -> Registra IPC handlers de database/
4. initializeBibleManager()  -> Registra IPC handlers para biblia
5. initializeDisplayManager() -> Registra IPC handlers para pantallas
6. initializeLiveMediaManager() -> Registra canal IPC para media en vivo
7. Registra IPC handlers locales (fonts, ventanas, notificaciones)
8. createMainWindow()        -> Crea la ventana principal
```

## Modulos

### LiveMediaController (`liveMediaController.ts`)

Manager dedicado para sincronización de media en vivo:

- Canal IPC: `live-media-state`
- Expone API en preload como `liveMediaAPI`
- Documentar canal y propósito aquí y en agents.md de items-on-live

### Window Manager (`windowManager.ts`)

Gestiona todas las ventanas de la aplicacion:

| Funcion | Ruta hash | Proposito |
|---------|-----------|-----------|
| `createMainWindow()` | `/` | Ventana principal con layout de paneles |
- **mediaServer.ts**: Servidor HTTP local (Express o http nativo) que sirve archivos del directorio de datos de la app. El puerto se comunica al frontend via `window.mediaAPI.getMediaServerPort()`.
- **mediaHandlers.ts**: Procesa importacion de medios:
  - Copia archivos al directorio de datos
  - Genera thumbnails para imagenes/videos
  - Extrae metadatos (dimensiones, duracion)
  - Registra en base de datos via MediaService

El frontend construye URLs como `http://localhost:{port}/{filePath}` usando `useMediaServer()`.

### Bible Manager (`bibleManager/`)

- Gestiona archivos `.ebbl` (bases de datos SQLite con versiculos).
- Ubicacion de biblias: `/resources/bibles/` (embebidas) y directorio de datos del usuario.
- Usa `better-sqlite3` para consultas directas (no Prisma, son DBs separadas).
- IPC handlers:
  - `bible.getVerses(version, book, chapter, verseStart, verseEnd)`
  - `bible.getCompleteChapter(version, book, chapter)`
  - `bible.getAvailableBibles()`
  - `bible.importBible(filePath)`
  - `bible.searchTextFragment(version, text)`

### Display Manager (`displayManager/`)

- Detecta pantallas conectadas al sistema usando `screen.getAllDisplays()`.
- Guarda configuracion de pantallas en `SelectedScreens` (ver `/prisma/agents.md`).
- Envia evento `display-update` al renderer cuando cambian las pantallas.
- Gestiona ventanas de live screen:
  - `showLiveScreen(displayId)` -> Crea ventana fullscreen en el display especificado
  - `closeLiveScreen(windowId)` -> Cierra ventana de live
  - `updateLiveScreenContent(windowId, content)` -> Actualiza contenido mostrado
  - `updateLiveScreenTheme(windowId, theme)` -> Actualiza tema visual

### Prisma Initialization (`prisma.ts`)

Maneja la inicializacion robusta de la base de datos:

1. **Ruta de DB:**
   - Desarrollo: `{proyecto}/prisma/dev.db`
   - Produccion: `{home}/Library/Application Support/ecclesia/dev.db`
2. **Backups automaticos:** Antes de migrar, crea copia timestamped del archivo DB.
3. **Validacion de schema:** Verifica integridad antes de conectar.
4. **Migracion automatica:** Aplica migraciones pendientes con fallback a SQL directo.
5. **Preservacion de datos:** Si hay corrupcion de schema, intenta migrar datos automaticamente.

## IPC Events (notificaciones entre ventanas)

Eventos emitidos desde ventanas secundarias a la principal:

| Evento IPC | Disparado por | Efecto en main window |
|-----------|--------------|---------------------|
| `theme-saved` | ThemesEditor | Refetch de temas via `useThemes()` |
| `tags-saved` | TagSongsEditor | Refetch de tags via `useTagSongs()` |
| `song-saved` | SongEditor | Refetch de canciones |
| `schedule-group-templates-saved` | GroupTemplateManager | Refetch de plantillas |
| `display-update` | displayManager | Refetch de displays |
| `live-screen-ready` | LiveScreen window | Marca pantalla como lista |
| `liveScreen-hide` | LiveScreen window | Notifica que se oculto la pantalla |

## APIs expuestas al renderer (preload)

Definidas en `electron/preload/index.ts`:

| API Global | Metodos principales |
|-----------|-------------------|
| `window.api` | Todos los namespaces de `database/routes.ts` |
| `window.mediaAPI` | `getMediaServerPort()`, `importMedia()` |
| `window.displayAPI` | `getDisplays()`, `showLiveScreen()`, `closeLiveScreen()`, `updateLiveScreenContent()`, `updateLiveScreenTheme()` |
| `window.windowAPI` | `openSongWindow()`, `openThemeWindow()`, `openTagsSongWindow()`, `closeCurrentWindow()` |
| `window.bibleAPI` | Wraps del bible controller |
| `window.googleDriveSyncAPI` | `getStatus()`, `connect()`, `disconnect()`, `pushNow()`, `pullNow()` |

## Convenciones

- Los IPC handlers de `ipcMain.handle()` retornan valores (request-response).
- Los IPC handlers de `ipcMain.on()` son fire-and-forget (abrir ventanas, notificaciones).
- `ipcRenderer.send()` para enviar al main, `ipcRenderer.on()` para escuchar desde main.
- Los archivos de medios se almacenan fuera de la DB, en el directorio de datos de la app.
- Cada manager tiene su propio `index.ts` que registra los IPC handlers.

## Agents relacionados

- Rutas IPC de database -> `/database/agents.md`
- Modelos de datos -> `/prisma/agents.md`
- Consumo de APIs en frontend -> `/app/contexts/agents.md`
- Pantallas live -> `/app/screens/panels/schedule/agents.md`
