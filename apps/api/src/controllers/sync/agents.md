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
  - `connect` — guarda config + devuelve auth URL (PKCE)
  - `exchangeOAuthCode` — canjea el código OAuth por tokens y los persiste
  - `disconnect` — deshabilita sync y elimina el token de Google Drive (`google-drive-token.json`)
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

## Autenticación OAuth (PKCE)

- `sync-drive-client.service.ts` usa **PKCE** (Proof Key for Code Exchange) para apps de escritorio.
- Solo se necesita `GOOGLE_DRIVE_CLIENT_ID` (variable pública por diseño en OAuth 2.0).
- Si Google exige `client_secret` para el cliente configurado (mensaje `client_secret is missing`), se puede agregar `GOOGLE_DRIVE_CLIENT_SECRET` en `.env` sin commitear. El servicio lo usa automaticamente; si no esta, fuerza `clientAuthentication: 'None'` para no enviar un secret vacio.

### Tauri — ventana OAuth in-app

1. El frontend guarda la configuración con `configure()` y pide la URL de auth con `getAuthUrl({ redirectUri: 'http://127.0.0.1:7777/oauth-redirect' })`.
2. El backend genera la URL con PKCE (`code_challenge` + `code_verifier` en memoria) y el `redirect_uri` loopback.
3. El frontend invoca el comando Rust `open_oauth_window(authUrl)` (`apps/tauri/src-tauri/src/commands.rs`).
4. Tauri abre una `WebviewWindow` embebida con la URL de Google.
5. Tras autorizar, Google redirige a `http://127.0.0.1:7777/oauth-redirect?code=...`.
6. Rust intercepta la navegación con `WebviewWindowBuilder::on_navigation`, extrae el `code`, cierra la ventana y emite `oauthCodeCaptured`.
7. El frontend recibe `oauthCodeCaptured`, llama a `exchangeOAuthCode({ code })`, el sidecar canjea el code y persiste los tokens.
8. El frontend refresca el estado con `getStatus()` y muestra la cuenta conectada.

### Electron — navegador del sistema + sidecar redirect

1-2. Igual que en Tauri.
3. El frontend abre el navegador del sistema con `window.open(authUrl)` (interceptado por el main process de Electron).
4. Google redirige a `GET http://127.0.0.1:7777/oauth-redirect?code=...`.
5. El sidecar captura el `code`, lo canjea con `driveClientService.exchangeAuthCode(code)`, persiste los tokens y emite `oauthComplete`.
6. El frontend recibe `oauthComplete` y refresca el estado.

### Consideraciones

- El `code_verifier` se descarta tras el exchange. Si el sidecar se reinicia entre la generación del authUrl y el canje, el usuario debe reiniciar el flujo.
- El endpoint `GET /oauth-redirect` vive en `apps/api/src/index.ts` y responde HTML amigable; es la ruta usada por Electron.
- `disconnect()` elimina `{userData}/sync/google-drive-token.json`, cerrando realmente la sesión.

## Ubicación

`apps/api/src/controllers/sync/`
