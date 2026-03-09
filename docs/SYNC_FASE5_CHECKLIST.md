# Fase 5 - Checklist de validacion de sincronizacion diferencial

Objetivo: validar confiabilidad antes de salida a produccion para sync diferencial DB + media usando Google Drive appDataFolder.

## Alcance

- DB diferencial (`SyncOutboxChange`, `SyncInboxChange`, `SyncState`)
- Media diferencial (`media-manifest`, blobs por checksum, tombstones)
- Scheduler (intervalo, retry/backoff, heartbeat)
- Integridad remota (rechazo de payloads/manifests invalidos)

## Cobertura automatizada actual

- Concurrencia multi-dispositivo y conflictos DB: `database/controllers/sync/sync.service.integration.test.ts`
- Retry/backoff y recuperacion del scheduler (incluye timer automatico):
  - `electron/main/googleDriveSyncManager/googleDriveSyncManager.test.ts`
  - `electron/main/googleDriveSyncManager/googleDriveSyncManager.scheduler.test.ts`
- Integridad de media y transferencia por delta:
  - `electron/main/googleDriveSyncManager/googleDriveSyncManager.media.test.ts`

## Precondiciones

- Dos equipos o dos perfiles de prueba: `PC-A` y `PC-B`.
- Misma cuenta Google conectada en ambos.
- `workspaceId` identico en ambos equipos.
- `deviceName` distinto en cada equipo.
- Base inicial sincronizada con `sync:google-drive:reconcile` ejecutado al menos una vez.

## Matriz de pruebas

### 1) Concurrencia multi-dispositivo (casos base)

1. Caso A crea cancion / B crea tema:

- Paso 1: en `PC-A` crear cancion nueva.
- Paso 2: en `PC-B` crear tema nuevo.
- Paso 3: ejecutar push en ambos y luego pull en ambos.
- Esperado: ambos recursos existen en ambos equipos sin perdida.

1. Caso A y B editan mismo tema:

- Paso 1: en `PC-A` editar `theme X` (campo 1).
- Paso 2: en `PC-B` editar `theme X` (campo 2) sin hacer pull previo.
- Paso 3: ejecutar push/pull en ambos.
- Esperado: si hay outbox local pendiente, cambio remoto se difiere en inbox (`conflicts`) y no pisa cambios locales pendientes.

1. Caso eliminaciones cruzadas:

- Paso 1: en `PC-A` eliminar cancion Y.
- Paso 2: en `PC-B` editar cancion Y sin pull.
- Paso 3: sincronizar ambos.
- Esperado: se propaga tombstone delete de forma idempotente; no hay crash al aplicar delete sobre registro inexistente.

1. Caso corte de red y recuperacion:

- Paso 1: desconectar red en `PC-A`.
- Paso 2: forzar sync automatico/manual.
- Paso 3: reconectar red y esperar retry.
- Esperado: `retryCount` y `nextRetryAt` avanzan; al recuperar red, sync vuelve a `ok`.

### 2) Integridad de media

1. Dedupe checksum:

- Subir mismo archivo binario con distinto nombre/ruta.
- Esperado: no se duplica blob remoto por checksum; manifest referencia entradas por path.

1. Descarga diferencial:

- Borrar archivo local en `PC-B` que exista en manifest remoto sin tombstone.
- Ejecutar pull.
- Esperado: se re-descarga blob faltante.

1. Tombstone media:

- Eliminar archivo en `PC-A` (remocion real local) y sync push.
- Ejecutar pull en `PC-B`.
- Esperado: archivo se elimina en `PC-B` al recibir `deletedAt`.

1. Payload invalido remoto:

- Alterar manualmente un manifest/change file remoto con schema incorrecto (entorno controlado).
- Esperado: archivo invalido se ignora, no se ingiere en inbox ni corrompe estado local.

### 3) Performance y transferencia

1. Muestra base:

- Medir tamano total transferido con flujo actual durante:
  - 1 cambio DB pequeno
  - 1 media pequena
  - 1 media grande
- Esperado: transferencia proporcional al delta, no snapshot completo.

1. Carga sostenida:

- Ejecutar 100 cambios DB y 50 archivos media mixtos.
- Esperado: ciclo completa sin bloqueos; tiempos estables y sin re-subidas redundantes.

## Criterios de salida a produccion

- Cero perdida de datos en los casos de concurrencia definidos.
- Cero errores no recuperables en cortes de red simulados.
- Integridad de media verificada (hash/tombstone/dedupe) en todos los casos.
- Estado de scheduler visible y coherente (`lastRunStatus`, `retryCount`, `schedulerHealthy`).
- Validaciones de integridad remota bloquean payloads/manifests malformados sin impacto en datos locales.
- Checklist ejecutado y firmado para al menos 2 ciclos completos de prueba.

## Registro de ejecucion sugerido

- Fecha/hora
- Equipo origen/destino
- Caso ejecutado
- Resultado (`ok`/`fail`)
- Evidencia (capturas/logs/campos de status)
- Observaciones y accion correctiva
