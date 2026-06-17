# Sync Controller Agent

## Descripción

Controlador y servicios para sincronización snapshot-based con Google Drive en Ecclesia.

## Responsabilidad

### Legacy (outbox/inbox sync — `sync.service.ts`)
- Gestionar estado de sincronización por dispositivo (`SyncState`).
- Registrar y consultar cambios locales pendientes (`SyncOutboxChange`).
- Ingerir, deduplicar y aplicar cambios remotos (`SyncInboxChange`).
- Proteger merges con reglas de stale/conflicto para evitar pérdida de datos.

### Modular Drive Sync (nuevo — servicios en `sync-*.service.ts`)
- `SyncController` expone métodos vía Express (`/api/sync/*`):
  - `getStatus` — estado de conexión/configuración
  - `configure` — guarda configuración
  - `connect` — guarda config + devuelve auth URL
  - `disconnect` — deshabilita sync
  - `push` — push completo (snapshot + media + bible)
  - `pull` — pull completo (snapshots remotos + media + bible)
  - `reconcile` — push + pull combinado
  - `getRemoteData` — datos remotos (dispositivos, media, bibles)
  - `diagnose` — diagnóstico de blobs (read-only)
  - `heal` — repara blobs faltantes/corruptos
  - `cleanupMedia` — limpia huérfanos de disco y Drive

### Servicios modulares
- `sync-drive-ops.service.ts` — Operaciones Drive compartidas (find/upsert file, list by prefix, download blob, verify fileId) — usado por media, bible, snapshot, push, lazy-fetch
  - `remoteFileIdExists`: ahora reintenta 1 vez con 1s de delay ante errores transitorios (5xx/timeout), evitando falsos negativos que causaban re-uploads.
  - `isDriveNotFoundError`: también verifica `response?.status === 404` para cubrir más formatos de error de Google API.
- `sync-drive-client.service.ts` — OAuth2, Drive v3 client, carpeta Ecclesia, appInstanceId
- `sync-state.service.ts` — Persistencia de estado en JSON, retry backoff
- `sync-snapshot.service.ts` — Build/upload/download/aplicar snapshots de modelos de BD
- `sync-media.service.ts` — Manifest local/remoto, blob upload/download, diff sync, driveFileId caching
  - `syncMediaManifest`: los uploads se encolan durante el loop principal y se procesan en batches paralelos (`BLOB_UPLOAD_CONCURRENCY=5`) con `Promise.allSettled` después del loop.
  - `listRemoteMediaBlobs`: `basePrefix` corregido (antes calculaba `prefix.slice(0, -68)` que daba `""`).
  - Logging diagnóstico en todos los puntos de decisión: pérdida de `driveFileId`, verificación fallida, grace window, upload queue.
- `sync-bible.service.ts` — Manifest + blob sync para biblias importadas
- `sync-push.service.ts` — Orquestación push (snapshot + media + bible + outbox ack)
  - Llama `syncProgressService.setPhaseRange(50, 100)` al iniciar para progreso continuo sin regresiones.
- `sync-pull.service.ts` — Orquestación pull (snapshots remotos + media + bible)
  - Llama `syncProgressService.setPhaseRange(0, 50)` al iniciar para progreso continuo.
- `sync-diagnostic.service.ts` — Diagnóstico y reparación de blobs
- `sync-cleanup.service.ts` — Limpieza de archivos huérfanos (local + Drive)
- `sync-lazy-fetch.service.ts` — Lazy fetch de media desde Drive para media server
- `sync.config.ts` — Constantes, tipos, helpers, snapshot model definitions
  - `BLOB_UPLOAD_CONCURRENCY`: 5 uploads paralelos máximo por batch.
- `sync-progress.service.ts` — Emisión de progreso vía Socket.IO `syncProgress`
  - `setPhaseRange(from, to)`: mapea progreso local 0-100 a un rango global, eliminando regresiones entre fases (pull 0-50%, push 50-100%).
- `sync.utils.ts` — Utilidades de I/O (read/write JSON, stream, checksum)

## Testing

- Tests unitarios en `sync.service.test.ts` cubren validaciones de fechas, deduplicación (`P2002`), detección de stale remoto, conflictos inbox/outbox y aplicación segura por lotes.
- Tests unitarios en `sync.controller.test.ts` validan el contrato DTO -> service (delegación de payload/respuesta) para evitar regresiones en los canales IPC del namespace `sync`.
- Tests de integración ligera en `sync.service.integration.test.ts` validan flujos completos `ingest -> pending -> apply` y `append -> pending -> ack` con estado en memoria para detectar regresiones de orquestación entre inbox/outbox/syncState.
- La suite integration-lite cubre además casos base multi-dispositivo: altas independientes (A canción / B tema), conflicto diferido sobre el mismo tema y eliminación remota idempotente sobre registro ya inexistente.

## Ubicación

`apps/api/src/controllers/sync/`
