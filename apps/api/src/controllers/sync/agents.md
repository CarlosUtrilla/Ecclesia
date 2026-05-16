# Sync Controller Agent

## Descripción

Controlador y servicio para sincronización diferencial de DB en Ecclesia.

## Responsabilidad

- Gestionar estado de sincronización por dispositivo (`SyncState`).
- Registrar y consultar cambios locales pendientes (`SyncOutboxChange`).
- Ingerir, deduplicar y aplicar cambios remotos (`SyncInboxChange`).
- Proteger merges con reglas de stale/conflicto para evitar pérdida de datos.

## Testing

- Tests unitarios en `sync.service.test.ts` cubren validaciones de fechas, deduplicación (`P2002`), detección de stale remoto, conflictos inbox/outbox y aplicación segura por lotes.
- Tests unitarios en `sync.controller.test.ts` validan el contrato DTO -> service (delegación de payload/respuesta) para evitar regresiones en los canales IPC del namespace `sync`.
- Tests de integración ligera en `sync.service.integration.test.ts` validan flujos completos `ingest -> pending -> apply` y `append -> pending -> ack` con estado en memoria para detectar regresiones de orquestación entre inbox/outbox/syncState.
- La suite integration-lite cubre además casos base multi-dispositivo: altas independientes (A canción / B tema), conflicto diferido sobre el mismo tema y eliminación remota idempotente sobre registro ya inexistente.

## Ubicación

`database/controllers/sync/`
