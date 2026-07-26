# Backend (Controllers / Services) Agent

> **Agent router:** [`/agents.md`](../agents.md)

## Descripcion

Capa de backend que conecta el frontend React con la base de datos SQLite. Soporta dos modos de operación: IPC (Electron) y HTTP Express (para sidecar Tauri o frontend remoto). También ejecuta servicios autónomos (sync scheduler, UDP discovery, crash logging).

## Arquitectura

```text
Frontend (React)
  ├── IPC (Electron):
  │     window.api.namespace.method(args)
  │       -> ipcRenderer.invoke('namespace.method', args)
  │         -> ipcMain.handle()               // index.ts registerRoutes()
  │           -> Controller.method(args)
  │             -> Service (Prisma ORM)
  │               -> SQLite
  └── HTTP (Express):
        Api.fetch.namespace.method(args)
          -> POST /api/{namespace}/{method}
            -> Controller.method(args)        // mismo controller
              -> Service (Prisma ORM)
                -> SQLite
```

## Archivos principales

```text
src/
├── index.ts           # registerRoutes() y exposeRoutes() - setup HTTP + Socket.IO
│                      # Re-exporta tipos/enums de Prisma (Media, ScheduleItem, etc.)
│                      # Rutas HTTP adicionales:
│                      #   GET  /api/remote/info   → info de instancia (hostname, version) para descubrimiento LAN
│                      # initializeHttpServer emite queryKeysInvalidate via Socket.IO en vez de IPC
│                      # Arranca oplog-scheduler.service (sync cada 5min + event-driven micro-push) y udp-discovery.service tras listen
│                      # Nuevos endpoints HTTP:
│                      #   GET  /api/remote/discover-lan → descubrimiento UDP LAN
├── prisma.ts          # setPrismaClient, getPrisma, injectables (bibles path)
├── prisma-init.ts     # initializeDatabase(), migraciones, backup, middleware outbox
│                      # initializeDatabase flow:
│                      #   1. DB doesn't exist → copy template or runMigrations → wasJustCreated
│                      #   2. DB exists + invalid schema → backup → delete → rebuild → migrate data → skip pending
│                      #   3. DB exists + valid schema → run pending migrations
│                      #   wasJustCreated/migrationsAlreadyApplied flags prevent double execution
│                      # hasUserData() returns false if DB file doesn't exist (not true on error)
├── outboxPayload.ts   # serializeOutboxPayload() BigInt-safe
├── routes.ts          # Mapa de namespaces a controllers
├── routeTypes.d.ts    # Tipos de rutas
├── controllers/       # Un directorio por recurso
│   ├── bible/
│   │   ├── bible.controller.ts
│   │   ├── bible.service.ts
│   │   ├── bibleManagment.service.ts
│   │   ├── bible.dto.d.ts
│   │   └── utils.ts
│   ├── media/
│   │   ├── media.controller.ts
│   │   ├── media.service.ts
│   │   └── media.dto.d.ts
│   ├── songs/
│   │   ├── songs.controller.ts
│   │   ├── songs.service.ts
│   │   └── songs.dto.d.ts
│   ├── presentations/
│   │   ├── presentations.controller.ts
│   │   ├── presentations.service.ts
│   │   └── presentations.dto.d.ts
│   ├── tagSongs/
│   │   ├── tagSongs.controller.ts
│   │   ├── tagSongs.service.ts
│   │   └── tagSongs.dto.d.ts
│   ├── themes/
│   │   ├── themes.controller.ts
│   │   ├── themes.service.ts
│   │   └── themes.dto.d.ts
│   ├── schedule/
│   │   ├── schedule.controller.ts
│   │   ├── schedule.service.ts
│   │   ├── schedule-group.service.ts
│   │   └── schedule.dto.d.ts
│   ├── settings/
│   │   ├── settings.controller.ts
│   │   ├── settings.service.ts
│   │   └── settings.dto.d.ts
│   ├── sync-oplog/
│   │   ├── oplog.types.ts
│   │   ├── oplog-shared.ts        # Path helpers, JSON I/O, types (PersistedSyncConfig, SyncStatus, etc.)
│   │   ├── oplog-drive-client.service.ts  # DriveClientService (Google Drive OAuth client)
│   │   ├── oplog.config.ts
│   │   ├── oplog-state.service.ts
│   │   ├── oplog-drive.service.ts
│   │   ├── oplog-utils.ts
│   │   ├── oplog-replay.service.ts
│   │   ├── oplog-blob.service.ts
│   │   ├── oplog-compaction.service.ts
│   │   ├── oplog-migration.service.ts
│   │   ├── oplog.service.ts
│   │   ├── oplog-purge.service.ts  # Poda de registros soft-deleted (age + push/pull timestamps, 24h interval)
│   │   ├── oplog.controller.ts
│   │   └── oplog-logger.ts
│   ├── ai/
│   │   ├── ai.types.ts           # Configuración de proveedores, tipos de respuesta
│   │   ├── ai.service.ts         # Lógica multi-proveedor (OpenAI/Anthropic)
│   │   ├── ai.controller.ts      # Métodos IPC: extractFromText, extractFromPdf
│   │   └── ai.dto.d.ts           # DTOs de entrada/salida
│   └── selectedScreens/
│       ├── index.ts
│       ├── selectedScreens.controller.ts
│       ├── selectedScreens.service.ts
│       └── selectedScreens.dto.d.ts
│   ├── stageScreenConfig/
│   │   ├── index.ts
│   │   ├── stageScreenConfig.controller.ts
│   │   ├── stageScreenConfig.service.ts
│   │   └── stageScreenConfig.dto.d.ts
├── services/
│   ├── oplog-scheduler.service.ts # Scheduler OpLog: arranca ciclo startup, periodic sync 5min, event-driven en cambios locales
│   └── udp-discovery.service.ts   # Listener UDP + discoverLanDevices() para descubrimiento LAN
├── utils/
│   ├── crashLogger.ts   # Crash logger sin Electron (sidecar-safe)
│   └── loadEnv.ts       # Carga .env desde userDataPath opcional
├── middleware/
│   ├── decimal.ts     # Serializacion Decimal/Date para IPC
│   └── oplog.ts       # OpLog Prisma middleware: intercepta mutaciones y llama appendEvent
```

## Namespaces IPC registrados

Definidos en `routes.ts`:

| Namespace | Controller | Metodos principales |
| --------- | ---------- | ------------------- |
| `songs` | SongsController | `createSong`, `getSongs`, `getSongById`, `getSongsByIds`, `updateSong`, `deleteSong`, `importSongsFromFile`, `previewMissingTags` |
| `themes` | ThemesController | `createTheme`, `getAllThemes`, `getThemeById`, `updateTheme`, `deleteTheme`, `exportThemeToZip`, `importThemeFromZip` |
| `media` | MediaController | `importMedia`, `getAllMedia`, `getMediaByIds`, `deleteMedia`, `moveMedia`, `renameMedia`, `createFolder`, `renameFolder`, `deleteFolder`, `verifyFiles`, `cleanupOrphans`, `extractZipMp4` (multipart HTTP, extrae ZIP Canva e importa MP4s) |
| `tagSongs` | TagSongsController | `createTagSong`, `getAllTagSongs`, `updateTagSong`, `deleteTagSong` |
| `bible` | BibleController | `getBibleSchema`, `getVerses`, `getCompleteChapter`, `getAvailableBibles`, `importBible`, `searchTextFragment`, `getDefaultBibleSettings`, `updateDefaultBibleSettings` |
| `schedule` | ScheduleController | `createSchedule`, `getAllSchedules`, `getScheduleById`, `updateSchedule`, `deleteSchedule`, `getActualSchedule`, `addItemToSchedule`, `getAllGroupTemplates`, `createGroupTemplate`, `updateGroupTemplate`, `deleteGroupTemplate`, `getGroupTemplateById` |
| `presentations` | PresentationsController | `createPresentation`, `getPresentations`, `getPresentationsByIds`, `getPresentationById`, `updatePresentation`, `deletePresentation` |
| `setttings` | SettingsController | `getSettings`, `updateSettings` (usa `upsert` internamente) |
| `selectedScreens` | SelectedScreensController | `getSelectedScreens`, `updateSelectedScreens` |
| `fonts` | FontsController | `addFont`, `getAllFonts`, `uploadFont` (multipart HTTP), `deleteFont`, `getSystemFonts` (vía `font-list`) |
| `stageScreenConfig` | StageScreenConfigController | `getAllStageScreenConfigs`, `getStageScreenConfigById`, `getStageScreenConfigBySelectedScreenId`, `upsertStageScreenConfig`, `updateStageScreenTheme`, `updateStageScreenLayout`, `updateStageScreenState`, `deleteStageScreenConfigBySelectedScreenId` |
| `oplog` | OplogController | **Sync:** `pull`, `push`, `syncCycle`, `purge`, `getSyncStatus`, `configure`, `connect`, `disconnect`, `getAuthUrl`, `exchangeOAuthCode` · **Oplog:** `getStatus`, `bootstrap`, `getEvents`, `getPending`, `getPendingOps`, `compact`, `migrate`, `clear`, `reset`, `deleteOplogFile` |
| `ai` | AiController | `getProviderConfig`, `saveProviderConfig`, `extractFromText`, `extractFromPdf` |

**Nota:** El namespace `setttings` tiene un typo historico (3 t's). No cambiar sin actualizar todos los puntos de referencia.

## Patron de un Controller/Service

### Controller (recibe la llamada IPC)

```typescript
// database/controllers/songs/songs.controller.ts
export default class SongsController {
  private songsService = new SongsService()

  async createSong(data: CreateSongDTO) {
    return await this.songsService.createSong(data)
  }

  async getSongs(params: GetSongsDTO) {
    return await this.songsService.getSongs(params)
  }
}
```

### Service (logica de negocio con Prisma)

```typescript
// database/controllers/songs/songs.service.ts
export default class SongsService {
  async createSong(data: CreateSongDTO) {
    return await prisma.song.create({
      data: { ... },
      // lyrics se guarda serializado en Song.lyrics como JSON string
    })
  }
}
```

### DTO (tipos de datos)

```typescript
// database/controllers/songs/songs.dto.d.ts
export interface CreateSongDTO {
  title: string
  author?: string
  lyrics: { content: string; tagSongsId?: number }[]
}
```

## Convenciones

- **Un Controller por recurso**, instanciado en cada llamada IPC (no singleton).
- **Services usan Prisma** directamente (import del cliente global).
- **DTOs** se definen como archivos `.dto.d.ts` (solo tipos, no runtime).
- **Metodos del controller** son `async` y reciben los argumentos directamente (no `req/res`).
- El canal IPC es `{namespace}.{method}` (ej: `songs.createSong`).
- **Métodos multipart (subida de archivos)**: usar `@UsingMulter` en el controller. Se registran como rutas HTTP POST (`/api/{namespace}/{method}`) en vez de IPC, y el `Fetcher` envía `FormData` directamente (sin serialización JSON).
- Para métodos sin archivos, el canal IPC es `{namespace}.{method}` (ej: `songs.createSong`).
- La configuración global de presentación bíblica se inicializa con `positionStyle = 10` (separación desde borde) y se normaliza si viene sin valor para mantener comportamiento visual consistente.
- El módulo `presentations` serializa `slides` como JSON string en Prisma para MVP y lo normaliza a objeto en service antes de devolver al renderer.
- `presentations.slides` ahora soporta estructura mixta por diapositiva con `items[]` (schedule-like): cada item define `type`, `accessData`, `layer`, `customStyle` y `animationSettings` para render por capas y animación por elemento.
- Dentro de `presentations.slides.items[]`, el tipo `SHAPE` representa formas editoriales (`rectangle`, `circle`, `arrow`, `line-arrow`, `triangle`, `line`, `cross`) serializadas en `accessData` y estilizadas desde `customStyle`.
- Cada slide de `presentations.slides` también soporta `videoLiveBehavior` (`auto` | `manual`) para controlar si videos de la diapositiva inician automáticamente al entrar en live o quedan en espera de play manual.
- Cada slide de `presentations.slides` también puede incluir `themeId` opcional (`number | null`) para aplicar un tema global de presentación en runtime.
- Cada slide de `presentations.slides` también puede incluir `backgroundColor` opcional (`string`) para sobrescribir su fondo individualmente sin cambiar el tema persistido de las demás diapositivas.
- Cada slide de `presentations.slides` también puede incluir `videoLoop` opcional (`boolean`) para controlar si el video de esa diapositiva se repite al finalizar; la normalización backend lo fuerza a `false` cuando no viene definido.
- Cada slide de `presentations.slides` puede incluir `slideName` opcional (`string`) para mostrar un nombre personalizado en el carrusel del editor.
- Cada slide de `presentations.slides` puede incluir metadatos opcionales de importación Canva (`canvaSourceKey`, `canvaSlideNumber`) para que el renderer pueda reimportar ZIPs y actualizar diapositivas existentes por número de slide en lugar de duplicarlas.
- `schedule.updateSchedule` usa `dateFrom` y `dateTo` (no `date`) para mantener consistencia con el modelo Prisma y el estado del formulario en frontend.
- `schedule.updateSchedule` aplica soft-delete + recreación de items en operaciones **top-level** separadas (`scheduleItem.updateMany` + `scheduleItem.createMany` + `schedule.update`), en vez de mutaciones anidadas dentro de `schedule.update`. Esto es **obligatorio** para el sync: Prisma query extensions (`$allOperations`) no capturan operaciones anidadas, así que los nested writes generaban cero eventos en el oplog y los ScheduleItem no se sincronizaban entre PCs.
- El módulo `sync-oplog` implementa sincronización basada en **OpLog (Operation Log) + Automerge CRDT**: cada dispositivo mantiene un log de eventos ordenados que se mergean automáticamente entre dispositivos. Reemplaza el sistema anterior de snapshots + last-write-wins.
- **Arquitectura sync**: Toda la lógica de sync con Drive vive en `apps/api/src/controllers/sync-oplog/`. El controller expone tanto endpoints de sync (`pull`, `push`, `syncCycle`) como de OAuth (`configure`, `connect`, `disconnect`, `getAuthUrl`, `exchangeOAuthCode`). El **scheduler** (`oplog-scheduler.service.ts`) ejecuta `syncCycle()` en startup y periódicamente cada 5 min, con micro-push event-driven en cambios locales. Electron mantiene: OAuth BrowserWindow, `sync-init.ts` helpers, y `syncBridge.ts` (HTTP helpers contra `/api/oplog/*`).
- La suite `oplog-blob.service.test.ts` valida casos de blob sync y GC.
- **NO usar `console.log/warn/error` en código que corre en el proceso principal** (controllers, services, middleware, schedulers). Estas llamadas son eliminadas por terser (`drop_console: true`, `pure_funcs: ['console.log', 'console.info']`), dejando el logging invisible en producción y dificultando el debugging. Usar `import log from 'electron-log'` y `log.info/warn/error` en su lugar. Excepción: `console.log` está permitido en archivos de test (`*.test.ts`).
- El módulo `settings` acepta claves string públicas (`LOGO_FALLBACK_*`, `BIBLE_LIVE_CHUNK_MODE`, etc.) y las mapea a valores persistidos en DB (`logo.fallback.*`, `bible.live.chunkMode`) con SQL directo, evitando errores cuando una instalación tiene el cliente Prisma con enums desactualizados.
- `AddScheduleItemDto` omite `id`, `scheduleId` y `updatedAt`; en `ScheduleService` los creates deben mapear items sin desestructurar esos campos y generar `id` nuevo con `crypto.randomUUID()`.
- `songImporter.service.ts` debe retornar boolean en todos los caminos de `holyricsImporter` y `openlpImporter` (`true` si hubo imports fulfilled, `false` en caso contrario) para cumplir tipado estricto. El importer OpenLP parsea XML con formato OpenLyrics (`<verse name="..."><lines>...</lines></verse>`) usando regex, extrayendo título, autor y versos.
- `selectedScreens.createSelectedScreen` usa `upsert` por `screenId` (BigInt) para evitar `P2002` cuando el display ya existe y solo cambian `screenName` o `rol`.
- `songs` persiste letras en `Song.lyrics` como JSON string (`[{ content, tagSongsId }]`) y el service entrega `lyrics` parseado al renderer (`SongResponseDTO`) para evitar parseos repetidos en frontend.
- `songs.updateSong` sobrescribe `Song.lyrics` completo en una sola mutación de `Song`, evitando inconsistencias de sincronización por filas hijas.
- `themes.exportThemeToZip(id)` genera `~/Downloads/<tema>.zip` con `theme.json` (datos de DB) y, cuando aplica, incluye el asset de fondo respetando el `filePath` original del media. Si el `textStyle.fontFamily` del tema corresponde a una fuente personalizada instalada, también incluye su archivo (`fonts/*.ttf|otf`) en el ZIP.
- `themes.importThemeFromZip(zipPath)` crea tema nuevo desde `theme.json`, resuelve conflicto de nombres con sufijo (importado) considerando también registros soft-delete y reintenta creación ante `P2002` (colisión concurrente); si el ZIP trae fondo intenta conservar su ruta relativa bajo `files/`, persiste `Media.filePath` y `Media.folder` derivados de esa ruta (fallback seguro a `files/themes-imports/`) y, si hay colisión de archivo/ruta, renombra solo el archivo manteniendo carpeta devolviendo metadata de renombrado en el resultado. Si el ZIP trae fuente personalizada, la instala en `userData/media/fonts/` y la registra en `Font` solo cuando no existe.

## Serializacion IPC

En `middleware/decimal.ts`:

- `Decimal` de Prisma se serializa como `{ __decimal__: string }` y se restaura al deserializar.
- `Date` se serializa como `{ __date__: ISO string }` y se restaura automaticamente.
- Esto previene corrupcion de datos al cruzar la frontera entre procesos.

## Como agregar un nuevo controller

1. Crear directorio en `controllers/nuevoRecurso/`
2. Crear `nuevoRecurso.controller.ts`, `nuevoRecurso.service.ts`, `nuevoRecurso.dto.d.ts`
3. Registrar en `routes.ts`: `nuevoRecurso: NuevoRecursoController`
4. El namespace queda disponible automaticamente como `window.api.nuevoRecurso.metodo()`
5. Actualizar este agent y `/prisma/agents.md` si se creo un nuevo modelo

## Agents relacionados

- Schema de datos -> `/prisma/agents.md`
- Setup de IPC en main process -> `/electron/agents.md`
- Consumo desde frontend -> `/app/contexts/agents.md`
