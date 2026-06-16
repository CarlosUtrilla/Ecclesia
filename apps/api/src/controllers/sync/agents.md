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
- `sync-drive-client.service.ts` — OAuth2, Drive v3 client, carpeta Ecclesia, appInstanceId
- `sync-state.service.ts` — Persistencia de estado en JSON, retry backoff
- `sync-snapshot.service.ts` — Build/upload/download/aplicar snapshots de modelos de BD
- `sync-media.service.ts` — Manifest local/remoto, blob upload/download, diff sync, driveFileId caching
- `sync-bible.service.ts` — Manifest + blob sync para biblias importadas
- `sync-push.service.ts` — Orquestación push (snapshot + media + bible + outbox ack)
- `sync-pull.service.ts` — Orquestación pull (snapshots remotos + media + bible)
- `sync-diagnostic.service.ts` — Diagnóstico y reparación de blobs
- `sync-cleanup.service.ts` — Limpieza de archivos huérfanos (local + Drive)
- `sync-lazy-fetch.service.ts` — Lazy fetch de media desde Drive para media server
- `sync.config.ts` — Constantes, tipos, helpers, snapshot model definitions
- `sync.utils.ts` — Utilidades de I/O (read/write JSON, stream, checksum)

## Testing

- Tests unitarios en `sync.service.test.ts` cubren validaciones de fechas, deduplicación (`P2002`), detección de stale remoto, conflictos inbox/outbox y aplicación segura por lotes.
- Tests unitarios en `sync.controller.test.ts` validan el contrato DTO -> service (delegación de payload/respuesta) para evitar regresiones en los canales IPC del namespace `sync`.
- Tests de integración ligera en `sync.service.integration.test.ts` validan flujos completos `ingest -> pending -> apply` y `append -> pending -> ack` con estado en memoria para detectar regresiones de orquestación entre inbox/outbox/syncState.
- La suite integration-lite cubre además casos base multi-dispositivo: altas independientes (A canción / B tema), conflicto diferido sobre el mismo tema y eliminación remota idempotente sobre registro ya inexistente.

## Ubicación

`apps/api/src/controllers/sync/`
