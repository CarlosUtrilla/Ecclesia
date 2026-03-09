# Lista de pendientes y features esperadas para el MVP

> La lista va en orden de prioridades y debe de considerarse resolver los problemas que estan mas arriba primero

1. [X] Añadir a la lista de elementos excluidos del schedule, el componente de temas para poder dar click a un tema y ver el preview sin que se quite el preview
2. [X] Al hacer click en un nuevo tema, no se debe mandar el nuevo tema al live, hasta que se mande desde el schedule
3. [X] Al iniciar la app y empezar a trabajar en un schedule temporal, si me muevo a la lista de cronogramas no me sale la opcion para regresar al schedule temporal en el que estaba trabajando
4. [X] de igual manera, mejorar el ui del schema y la lista del schema, sus cabezeras son un poco feas y puede mejorarse el diseño
5. [X] A si mismo, despues de esto, en la pantalla de items-on-live, mostrar un boton para cambiar la vista entre lista y grid
6. [X] Implementar `Presentaciones` como nuevo tipo de medio (MVP)

- Crear/usar `Presentaciones` en la biblioteca (ya contemplado en Prisma).
- Una presentación debe ser una colección de diapositivas con:
- imágenes,
- videos,
- textos bíblicos,
- bloques de texto libre (NO canciones).
- Permitir crear/editar diapositivas con texto estilo PowerPoint (posición, contenido y formato básico).
- Permitir ordenar diapositivas y presentarlas desde el cronograma como un recurso único.
- Considerar importación de PowerPoint en una fase posterior (fuera del MVP inmediato).

1. [X] planear como sincronizar toda la configuracion, base de datos y archivos entre varias computadoras
2. [X] considerar que las animaciones de cambios entre fondos y de fondos a videos o imagenes sean segun las animaciones elegidas para el tema que va entrando o el seleccionado en caso de poner un video o una foto, o en su defecto (de preferencia esta opcion), implementar un selecitor de transisiones en el creador de temas, para seleccionar la transision de entrada
3. [X] añadir una configuracion para que siempre que haya una pantalla en vivo pero no haya un recurso cargado mostrandose, se muestre como fallback un video o imagen seleccionado por el usuario que sera considerado como “logo” que puede servir como pantalla de fondo al quitar un recurso, este siempre estara debajo de los fondos de los temas para que al ocultar los recursos siempre haya una pantalla de fondo y no se vea en blanco o negro
4. [X] Ademas, añador un listener de botones para elegir si mostrar el logo rapidamente por ejemplo con la tecla F10, o si ocultar el texto pero sin quitar el fondo pro ejemplo con F9, o mostrar una pantalla en negro por ejemplo con F11, o quitar la pantalla en vivo con F7
5. [X] en el editor de temas añadir una manera de hacer crecer o achicar el contenedor del texto, de manera que tenga “margenes” o “padding” desde el borde de la pantalla, lo mismo para el verso cuando esta seleccionado en “mostrar debajo de la pantalla o arriba” para poder elegir que tan cerca del borde se quiere ue este el texto
6. [X] gestionar las pantalla de stage, e implementar en el editor de temas la opcion de poder usar recursos varios sobre la pantalla de stage, como un cronometro, una caja para mandar mensajes al predicador, un temporizador, un preview de la siguiente diapositiva, verso, letra, etc del recurso presentado en vivo, el tiempo del video que se esta viendo, etc, para que las personas de estage puedan ver lo necesario para comunicarse con ellos, al estilo vista del presentador de powerpoint pero con super mega poderes
7. [ ] despues de resolver todos estos puntos debemos conseguir que los apuntadores (los que se usan para poner diapositiva siguiente y anteriir) sean compatibles con la app
8. [ ] Guardar configuracion del layaout de como lo acomodo el usuario para que sea mas comodo para el, asi al abrir se abre tal cual lo dejo configurado y no tiene que mover de nuevo, lo mismo para el videMode del items-on-live, debe guardarse la preferencia del usuario

## Nuevo requerimiento iniciado: controlador especial para PRESENTATION en items-on-live

> Estado: MVP completado, pendiente persistencia/configuración avanzada

### MVP (primera fase)

1. [X] Crear un render específico para `PRESENTATION` en `items-on-live` (por ejemplo `RenderPresentationLiveController`) en lugar de usar directamente `RenderGridMode`.
2. [X] Reutilizar internamente `RenderGridMode` para seleccionar visualmente la diapositiva activa que se enviará al live.
3. [X] Agregar un controlador inferior siempre visible para presentaciones con:

- botón `Anterior diapositiva`
- botón `Siguiente diapositiva`
- indicador de índice actual (`n / total`)

1. [X] Detectar si la diapositiva activa contiene video y, solo en ese caso, mostrar controles de reproducción a un lado del controlador principal:

- `Play`
- `Pausa`
- `Reiniciar`
- barra de progreso/seek
- control de volumen
- UI compuesta y compartida con `RenderMedia` para mantener consistencia visual (`VideoLiveControls`)

1. [X] Conectar la acción de avance de diapositiva con el flujo actual de live (`siguiente` desde controlador = comportamiento equivalente a avanzar slide en vivo).

### Persistencia / configuración

1. [X] Definir configuración por diapositiva (o por item de diapositiva) para comportamiento de video en live, por ejemplo:

- iniciar automático al entrar en vivo
- iniciar manualmente con play

1. [X] Persistir esa configuración en los datos de presentación (DB) para que se conserve entre sesiones.
2. [X] Exponer edición de esa configuración en el editor de presentaciones (toolbar de media y/o menú contextual).

### Fase siguiente (versos en rango dentro de una slide)

1. [X] Detectar slides con contenido bíblico en rango (ej. `Mateo 2:1-6`) y tratarlas como sub-pasos navegables.
2. [X] Hacer que `Anterior/Siguiente` recorran versos internos cuando la slide activa tenga rango, antes de pasar a la siguiente diapositiva.
3. [X] Diseñar modelo de datos para sub-índice interno por slide (verso actual dentro del rango) y su sincronización en live.

## Nueva actualización planificada: sincronización avanzada diferencial (DB + archivos)

> Objetivo: dejar de sincronizar por ZIP completo y pasar a una sincronización inteligente por cambios, evitando pérdida de datos cuando hay 2 PCs editando en paralelo.
>
> Decisión tomada: usar almacenamiento oculto de app en Google Drive (`appDataFolder`, estilo WhatsApp) y eliminar el flujo ZIP legado sin mantener compatibilidad hacia atrás.

### Fase 0 - Definición de modelo de sincronización

1. [ ] Definir estrategia oficial de merge por entidad para DB (no sobreescribir toda la base):

- Canciones, temas, medios, settings, schedules, etc. se comparan por registro (no por archivo DB completo).
- Cada entidad debe tener metadatos mínimos de sync: `updatedAt`, `deletedAt` (soft delete), `updatedByDevice`, `version` (entero incremental o vector simplificado).

1. [ ] Definir reglas de conflicto por tabla (matriz de resolución):

- `lastWriteWins` por campo cuando sea seguro.
- `askBeforeOverwrite` para colisiones sensibles (ej. edición concurrente del mismo tema).
- `merge automático` cuando son cambios independientes (ej. PC A crea canción y PC B crea tema).

1. [ ] Crear documento de contratos de sincronización (payload, orden, idempotencia, retries, rollback).

### Fase 1 - Sincronización diferencial de base de datos

1. [X] Crear tabla local `sync_state` (o equivalente) para checkpoints por dispositivo:

- `lastPulledAt`, `lastPushedAt`, `lastAckedChangeId`, `deviceId`, `workspaceId`.

1. [X] Crear log de cambios por entidad (outbox/inbox):

- Registrar `create/update/delete` por fila y tabla.
- Generar `changeId` monotónico y payload mínimo por cambio.

1. [X] Implementar `push` de cambios pendientes (solo difs desde último ack).
2. [X] Implementar `pull` de cambios remotos (solo difs nuevos) con aplicación transaccional por lotes.
3. [X] Asegurar merge por registro para el caso multi-PC (A crea canción, B crea tema) sin pérdida de datos.
4. [X] Soportar tombstones (`deletedAt`) para propagar eliminaciones correctamente.

### Fase 2 - Sincronización diferencial de archivos (sin ZIP completo)

1. [X] Construir índice de archivos sincronizables (`media_manifest`) con:

- `path`, `size`, `checksum` (sha256), `mtime`, `deletedAt`, `lastSyncedAt`.

1. [X] Subir solo archivos nuevos o modificados comparando manifest local vs remoto.
2. [X] Descargar solo archivos faltantes o desactualizados.
3. [X] Propagar eliminaciones de archivos mediante tombstones (no re-subir archivos borrados).
4. [X] Evitar re-subida de binarios idénticos (dedupe por checksum).
5. [X] Implementar almacenamiento remoto en `appDataFolder` (oculto para el usuario en Drive) para reducir riesgo de borrado/manipulación accidental.

### Fase 3 - Scheduler y observabilidad operativa

1. [X] Mantener auto-sync cada 5 minutos como scheduler principal para push/pull diferencial.
2. [X] Añadir estado visible del ciclo de sync:

- próxima ejecución,
- cambios pendientes locales,
- cambios remotos pendientes,
- último resultado (ok/error) con detalle.

Estado actual: se exponen en `sync:google-drive:status` `pendingOutboxChanges`, `pendingInboxChanges`, `nextRunAt`, `lastRunStatus`, `lastRunReason`, `lastRunAt`, `lastRunError`, `retryCount`, `nextRetryAt`, `schedulerHealthy` y `lastSchedulerHeartbeatAt`.

1. [X] Reintentos con backoff y cola persistente si falla internet/Drive.
2. [X] Health checks para detectar scheduler detenido o config inválida.
3. [X] Diseñar estrategia para ocultar/aislar la carpeta de Ecclesia en Google Drive (estilo WhatsApp) y minimizar borrados/cambios accidentales del usuario.
4. [X] Definir permisos/estructura recomendada (carpetas de app, nombres internos, y validaciones de integridad) para evitar manipulación manual.

Estado actual: sincronización diferencial persistida en `appDataFolder` con nombres internos por workspace/dispositivo (`ecclesia-diff-manifest-*`, `ecclesia-diff-changes-*`, `ecclesia-media-manifest-*`, `ecclesia-media-blob-*`) y validación estricta de `schemaVersion`, `workspaceId`, fechas y estructura antes de ingerir cambios o manifests remotos.

### Fase 4 - Migración segura desde el modelo actual

1. [X] Eliminar código y dependencias del flujo ZIP actual (`archiver`, `unzipper`, restore por zip) en el manager de sync.
2. [X] Reemplazar endpoints de sync actuales para que trabajen exclusivamente con diffs (DB + media manifest).
3. [X] Agregar comando de reconciliación manual (re-index DB y media) para bootstrap inicial en instalaciones nuevas.

### Fase 5 - Testing y validación de escenarios reales

Estado actual: infraestructura base de testing habilitada con Vitest (`npm run test`, `npm run test:watch`, `npm run test:coverage`), setup global en `tests/setup/vitest.setup.ts`, pruebas de seguridad/regresión en `app/lib/utils.security.test.ts` y `app/lib/utils.test.ts`, cobertura inicial del módulo de sincronización en `database/controllers/sync/sync.service.test.ts` y `database/controllers/sync/sync.controller.test.ts`, y pruebas de integración ligera en `database/controllers/sync/sync.service.integration.test.ts` para flujos inbox/outbox.

1. [X] Tests de concurrencia multi-dispositivo:

- PC A crea canción + PC B crea tema,
- PC A edita tema X + PC B edita el mismo tema X,
- eliminaciones cruzadas,
- cortes de red y recuperación.

Cobertura: `database/controllers/sync/sync.service.integration.test.ts` cubre altas independientes, conflicto sobre mismo tema y eliminaciones cruzadas idempotentes; `electron/main/googleDriveSyncManager/googleDriveSyncManager.test.ts` cubre helpers de backoff (`calculateRetryDelayMs`, `buildRetryBackoffState`) y `electron/main/googleDriveSyncManager/googleDriveSyncManager.scheduler.test.ts` cubre falla inicial + retry automático por timer + recuperación del ciclo.

1. [X] Tests de integridad de media (hash, duplicados, borrados).
2. [X] Test de performance para confirmar reducción de transferencia frente al ZIP completo.
3. [X] Checklist de salida a producción con métricas mínimas de confiabilidad.

Cobertura media/performance: `electron/main/googleDriveSyncManager/googleDriveSyncManager.media.test.ts` valida dedupe por checksum, descarga diferencial, propagación de tombstones, rechazo de manifest remoto inválido y transferencia por delta (sin re-subida de blobs cuando no hay cambios).

Referencia: `docs/SYNC_FASE5_CHECKLIST.md` (matriz multi-dispositivo, integridad de media, performance y criterios de salida).
