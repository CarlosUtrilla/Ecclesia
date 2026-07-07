# Sync OpLog Agent (Nuevo Sistema)

## Descripción

Implementation del sistema de sincronización basado en Automerge CRDT + Operation Log.
Reemplaza el sistema anterior de snapshots + last-write-wins.

## Arquitectura

Ver diseño completo en: `packages/desktop/app/SISTEMA_SYNC_OPLOG.md`

## Archivos

| Archivo | Propósito |
|---------|-----------|
| `oplog.types.ts` | Tipos compartidos (OplogEvent, EntityType, BlobOperation, etc.) |
| `oplog.config.ts` | Constantes de nombres de archivo en Drive |
| `oplog-state.service.ts` | Persistencia local del OpLog binario + replay state |
| `oplog-drive.service.ts` | Operaciones Drive con ifGenerationMatch (optimistic lock) |
| `oplog-utils.ts` | Utilidades: DMMF field filtering, computeSchemaHash |
| `oplog-replay.service.ts` | Replay Engine: aplica eventos a Prisma + filesystem |
| `oplog-blob.service.ts` | Blob sync: download/upload/delete/move + GC |
| `oplog-compaction.service.ts` | Compactación: squash de eventos a snapshot |
| `oplog-migration.service.ts` | Bootstrap: migración desde DB actual al OpLog |
| `oplog.service.ts` | Orquestación: pull/push/syncCycle con Automerge merge |
| `oplog.controller.ts` | Endpoints Express para el nuevo sync |

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

## Scheduler

`oplog-scheduler.service.ts`:
- `startOplogScheduler()`: inicia ciclo startup, timer 5min, escucha `onAppendEventCallback`
- Lee config desde `oplogStateService` o desde sync legacy
- Notifica progreso via Socket.IO `syncProgress`
- Ignora ciclos si ya hay uno en curso (`isSyncing` flag)

## Dependencias

- `@automerge/automerge` v3 — CRDT para merge de documentos
- `google-auth-library` + `googleapis` — Drive v3 API
- Prisma ORM — acceso a DB local
