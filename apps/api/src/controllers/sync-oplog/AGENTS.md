# Sync OpLog Agent (Nuevo Sistema)

## Descripción

Implementation del sistema de sincronización basado en Automerge CRDT + Operation Log.
Reemplaza el sistema anterior de snapshots + last-write-wins.

## Arquitectura

Ver diseño completo en: `apps/desktop/app/SISTEMA_SYNC_OPLOG.md`

## Archivos

| Archivo | Propósito |
|---------|-----------|
| `oplog-types.ts` | Tipos compartidos (OplogEvent, EntityType, BlobOperation, etc.) |
| `oplog-shared.ts` | Utilities compartidas: path helpers (`getSyncDir`, `getTokenFilePath`, etc.), JSON I/O (`readJsonSafe`, `writeJson`), tipos (`PersistedSyncConfig`, `SyncStatus`, `GoogleDriveSyncConfig`) |
| `oplog-drive-client.service.ts` | DriveClientService: cliente Google Drive con OAuth, singleton `driveClientService` |
| `oplog.config.ts` | Constantes de nombres de archivo en Drive |
| `oplog-state.service.ts` | Persistencia local del OpLog binario + replay state |
| `oplog-drive.service.ts` | Operaciones Drive con ifGenerationMatch (optimistic lock) |
| `oplog-utils.ts` | Utilidades: DMMF field filtering, computeSchemaHash |
| `oplog-replay.service.ts` | Replay Engine: aplica eventos a Prisma + filesystem; también genera blob deletes para media thumbnails/fallback cuando el último registro asociado se elimina |
| `oplog-blob.service.ts` | Blob sync: download/upload/delete/move + GC. Validates local blob existence by filesystem path and prunes stale manifest entries when files are missing. |
| `oplog-compaction.service.ts` | Compactación: squash de eventos a snapshot |
| `oplog-migration.service.ts` | Bootstrap: migración desde DB actual al OpLog |
| `oplog-purge.service.ts` | Poda de registros soft-deleted: `isPurgeDue()`, `purgeSoftDeleted()` con elegibilidad (age + push/pull timestamps), procesamiento por lotes de 50 |
| `oplog.service.ts` | Orquestación: pull/push/syncCycle con Automerge merge + purge automático (4ª fase cada 24h) |
| `oplog.controller.ts` | Endpoints Express: sync (pull/push/syncCycle/purge) + OAuth (configure/connect/disconnect/getSyncStatus/getAuthUrl/exchangeOAuthCode) + oplog (getStatus/bootstrap/getEvents/getPending/getPendingOps/compaction/migration/clear/reset/deleteOplogFile) |
| `oplog-logger.ts` | Logger dedicado que escribe a archivo + stderr (no eliminado por terser) |

## Persistencia diferida del oplog (latencia de guardado)

`appendEvent()` se ejecuta en el middleware de Prisma (`middleware/oplog.ts`) en **cada escritura**.
La mutación del doc Automerge en memoria (`change()`) es inmediata y ordenada, pero la serialización
completa a disco (`save()` + `writeOplogBinary()`) es O(total_eventos) y crecía sin límite, bloqueando
la respuesta de cada guardado ("micro-sincronizaciones").

**Diseño actual:** `appendEvent()` ya **no** hace `await persistLocal()`. En su lugar llama a
`schedulePersist()`, que coalesce la escritura a disco con un debounce de `PERSIST_DEBOUNCE_MS` (400ms)
vía `drainPersist()` (un único flush en vuelo que re-verifica `persistDirty`). Esto es seguro porque
`push()`/`syncCycle()` serializan desde el doc **en memoria** (`save(this.localDoc)`), no desde el
archivo `oplog.bin` — el binario en disco solo sirve para recuperación tras reinicio.

- `flushPersist()`: fuerza la escritura inmediata de lo pendiente. Se invoca en el `before-quit` de
  Electron (`apps/desktop/electron/main/index.ts`) para garantizar durabilidad de los últimos eventos.
- `persistLocal()` sigue usándose de forma **síncrona** fuera de la ruta caliente (`init`, `pull`,
  `backfillChecksums`, `syncBlobs`), donde sí se requiere durabilidad inmediata tras merge/bootstrap.

## Logging en producción

El logger `oplog-logger.ts` escribe logs a **dos destinos simultáneamente**:
1. Archivo: `%TEMP%/ecclesia-oplog-sync.log` (Windows) o `/tmp/ecclesia-oplog-sync.log` (macOS/Linux)
2. `process.stderr` (visible en logs de Electron)

Esto asegura que los logs **no sean eliminados por terser** (que usa `drop_console: true` y `pure_funcs: ['console.log', 'console.info']`).

Funciones disponibles:
- `oplogLogInfo(message, data?)` — info informativo
- `oplogLogWarn(message, data?)` — advertencia
- `oplogLogError(message, data?)` — error con stack trace

Todos los archivos del módulo oplog usan este logger además de `electron-log` para máxima visibilidad en producción.

## Archivos externos relacionados

| Archivo | Propósito |
|---------|-----------|
| `apps/api/src/middleware/oplog.ts` | Prisma middleware que intercepta mutaciones y llama `appendEvent()` |
| `apps/api/src/services/oplog-scheduler.service.ts` | Scheduler: ciclo startup, periodic 5min, event-driven en cambios |

## Flujo de sync

1. **Prisma middleware** intercepta cada `create`/`update`/`upsert`/`delete` → llama `oplogService.appendEvent()`
2. `oplog.replay.service.ts` envuelve sus escrituras en `runWithoutOplogTracking()` para evitar duplicar eventos
3. `appendEvent()` → registra evento en Automerge CRDT, persiste localmente, dispara `onAppendEventCallback`
4. **Scheduler** recibe callback → espera 30s de debounce → ejecuta `syncCycle()`
5. Adicionalmente, **timer cada 5 min** ejecuta `syncCycle()` (pull + push + blob sync + GC)
6. En startup, ejecuta ciclo completo inmediato

## Gotcha: settings (`Setting`) no pasan por el middleware

El middleware (`registerOplogMiddleware`) es una extensión `query.$allModels`, así que **solo
intercepta operaciones de modelo** (`prisma.model.acción`), NO `$executeRaw`/`$queryRaw`.
`SettingsService.updateSetting` escribe con `$executeRaw` (porque `Setting.key` es un enum
`SettingOptions` incompleto y el write raw evita su validación), por lo que los settings **no se
sincronizaban**. Solución:
- `updateSetting` registra el evento manualmente: `oplogService.appendEvent({ entityType: 'setting', entityId: <id>, op: 'upsert', data: { id, key, value } })`.
- En el replay (`oplog-replay.service.ts`), `setting` se aplica **por `key`** con SQL raw
  (`INSERT ... ON CONFLICT(key)`), no por `id`: la identidad real es la key, y el `id` es
  autoincremental local (colisionaría entre dispositivos). Además evita la validación del enum.

## Scheduler

`oplog-scheduler.service.ts`:
- `startOplogScheduler()`: inicia ciclo startup, timer 5min, escucha `onAppendEventCallback`
- Lee config desde `oplogStateService` o desde sync legacy
- Notifica progreso via Socket.IO `syncProgress`
- Ignora ciclos si ya hay uno en curso (`isSyncing` flag)

## Bug: `i is not defined` en backfillChecksums()

La función `tryFillChecksum()` usaba `updates.get(i)` donde `i` era capturada por closure desde el
`for (let i = 0; ...)` loop. Terser (minificador) rompía la closure causando `ReferenceError: i is not defined`.

**Fix:** Se agregó `opIndex` como primer parámetro de `tryFillChecksum()` en lugar de confiar en la closure,
y se eliminó la función helper `resolvePath()` (inline `dataPath || blobPath`).

## Fallback backfill checksums (syncBlobs)

El fallback loop en `syncBlobs()` computa checksums para thumbnails/fallbacks/main files que no tienen
`thumbnailChecksum` en el evento. Originalmente subía los blobs a Drive pero **NUNCA persistía el checksum
de vuelta en el evento de Automerge**, causando que PC2 recibiera eventos sin `thumbnailChecksum` y no
generara download blob ops para thumbnails.

**Fix (oplog.service.ts):**
1. `enqueueFallback()` ahora acepta `idx` del evento y acumula los checksums computados en un Map
   `fallbackUpdates` keyeado por índice del evento.
2. Después del loop, se aplica `change(this.localDoc, 'fallback-backfill', ...)` que escribe los
   checksums en los eventos del doc de Automerge, seguido de `persistLocal()`.
3. `backfillChecksums()` ahora corre al final de `init()` para cubrir los paths de Drive download
   y bootstrap (antes solo corría en el path de "loaded from local file").
4. Tanto `thumbnailChecksum` como `thumbnailBlobPath` se persisten juntos (y análogamente para
   `checksum`/`blobPath` y `fallbackChecksum`/`fallbackBlobPath`).

Esto asegura que el próximo `push()` incluya los checksums en los eventos, y PC2 pueda generar
download blob ops para thumbnails via `applyEvents()`.

### Diagnóstico fallback (session actual)

Se agregaron contadores detallados en `syncBlobs()` dentro del fallback:
- `fbChecksumCount`: ops main file sin checksum
- `fbThumbnailChecksumCount`: media ops sin thumbnailChecksum pero con `data.thumbnail`
- `fbFallbackChecksumCount`: media ops sin fallbackChecksum pero con `data.fallback`
- `fbCacheHitCount`: hits en `checksumCache` que generaron upload
- `fbFileFoundCount`: archivos encontrados en disco que generaron checksum
- `fbFileMissingCount`: archivos NO encontrados en disco
- `fbAlreadySeenCount`: checksum ya visto (no se añade a `fallbackUpdates` / `toUpload`)

La línea de diagnóstico: `[Blob-DIAG] Fallback: ...` aparece en el log justo antes de la decisión
de persistir `fallbackUpdates`.

## Thumbnail regeneration (syncBlobs)

Cuando un evento media upsert no tiene `thumbnailChecksum`, ni `data.thumbnail`, ni `thumbnailBlobPath`
pero el source file (via `data.filePath` / `blobPath`) existe en disco, `syncBlobs()` regenera el
thumbnail usando `generateImageThumbnail()` / `generateVideoThumbnail()` desde `mediaThumbnails.ts`.

**Flujo:**
1. Corre **cada ciclo** (no solo el fallback inicial) porque source files pueden llegar en ciclos posteriores
2. Usa `buildThumbnailFileName()` con `randomBytes(8).toString('hex')` para evitar colisiones de nombre
3. Calcula checksum del thumbnail generado, lo agrega a `toUpload` y persiste `thumbnailChecksum` +
   `thumbnailBlobPath` + `data.thumbnail` en el evento via `change()`
4. Determina imagen vs video por extensión del `filePath` (misma lógica que `SUPPORTED_IMAGE_FORMATS`)

**Logging:** `[Blob] Regenerated N thumbnails from source files`

## Pruning de eventos soft-deleted (syncBlobs)

Después de GC, se podan eventos del OpLog para media soft-deleted sin blob data asociado.

**Criterio de poda:**
- `op.op === 'upsert'` AND `op.entityType === 'media'`
- `data.deletedAt` es truthy (registro soft-deleted)
- Ningún campo blob tiene valor: `checksum`, `blobPath`, `thumbnailChecksum`, `thumbnailBlobPath`,
  `fallbackChecksum`, `fallbackBlobPath`

Se recopilan todos los `entityId` que cumplen el criterio y se eliminan **todos** los eventos de esas
entidades (porque si el registro fue soft-deleted sin blob data, ningún evento de ese entity es útil).
Los blobs de eventos pruned que sí tenían checksum quedan en `activeChecksums` de este ciclo (recopilados
antes del pruning) y serán GC'd en el próximo ciclo.

**Logging:** `[Blob] Pruned N events for M soft-deleted media records`

## Diagnóstico inicial de thumbnails faltantes (histórico)

En el primer arranque del OpLog en PC1 (Julio 2026):
- 125 thumbnails existen en disco (cache checksums encontrados por fallback)
- 139 soft-deleted + 40 registros activos no tienen thumbnail en disco
- `fbFileMissing=601` total (incluye thumbnails, fallbacks, y main files)
- `backfillChecksums()` encontró 42 thumbnails en init() que sí existían en disco → checksums subidos
  a Drive → PC2 los descargó en el próximo ciclo de 5min

Causa raíz: el sync legacy copiaba solo registros DB, no archivos de medios. PC1 nunca tuvo los
archivos de thumbnail para ~179 registros porque vinieron del snapshot sincronizado sin files.

## Caso "Ratón" — referencia futura

> **Alias:** `raton` — porque un ratón se come los archivos silenciosamente, deja las referencias rotas y
> la sync se pierde sin que se sepa bien qué pasó ni dónde quedaron las cosas.

### Síntomas
- En `[Blob-DIAG] Fallback: ...` se ve `File missing` alto (cientos) vs `File found` bajo
- Thumbnails que no aparecen en PC2 aunque PC1 los tenga en DB
- `toDownload` crece pero los downloads nunca completan (el checksum no existe en Drive)
- Con el tiempo, la sync empieza a "perderse": entradas fantasma, referencias a archivos que no están
- Al abrir la biblioteca de medios, faltan thumbnails o aparecen placeholders

### Causa raíz documentada (Julio 2026)

El **sync legacy** (sistema anterior basado en snapshots JSON + last-write-wins) copiaba solo registros
de base de datos entre PCs — **no copiaba los archivos de medios** (thumbnails, fallbacks, ni siquiera
los main files si no estaban cacheados). Cuando un PC se formateaba o se unía uno nuevo al sync:

1. El snapshot traía los registros DB completos (`Media`, `Song`, etc.) con paths de archivos
2. Pero los archivos físicos (`media/thumbnails/*.jpg`, `media/files/*.mp4`, etc.) nunca se transferían
3. El nuevo PC quedaba con DB llena de referencias a archivos que **nunca existieron en disco**
4. El OpLog (nuevo sistema) heredó esos eventos con `data.thumbnail` / `data.filePath` poblados desde DB,
   pero sin archivos reales — y sin `thumbnailChecksum` porque nunca se computó
5. El ciclo se auto-alimenta: PC1 reporta eventos sin checksum → PC2 los descarga → replica el mismo
   estado huérfano → los checksums nunca aparecen en Drive → nadie puede descargar nada

### Lo que el Ratón se come

| ¿Qué falta? | ¿Por qué? | ¿Cuántos? |
|---|---|---|
| Thumbnails de registros activos | Vinieron del snapshot legacy sin archivos | ~40 |
| Thumbnails de registros soft-deleted | Idem + el registro ya no existe | ~139 |
| Fallbacks de registros activos | Idem | variable |
| Main files (raro) | Si el PC original los borró | variable |

### Mitigaciones implementadas

1. **Fallback backfill checksums** (`syncBlobs`, primer ciclo): computa checksums de archivos que SÍ
   existen en disco y los persiste en el evento via `change()`. Esto permite que PC2 los descargue.
2. **Thumbnail regeneration** (`syncBlobs`, cada ciclo): cuando el source file (`data.filePath`) existe
   en disco pero el thumbnail no, regenera el thumbnail desde el archivo fuente y sube el checksum a Drive.
3. **Pruning de eventos soft-deleted** (`syncBlobs`, cada ciclo): remueve eventos de media soft-deleted
   sin blob data para que no sigan contaminando el OpLog ni generando referencias rotas.

### Cómo diagnosticar "Ratón" en producción

Buscar en los logs de sync:

```
[Blob-DIAG] Fallback: ... File missing: <alto>
[Blob-DIAG] Media upsert ops: <total>, with thumbnailChecksum: <bajo>, with path but no checksum: <alto>
[Blob] To upload: <bajo>, To download: <alto>
[Blob] Regenerated N thumbnails from source files
[Blob] Pruned N events for M soft-deleted media records
```

Si `File missing` es consistentemente alto (cientos) y `toDownload` no se reduce entre ciclos,
es que los checksums de esos archivos **nunca existieron en Drive** — el Ratón ya pasó.

En ese escenario:
- Si el source file existe en disco → la regeneración debería resolverlo en 1-2 ciclos
- Si ni el source file existe → esos registros son huérfanos irrecuperables (solo queda limpiarlos)

### Prevención

- No formatear un PC sin antes verificar que todos los blobs están subidos a Drive
- En el futuro: el OpLog con CRDT + blob checksums evita que esto se reproduzca porque los checksums
  se computan y persisten en el evento desde el momento de creación (no a posteriori)
- Si se agrega un PC nuevo, hacer un pull completo + esperar a que los blobs se descarguen antes de
  usar la biblioteca de medios

## Bug: Orphan cleanup no consideraba fallbacks

El orphan cleanup de thumbnails (`syncBlobs()`, sección "Limpiar thumbnails huérfanos")
solo verificaba `op.data.thumbnail` y `op.thumbnailBlobPath` — pero NO verificaba
`op.data.fallback` ni `op.fallbackBlobPath`. Como resultado, los fallbacks descargados
de Drive se eliminaban inmediatamente como huérfanos.

**Síntoma en logs:**
```
[Blob] Process result: 27 downloaded, 184 uploaded
[Blob] Eliminado thumbnail huérfano local: thumbnails/fallback-xxx.jpg
... (26 archivos)
[Blob] Eliminados 26 thumbnails huérfanos locales
```

Los 27 archivos descargados eran fallbacks. El thumbnail (`thumb-CARTA_A_LOS_ROMANOS...`)
no fue eliminado porque `op.data.thumbnail` SÍ se verificaba.

**Fix (oplog.service.ts):**
- Agregar `op.data?.fallback` y `op.fallbackBlobPath` al Set de thumbnails válidos
- La DB query ahora usa `OR: [{ thumbnail: { not: null } }, { fallback: { not: null } }]`
  y selecciona ambos campos
- En el próximo ciclo, estos fallbacks se descargarán de nuevo y ya no serán eliminados

## SyncCycle reentrancy guard

`oplogService.syncCycle()` tiene un flag `private syncing = false` que previene
ciclos concurrentes desde cualquier origen (scheduler, controller HTTP, o llamada directa).

Si un ciclo ya está en curso (`syncing === true`), la segunda llamada retorna
inmediatamente con resultado vacío. Esto protege contra:

- Scheduler + controller ejecutando a la vez
- Dos HTTP requests simultáneos a `POST /api/sync-oplog/syncCycle`
- Race en startup cuando el scheduler arranca mientras el controller inicia

El flag se libera en el `finally` del try/catch del ciclo.

## Dependencias

- `@automerge/automerge` v3 — CRDT para merge de documentos
- `google-auth-library` + `googleapis` — Drive v3 API
- Prisma ORM — acceso a DB local
