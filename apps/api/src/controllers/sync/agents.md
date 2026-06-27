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
  - `connect` — guarda config + devuelve auth URL (legacy, prefiere getAuthUrl + exchangeOAuthCode)
  - `getAuthUrl` — genera URL de auth con PKCE (S256), guarda sesión pendiente
  - `exchangeOAuthCode` — canjea código por token usando codeVerifier pendiente
  - `disconnect` — cierra sesión (revoca token Google, elimina token/state/app-instance-id, deshabilita sync)
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
  - `uploadBlob`: busca blob existente por nombre antes de crear (`findFileByName`), evitando duplicados en Drive cuando el mismo checksum ya fue subido. Retorna el `fileId` existente si lo encuentra.
- `sync-drive-client.service.ts` — OAuth2 con PKCE (S256), Drive v3 client, carpeta Ecclesia, appInstanceId
  - Usa `OAuth2Client` de `google-auth-library` (no `google.auth.OAuth2` de googleapis)
  - `client_secret` opcional: si no existe, usa `clientAuthentication: 'None'` (solo PKCE + client_id)
  - `getAuthUrl()` genera PKCE challenge y guarda `pendingOAuthClient`, `pendingCodeVerifier`, `pendingRedirectUri`
  - `exchangeAuthCode()` usa `codeVerifier` y `redirect_uri` del estado pendiente, luego lo limpia
  - `createOAuthClient()` reemplaza al antiguo `getOAuthClient()`, acepta `redirectUri` dinámico
  - `revokeToken()` — revoca el token OAuth con Google (best-effort)
  - `clearPendingAuth()` — limpia estado en memoria (pendingOAuthClient, codeVerifier, redirectUri, cachedFolderId)
- `sync-state.service.ts` — Persistencia de estado en JSON, retry backoff
  - `recordSuccess()` ahora también actualiza `lastSyncAt` para que el pull check por comparación de timestamps funcione correctamente.
- `sync-snapshot.service.ts` — Build/upload/download/aplicar snapshots de modelos de BD
- `sync-media.service.ts` — Manifest local/remoto, blob upload/download, diff sync, driveFileId caching
  - `syncMediaManifest`: los uploads se encolan durante el loop principal y se procesan en batches paralelos (`BLOB_UPLOAD_CONCURRENCY=5`) con `Promise.allSettled` después del loop.
  - `listRemoteMediaBlobs`: `basePrefix` corregido (antes calculaba `prefix.slice(0, -68)` que daba `""`).
  - Logging diagnóstico en todos los puntos de decisión: pérdida de `driveFileId`, verificación fallida, grace window, upload queue.
- `sync-bible.service.ts` — Manifest + blob sync para biblias importadas
- `sync-push.service.ts` — Orquestación push (snapshot + media + bible + outbox ack)
  - `pushSnapshotOnly()`: solo sube snapshot (sin media/bible), usado por micro-snapshot-push. Actualiza `lastSyncAt` y `lastSnapshotPushAt` en estado local tras éxito.
  - `push()`: push completo (snapshot + media + bible + outbox ack). Llama `syncProgressService.setPhaseRange(50, 100)`.
- `sync-pull.service.ts` — Orquestación pull (snapshots remotos + media + bible)
  - `hasRemoteChanges()`: método ligero que lee el manifiesto remoto de Drive y compara `lastSyncAt` con el estado local. Retorna `true` si el remoto es más reciente o si no existe manifiesto.
  - Llama `syncProgressService.setPhaseRange(0, 50)` al iniciar para progreso continuo.
- `sync-diagnostic.service.ts` — Diagnóstico y reparación de blobs
- `sync-cleanup.service.ts` — Limpieza de archivos huérfanos (local + Drive)
  - `cleanupOrphanMediaFromDiskAndDrive`: escanea disco y Drive, elimina blobs huérfanos en Drive (sin entrada en manifest) y archivos huérfanos en disco (sin registro en DB).
- `sync-lazy-fetch.service.ts` — Lazy fetch de media desde Drive para media server
- `sync.config.ts` — Constantes, tipos, helpers, snapshot model definitions
  - `PULL_CHECK_INTERVAL_MS`: 2 min — intervalo del timer que verifica cambios remotos.
  - `BLOB_UPLOAD_CONCURRENCY`: 5 uploads paralelos máximo por batch.
  - `SyncReason` incluye `'pull-check'`, `'micro-snapshot-push'`, `'micro-media-push'` para el nuevo flujo event-driven.
  - `SyncState` incluye `lastSnapshotPushAt`, `lastPullCheckAt` para tracking.
- `sync-progress.service.ts` — Emisión de progreso vía Socket.IO `syncProgress`
  - `setPhaseRange(from, to)`: mapea progreso local 0-100 a un rango global, eliminando regresiones entre fases (pull 0-50%, push 50-100%).
- `sync.utils.ts` — Utilidades de I/O (read/write JSON, stream, checksum)
- `sync-scheduler.service.ts` — Scheduler de sincronización event-driven con pull check periódico
  - Arranca en `initializeHttpServer`.
  - **Startup**: ejecuta ciclo completo (**pull** → **push** → **heal** → **cleanup**).
  - **Pull check** (cada 2 min): llama `syncPullService.hasRemoteChanges()` para comparar el manifiesto remoto con el estado local. Solo ejecuta ciclo completo si hay cambios remotos detectados.
  - **Micro-snapshot-push** (1s debounce, disparado por outbox de cualquier modelo SNAPSHOT_MODEL): solo sube el snapshot (sin media/bible), usando `syncPushService.pushSnapshotOnly()`.
  - **Micro-media-push** (1s debounce, disparado por cambios en Media/Font): ejecuta push completo (snapshot + media + bible). Cancela cualquier snapshot push pendiente ya que lo incluye.
  - Usa `electron-log` para logging de errores en heal/cleanup.

## Testing

- Tests unitarios en `sync.service.test.ts` cubren validaciones de fechas, deduplicación (`P2002`), detección de stale remoto, conflictos inbox/outbox y aplicación segura por lotes.
- Tests unitarios en `sync.controller.test.ts` validan el contrato DTO -> service (delegación de payload/respuesta) para evitar regresiones en los canales IPC del namespace `sync`.
- Tests de integración ligera en `sync.service.integration.test.ts` validan flujos completos `ingest -> pending -> apply` y `append -> pending -> ack` con estado en memoria para detectar regresiones de orquestación entre inbox/outbox/syncState.
- La suite integration-lite cubre además casos base multi-dispositivo: altas independientes (A canción / B tema), conflicto diferido sobre el mismo tema y eliminación remota idempotente sobre registro ya inexistente.

## Ubicación

`apps/api/src/controllers/sync/`
