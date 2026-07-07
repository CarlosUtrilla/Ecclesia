# Sistema de Sincronización: Operation Log con Automerge CRDT

> **Objetivo:** Reemplazar el sistema actual de snapshots + last-write-wins por un
> **operation log CRDT** con garantías de convergencia, historial completo tipo Git,
> y sincronización fiable de archivos entre N PCs vía Google Drive.

---

## 1. Problema del sistema actual

| Problema | Causa raíz |
|----------|------------|
| Se pierden cambios | Snapshot completo sobrescribe datos si dos PCs suben a la vez |
| Deletes no se propagan | Soft-delete por miedo a perder datos — el snapshot no podía modelar "esto fue borrado intencionalmente" |
| Archivos y DB desincronizados | No hay una fuente de verdad única que correlacione ambos |
| No se puede auditar | El snapshot solo guarda el estado final, no el historial |
| Conflictos irresolubles | Last-write-wins pierde información — no hay merge inteligente |

---

## 2. Arquitectura general

Cada PC mantiene dos cosas:

```
┌────────────────────────────────────────────────────────────────┐
│                         PC 1                                    │
│                                                                 │
│  ┌──────────────────────┐    ┌───────────────────────────────┐  │
│  │  Local SQLite (Prisma)│    │  OpLog document (Automerge)  │  │
│  │  - songs, themes, etc │    │  - Append-only event log     │  │
│  │  - queryable state    │    │  - CRDT: merge automático    │  │
│  └──────────┬───────────┘    └──────────────┬────────────────┘  │
│             │                               │                    │
│             │         Replay Engine          │                    │
│             │  (aplica eventos → DB + files) │                    │
│             └───────────────┬───────────────┘                    │
│                             │                                    │
│                    ┌────────┴────────┐                           │
│                    │  Media Blobs    │                           │
│                    │  (archivos en   │                           │
│                    │   disco local)  │                           │
│                    └─────────────────┘                           │
└────────────────────────────────────────────────────────────────┘
                             │
                             │ Google Drive
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                         Google Drive                           │
│                                                                 │
│  /Ecclesia/                                                     │
│    ecclesia-oplog-{workspaceId}.bin    ← Automerge binary doc  │
│    ecclesia-blob-{workspaceId}-{checksum}.bin  ← Blobs         │
└────────────────────────────────────────────────────────────────┘
```

**Flujo alto nivel:**

1. Usuario hace un cambio → se escribe en SQLite local
2. El cambio se registra como **evento** en el OpLog (Automerge doc)
3. Periódicamente: el OpLog se sube a Drive (con optimistic lock)
4. Otras PCs: descargan el OpLog, Automerge mergea automáticamente
5. Las PCs detectan eventos nuevos → los **replayean** contra SQLite local
6. Si un evento requiere un archivo (checksum), lo descargan de Drive si no existe localmente

---

## 3. El Operation Log (OpLog)

### 3.1 ¿Qué es el OpLog?

Es un documento Automerge que contiene una lista ordenada de eventos. Cada evento
representa una mutación atómica. Automerge garantiza que:

- **Convergencia:** Todos los dispositivos ven la misma lista de eventos (mismo orden)
- **Merge automático:** Eventos concurrentes se integran sin pérdida
- **Historial completo:** Nunca se pierde información (similar a Git)

### 3.2 Estructura del documento

```typescript
// DocType de Automerge
type OplogDocument = {
  schemaVersion: 1
  workspaceId: string
  createdAt: number

  // Lista CRDT de eventos (append-only)
  ops: OplogEvent[]

  // Snapshot compactado (opcional, ver sección 7)
  snapshot?: {
    takenAt: number
    takenFrom: { deviceId: string; seq: number }[]  // últimos eventos incluidos
    entities: EntityStateMap
  }
}

// Cada evento es inmutable una vez en el log
type OplogEvent = {
  // Metadatos del evento
  id: string          // UUID v4, único global
  seq: number         // Monotónico por deviceId
  deviceId: string    // Dispositivo que originó el evento
  timestamp: number   // Reloj del dispositivo origen (Unix ms)

  // Payload del evento
  entityType: EntityType
  entityId: string

  // Operación
  op: 'upsert' | 'delete'

  // Estado completo de la entidad (solo para upsert)
  data?: Record<string, unknown>

  // Si la entidad reference un archivo blob (Media, Font, etc.)
  checksum?: string
  blobSize?: number
  blobMimeType?: string
  blobPath?: string   // Path local original (solo informativo)
}

type EntityType =
  | 'song'
  | 'tagSongs'
  | 'media'
  | 'font'
  | 'themes'
  | 'presentation'
  | 'biblePresentationSettings'
  | 'setting'
  | 'schedule'
  | 'scheduleGroupTemplate'
  | 'scheduleItem'
  | 'selectedScreens'
  | 'stageScreenConfig'
```

### 3.3 Principio clave: evento auto-contenido

Cada evento `upsert` contiene el **estado COMPLETO** de la entidad, no un diff.
Esto elimina la necesidad de ordenar eventos para aplicar correctamente.

```typescript
// ✅ Así se ve un evento real
{
  id: 'a1b2c3d4-...',
  seq: 42,
  deviceId: 'pc-1',
  timestamp: 1749168000000,
  entityType: 'media',
  entityId: '15',
  op: 'upsert',
  data: {
    name: 'Fondo Navidad',
    type: 'IMAGE',
    format: 'webp',
    filePath: 'media/Navidad/fondo.webp',
    fileSize: 245000,
    width: 1920,
    height: 1080,
    folder: 'Navidad',
    checksum: 'sha256-abc123...',
    // ... todos los campos de Media
  },
  checksum: 'sha256-abc123...',
  blobSize: 245000,
  blobMimeType: 'image/webp',
  blobPath: 'media/Navidad/fondo.webp'
}
```

### 3.4 Tracking de eventos aplicados

Cada PC mantiene un archivo local que registra qué eventos del OpLog ya fueron
procesados. Como el OpLog es una lista CRDT con orden determinístico, se puede
trackear por índice:

```
# archivo: sync/replay-state.json
{
  "lastAppliedIndex": 1042,      // Último índice procesado del OpLog
  "lastAppliedEventId": "x...",  // ID del último evento aplicado
  "appliedAt": "2026-06-06T12:00:00Z"
}
```

**Algoritmo de replay:**

```
1. Leer OpLog local (Automerge doc) → ops[]
2. Cargar replay-state.json → lastAppliedIndex
3. Si ops.length > lastAppliedIndex:
     nuevos = ops.slice(lastAppliedIndex)
     for evento in nuevos:
       applyEvent(evento)   ← a DB + filesystem
     replay-state.lastAppliedIndex = ops.length - 1
     persistir replay-state
```

**¿Por qué funciona con concurrent appends?**

Automerge asigna a cada elemento de la lista una posición determinística global
(basada en `(actorId, seq)`). Dos dispositivos que hacen merge ven la misma
lista con el mismo orden. Los elementos nuevos aparecen después de los existentes
(y el orden entre ellos es determinístico). Por lo tanto, `slice(lastAppliedIndex)`
siempre devuelve solo los eventos nuevos, en el orden correcto.

**Caso borde:** Si un dispositivo se atrasa (ej: no sincroniza por días), el
tracking por índice sigue funcionando porque la lista solo crece. Eventos viejos
no cambian de posición.

---

## 4. Ciclo de sincronización

### 4.1 Pull (descargar + mergear + aplicar)

```
function pull():
  // 1. Descargar OpLog remoto de Drive
  remoteDoc = downloadFromDrive('ecclesia-oplog-{ws}.bin')
  remoteGen = remoteDoc.generation  // ← para optimistic lock

  // 2. Merge con OpLog local (Automerge CRDT)
  localDoc = readLocalOplog()
  mergedDoc = automerge.merge(localDoc, remoteDoc)
  // Automerge garantiza: mergedDoc.ops contiene TODOS los eventos
  // de localDoc + remoteDoc, en orden determinístico

  // 3. Detectar y aplicar eventos nuevos
  newEvents = findNewEvents(mergedDoc.ops, localReplayState.lastAppliedIndex)
  for event in newEvents:
    applyEvent(event)

  // 4. Guardar estado merged localmente
  writeLocalOplog(mergedDoc)
  updateReplayState(newEvents.length)

  return { newEventCount: newEvents.length, remoteGen }
```

### 4.2 Push (subir cambios locales con optimistic lock)

```
function push(remoteGen):
  // 1. Recolectar cambios locales no subidos
  localChanges = getLocalChangesSinceLastPush()
  if localChanges.length === 0: return

  // 2. Cargar OpLog local, appendear nuevos eventos
  localDoc = readLocalOplog()
  localDoc = automerge.change(localDoc, (doc) => {
    for change in localChanges:
      doc.ops.push(change)
  })

  // 3. Subir a Drive con optimistic lock
  try:
    uploadToDrive('ecclesia-oplog-{ws}.bin', localDoc, {
      ifGenerationMatch: remoteGen
    })
    // Éxito → nadie más modificó el archivo entre nuestro pull y push
    updateLastPushState(localChanges)
  catch error where error.code === 'CONCURRENCY_ERROR':
    // Otro PC subió primero → tenemos que reiniciar
    // Esto NO pierde cambios: re-hacemos pull y reintentamos
    return pullAndPush()
```

### 4.3 Ciclo completo

```
function syncCycle():
  // FASE 1: PULL
  result = pull()  // descarga, mergea, aplica eventos remotos
  remoteGen = result.remoteGen

  // FASE 2: PUSH
  push(remoteGen)  // sube eventos locales (si hay)

  // FASE 3: BLOB SYNC (ver sección 5)
  syncBlobs()
```

**¿Qué pasa si dos PCs hacen pull a la vez?**

```
PC1: pull → remoteGen = 5
PC2: pull → remoteGen = 5  ← misma generation, OK

PC1: push(5) → sube → Drive ahora tiene gen 6
PC2: push(5) → FAIL (generation mismatch)

PC2: pull → remoteGen = 6  ← incorpora cambios de PC1
PC2: push(6) → sube merge → Drive gen 7

Resultado: doc final tiene eventos de ambas PCs. Nadie pierde datos.
```

Esto es equivalente a `git pull --rebase && git push` — exactamente el
mismo patrón que Git usa para garantizar consistencia.

---

## 5. Ciclo de vida de archivos (blobs)

### 5.1 Visión general

Los archivos binarios (imágenes, videos, PDFs, fuentes, biblias `.ebbl`) se
almacenan en Drive keyeados por **checksum**. El OpLog contiene la metadata
(checksum, path, tamaño) como parte de los eventos de entidad.

```
Drive:
  ecclesia-oplog-ws-abc.bin           ← eventos
  ecclesia-blob-ws-abc-sha256_X.bin   ← blob (un archivo)
  ecclesia-blob-ws-abc-sha256_Y.bin   ← otro blob
```

### 5.2 Creación de un archivo

```
PC1:
  1. Usuario importa imagen → se guarda en disco local
  2. Se calcula checksum SHA-256
  3. Se crea registro Media en DB local
  4. Se appentea evento al OpLog:
       { entityType: 'media', op: 'upsert', data: {..., checksum: 'sha256_X'} }
  5. Se sube blob a Drive (si no existe ya)
  6. Se sube OpLog a Drive (push)

PC2 (en próximo sync):
  1. Pull: descarga OpLog, mergea, detecta evento nuevo
  2. Replay: upsert Media en DB local
  3. Replay detecta checksum → busca en media manifest local
  4. Blob no existe localmente → descarga de Drive: ecclesia-blob-ws-sha256_X.bin
  5. Guarda archivo en disco local en la ruta indicada por event.data.filePath
```

### 5.3 Eliminación de un archivo

```
PC1:
  1. Usuario elimina medio
  2. Se elimina registro Media de DB local (hard delete)
  3. Se elimina archivo de disco local
  4. Se appentea evento al OpLog:
       { entityType: 'media', entityId: '15', op: 'delete' }
  5. Se sube OpLog a Drive

PC2 (en próximo sync):
  1. Pull: detecta evento delete para media 15
  2. Replay: elimina registro Media de DB local (hard delete)
  3. Replay: verifica si algún otro evento upsert activo reference
     el mismo checksum
  4. Si nadie más reference el checksum → elimina archivo de disco local

Blob en Drive:
  - NO se elimina inmediatamente al recibir el delete
  - Permanece en Drive hasta el próximo GC (ver sección 5.5)
  - Esto permite que PC2 descargue el blob incluso si PC1 ya lo borró
    (ventana de seguridad entre delete y GC)
```

### 5.4 Movimiento de un archivo

```
PC1:
  1. Usuario mueve medio a otra carpeta
  2. Se actualiza registro Media en DB (filePath, folder)
  3. Archivo se mueve en disco local
  4. Se appentea evento al OpLog:
       { entityType: 'media', entityId: '15', op: 'upsert',
         data: {..., filePath: 'NuevoPath', folder: 'NuevaCarpeta'} }
  5. Se sube OpLog a Drive

Drive:
  - No afecta (blob keyeado por checksum, no por path)

PC2 (en próximo sync):
  1. Pull: detecta evento upsert para media 15 con nuevo filePath
  2. Replay: actualiza DB con nuevo path
  3. Replay: mueve archivo en disco local (renombra/cambia carpeta)
```

### 5.5 Garbage Collection de blobs

Los blobs en Drive son **append-only**: una vez subidos, se quedan. El GC
es un proceso separado que se ejecuta periódicamente (o manual):

```
function garbageCollectBlobs():
  // 1. Escanear OpLog para encontrar checksums activos
  activeChecksums = scanActiveChecksums(oplogDoc.ops)
  // activeChecksums = set de checksums referenciados por eventos
  // upsert activos (sin delete posterior)

  // 2. Listar blobs en Drive
  driveBlobs = listDriveBlobs('ecclesia-blob-ws-')

  // 3. Identificar huérfanos
  orphanBlobs = driveBlobs
    .filter(blob => !activeChecksums.has(blob.checksum))

  // 4. Eliminar huérfanos (solo si tienen más de 7 días)
  for blob in orphanBlobs:
    if blob.age > 7 days:
      deleteFromDrive(blob.fileId)
```

**Ventana de seguridad de 7 días:** Asegura que incluso si un dispositivo
estuvo offline por una semana, todavía puede descargar blobs referenciados
por eventos que recibió antes del GC.

### 5.6 Sincronización de blobs (syncBlobs)

```
function syncBlobs():
  // 1. Escanear OpLog local para entidades con checksum
  localActiveChecksums = getActiveChecksums(oplog)

  // 2. Comparar con manifest local (qué blobs tenemos en disco)
  localManifest = readLocalMediaManifest()
  missingChecksums = localActiveChecksums
    .filter(cs => !localManifest.has(cs))

  // 3. Descargar blobs faltantes
  for checksum in missingChecksums:
    downloadFromDrive(`ecclesia-blob-ws-${checksum}.bin`)
    saveToLocalDisk(checksum)

  // 4. Eliminar blobs locales no referenciados
  for entry in localManifest:
    if !localActiveChecksums.has(entry.checksum):
      deleteLocalFile(entry.path)
      localManifest.remove(entry)
```

---

## 6. Replay Engine

El Replay Engine es el componente que toma eventos del OpLog y los aplica al
estado local (SQLite + filesystem).

### 6.1 Algoritmo

```
function applyEvent(event):
  switch event.op:
    case 'upsert':
      // Aplicar a DB (upsert = insert or update)
      prisma.upsert({
        where: { id: event.entityId },
        create: { id: event.entityId, ...event.data },
        update: event.data
      })
      // Si la entidad tiene checksum (media, font):
      if event.checksum:
        ensureBlobLocally(event.checksum)
        ensureFileAtPath(event.data.filePath, event.checksum)

    case 'delete':
      // Obtener referencia al checksum antes de borrar
      if event.entityType === 'media':
        checksum = getChecksumBeforeDelete(event.entityId)

      // Eliminar de DB (hard delete)
      prisma.delete({
        where: { id: event.entityId }
      })

      // Si nadie más reference el checksum → eliminar archivo local
      if checksum && !isChecksumReferencedByOtherEntities(checksum):
        deleteLocalFile(getPathForChecksum(checksum))
        removeFromLocalManifest(checksum)
```

### 6.2 Procesamiento batch

Para eficiencia, los eventos se procesan en batches:

```
function applyEvents(events[]):
  // Separar por tipo de operación
  upserts = events.filter(e => e.op === 'upsert')
  deletes = events.filter(e => e.op === 'delete')

  // Aplicar upserts en batch (usando createMany con skipDuplicates)
  // Aplicar deletes en batch
  // Procesar blobs (descargas y eliminaciones)
```

### 6.3 Idempotencia

Cada evento es idempotente:
- `upsert` con `data` completa → aplicar dos veces da el mismo resultado
- `delete` de un ID que ya no existe → no hace nada (error P2025 se ignora)

---

## 7. Compaction (squash)

Con el tiempo, el OpLog crece. La compactación es el equivalente a squashear
commits en Git.

### 7.1 Cuándo compactar

- Cuando el OpLog supera N eventos (ej: 10,000)
- O cuando supera N MB (ej: 50 MB)
- O manualmente

### 7.2 Algoritmo de compactación

```
function compact():
  // 1. Leer todos los eventos del OpLog
  events = oplog.ops

  // 2. Replay para calcular estado actual de todas las entidades
  state = applyEventsInMemory(events)
  // state = { 'song': { '1': {...}, '2': {...} }, 'media': {...}, ... }

  // 3. Crear NUEVO documento Automerge
  newDoc = automerge.from({
    schemaVersion: 1,
    workspaceId: oplog.workspaceId,
    createdAt: oplog.createdAt,
    snapshot: {
      takenAt: Date.now(),
      takenFrom: getLastEventMetadata(events),
      entities: state
    },
    ops: []
  })

  // 4. Subir nuevo doc a Drive (reemplaza al anterior)
  uploadToDrive('ecclesia-oplog-ws.bin', newDoc, {
    ifGenerationMatch: currentGen
  })

  // 5. Localmente: reemplazar doc + resetear replay state
  writeLocalOplog(newDoc)
  updateReplayState({ lastAppliedIndex: -1 })
  // Como ahora tenemos snapshot, el próximo replay aplica
  // el snapshot entero (más rápido que replayear eventos históricos)
```

### 7.3 Replay con snapshot

Cuando un dispositivo descarga un OpLog que tiene `snapshot`:

```
function applySnapshotIfNeeded():
  if oplog.snapshot && localReplayState.snapshotAppliedAt < oplog.snapshot.takenAt:
    // Aplicar snapshot completo (mucho más rápido que replay)
    for each entityType, entities in oplog.snapshot.entities:
      bulkUpsertIntoDB(entityType, entities)
    updateReplayState({
      snapshotAppliedAt: oplog.snapshot.takenAt,
      lastAppliedIndex: -1  // reinicia tracking de eventos
    })
    // Luego procesa ops (eventos posteriores al snapshot) normalmente
```

---

## 8. Evolución del schema (migraciones de Prisma)

¿Qué pasa cuando una PC tiene una versión del schema de Prisma distinta a otra?
Ej: PC2 agrega la columna `genre` a `Song` via migración, genera un evento con
ese campo. PC1 (sin la columna) intenta aplicar el evento y Prisma lanza error
porque `genre` no existe en su schema local.

### 8.1 Estrategia: tolerancia a campos y tablas desconocidas via DMMF

El Replay Engine usa DMMF (Data Model Meta Format — el metamodelo que Prisma
expone en runtime) para saber qué modelos y campos existen localmente.

**Para tablas nuevas:** si el `entityType` de un evento no corresponde a
ningún modelo de Prisma local, el evento se **salta** silenciosamente. Los
datos se preservan en el OpLog; cuando la PC reciba la migración y el modelo
exista, una compactación o re-replay los incorporará.

```
function applyEvent(event):
  // Verificar si el modelo existe localmente
  if not prismaModelExists(event.entityType):
    log(`Modelo ${event.entityType} no existe localmente → skip`)
    return  // evento preservado en OpLog, se aplicará cuando migre

  // Filtrar campos que no existen en el schema local
  validFields = getPrismaFieldsForModel(event.entityType)
  filteredData = {}
  if event.data:
    for key, value in event.data:
      if key in validFields:
        filteredData[key] = value

  // Aplicar según operación
  ...
```

**Para tablas eliminadas:** si una PC más nueva eliminó un modelo del schema,
los eventos con ese `entityType` simplemente se ignoran (el modelo no existe
en DMMF).

**Para blobs de tablas nuevas:** el Replay Engine no descarga blobs asociados
a eventos que fueron skippeados (porque no hay entidad local que los reference).
El GC eventualmente los limpia de Drive si quedan huérfanos.

El Replay Engine filtra campos del evento contra el schema **local** usando
DMMF:

```
function applyUpsert(entityType, entityId, data):
  validFields = getPrismaFieldsForModel(entityType)
  // validFields = Set('id', 'title', 'author', 'updatedAt')

  filteredData = {}
  for key, value in data:
    if key in validFields:
      filteredData[key] = value
    // Si el campo no existe en schema local → se ignora aquí
    // pero se preserva en el OpLog para cuando llegue la migración

  prisma.upsert({
    where: { id: entityId },
    create: { id: entityId, ...filteredData },
    update: filteredData
  })
```

**¿Qué pasa cuando PC1 eventualmente recibe la migración?**

Los eventos históricos en el OpLog ya contienen `genre`. Al hacer una
compactación post-migración, el snapshot regenerado incluye `genre` para
todas las entidades que lo tenían en su data histórica.

O bien, al detectar que el `schemaHash` cambió, se hace un **re-replay**
desde el último snapshot — los campos nuevos ahora existen en `validFields`
y se propagan a todas las entidades.

### 8.2 Estrategia: schemaHash en el OpLog

El documento OpLog incluye un `schemaHash` derivado del DMMF de Prisma:

```typescript
type OplogDocument = {
  schemaVersion: 1
  workspaceId: string
  schemaHash: string   // SHA-256 del DMMF del dispositivo que creó el doc
  createdAt: number
  ops: OplogEvent[]
  snapshot?: { ... }
}
```

**Regla en cada ciclo de sync:**

```
function syncCycle():
  // 1. PULL siempre permitido (filtra campos desconocidos via DMMF)
  result = pull()

  // 2. Verificar compatibilidad antes de PUSH
  remoteHash = getRemoteSchemaHash()
  localHash = computeLocalSchemaHash()

  if remoteHash !== localHash:
    if isRemoteSchemaNewer(remoteHash):
      // El remoto tiene schema más nuevo → no podemos pushear
      notifyUser("Actualizá esta PC para poder sincronizar")
      return  // pull sí, push no
    else:
      // Schema local más nuevo → OK, los campos extra se filtrarán
      // en las PCs viejas via DMMF
      push(result.remoteGen)
  else:
    push(result.remoteGen)
```

### 8.3 Tabla de cambios seguros

| Operación | ¿Seguro sin migración cruzada? | Comportamiento |
|-----------|-------------------------------|----------------|
| Agregar columna nullable | Sí | DMMF filtra → se ignora en PCs viejas |
| Agregar columna con default | Sí | DMMF filtra, default se aplica localmente |
| Eliminar columna nullable | Sí | Replay ignora el campo viejo |
| Crear tabla nueva | Sí | Replay ignora entityType desconocido localmente |
| Eliminar tabla | Sí | Replay ignora entityType desconocido |
| Renombrar columna | No | Se pierde el mapeo — migración orquestada |
| Cambiar tipo de columna | No | Sync bloqueado hasta migrar todas las PCs |
| Agregar columna NOT NULL sin default | No | Sync bloqueado hasta migrar todas las PCs |

### 8.4 En la práctica (single-user multi-PC)

1. Actualizás PC1 → las migraciones de Prisma corren al arrancar
2. PC1 puede hacer pull de eventos de otras PCs (siempre seguro)
3. PC1 NO puede hacer push hasta que TODAS las PCs tengan el schema al día
4. Actualizás PC2, arranca, migra → schema match → sync normal

El bloqueo de push es intencional: evita que eventos con campos que
PC2 no entiende se mezclen en el OpLog. El pull siempre funciona.

---

## 9. Manejo de conflictos

Automerge ya garantiza convergencia a nivel de la lista de eventos. Pero
¿qué pasa si dos PCs modifican la misma entidad concurrentemente?

### 8.1 Caso: mismo entityId, ambos upsert

```
Evento A (PC1): { entityType: 'media', entityId: '15', op: 'upsert',
                   data: { name: 'Fondo', folder: 'Navidad' } }
Evento B (PC2): { entityType: 'media', entityId: '15', op: 'upsert',
                   data: { name: 'Fondo Navidad', folder: 'Cuaresma' } }
```

**Resolución:** Ambos eventos existen en el OpLog. El Replay Engine aplica
ambos en el orden determinístico dado por Automerge. Como cada `upsert`
contiene el estado completo, el **último en el orden** gana (last-writer-wins
pero a nivel de evento individual, no de snapshot entero).

Alternativamente, podemos implementar **merge a nivel de campo**:

```typescript
// En lugar de LWW simple, mergeamos campos individuales
function applyUpsert(existing, event):
  return {
    ...existing,
    ...event.data,                          // campos nuevos/actualizados
    name: event.data.name ?? existing.name,  // no sobreescribir con undefined
  }
```

En la práctica, como cada evento tiene el **estado completo** de la entidad,
el merge CRDT de Automerge ya da un orden total. El campo `updatedAt` se
preserva del evento más reciente en el orden total.

### 8.2 Caso: upsert vs delete concurrente

```
Evento A (PC1): { entityType: 'media', entityId: '15', op: 'upsert', ... }
Evento B (PC2): { entityType: 'media', entityId: '15', op: 'delete' }
```

**Resolución:** En el orden determinístico:
- Si delete va después → la entidad queda eliminada
- Si upsert va después → la entidad queda creada

Ambos casos son correctos. El orden CRDT de Automerge es el "desempate" justo.

### 8.3 Historial y reversión

Como el OpLog guarda todos los eventos, siempre se puede:

```
// Ver historial de una entidad
function getEntityHistory(entityType, entityId):
  return oplog.ops
    .filter(e => e.entityType === entityType && e.entityId === entityId)
    .sortByPosition()

// Revertir al estado anterior (Git revert)
function revertToBefore(targetEvent):
  // 1. Encontrar evento anterior para esta entidad
  previousEvent = findPreviousEvent(targetEvent.entityType, targetEvent.entityId, targetEvent)
  // 2. Si existe previousEvent → crear nuevo evento upsert con su data
  // 3. Si no existe → crear nuevo evento delete
  appendEvent(previousEvent ? { op: 'upsert', data: previousEvent.data } : { op: 'delete' })
```

---

## 9. Estructura en Google Drive

```
/Ecclesia/
├── ecclesia-oplog-{workspaceId}.bin
│   └── Documento Automerge binario (único archivo)
│       └── Contiene: ops[], snapshot?
│
├── ecclesia-blob-{workspaceId}-{checksum}.bin
│   └── Blobs binarios keyeados por checksum
│
└── ecclesia-state.json
    └── Archivo tiny con último sync timestamp y generation
        (para hasRemoteChanges sin descargar el oplog entero)
```

---

## 10. Migración desde el sistema actual

### 10.1 Fase 1: Coexistencia

1. El nuevo sistema se implementa como módulo independiente (`sync-oplog/`)
2. Ambos sistemas pueden convivir — el OpLog se construye desde la DB local
3. No se elimina el código de snapshot sync hasta validación completa

### 10.2 Fase 2: Bootstrap del OpLog

Cuando un usuario activa el nuevo sync:

```
function bootstrapOplog():
  // 1. Leer TODA la DB local para cada entidad
  allEntities = readAllEntitiesFromPrisma()

  // 2. Construir snapshot compactado
  snapshot = {}
  for each entityType, records in allEntities:
    snapshot[entityType] = {}
    for record in records:
      snapshot[entityType][record.id] = record

  // 3. Crear OpLog inicial
  oplog = automerge.from({
    schemaVersion: 1,
    workspaceId: currentWorkspaceId,
    createdAt: Date.now(),
    snapshot: {
      takenAt: Date.now(),
      takenFrom: [],  // bootstrap inicial, no hay eventos previos
      entities: snapshot
    },
    ops: []  // eventos futuros se appendearán aquí
  })

  // 4. Subir a Drive
  uploadToDrive('ecclesia-oplog-{ws}.bin', oplog)

  // 5. Reconstruir manifest de blobs en Drive
  uploadAllBlobsToDrive()
```

### 10.3 Fase 3: Corte

1. Una vez que todos los dispositivos migraron, se desactiva el snapshot sync
2. Se eliminan los archivos viejos de Drive (`ecclesia-snapshot-*`, `ecclesia-media-manifest-*`)
3. El nuevo sistema es el único mecanismo de sync

---

## 11. Comparativa con el sistema actual

| Aspecto | Snapshot + LWW (actual) | OpLog + Automerge (nuevo) |
|---------|------------------------|---------------------------|
| **Unidad de sync** | DB entera (snapshot JSON) | Evento individual |
| **Pérdida de datos** | Posible (snapshot pisa cambios) | Imposible (eventos inmutables, merge CRDT) |
| **Deletes** | Soft-delete (nunca se borra realmente) | Hard-delete (se replica como evento) |
| **Archivos** | Manifest separado + blob | Mismo OpLog (metadata), blob por checksum |
| **Conflictos** | Last-write-wins por updatedAt | CRDT merge automático |
| **Historial** | No existe | Completo (tipo `git log`) |
| **Auditabilidad** | Nula | Total (cada cambio tiene autor y timestamp) |
| **Complejidad** | Media-alta (muchos archivos, lógica ad-hoc) | Media (Automerge abstrae el CRDT) |
| **Arhivos en Drive** | Snapshot + media manifest + bible manifest | Un solo OpLog .bin + blobs |
| **Migración multi-PC** | Frágil (desincronización frecuente) | Robusta (convergencia garantizada) |

---

## 12. Resumen de archivos del nuevo sistema

```
apps/api/src/controllers/sync-oplog/
├── oplog.controller.ts        ← Endpoints Express (/api/sync-oplog/*)
├── oplog.service.ts           ← Orquestación (pull, push, syncCycle)
├── oplog.types.ts             ← Tipos (OplogEvent, OplogDocument, etc.)
├── oplog-replay.service.ts    ← Replay Engine (aplica eventos a DB + files)
├── oplog-blob.service.ts      ← Blob sync (download/upload/GC)
├── oplog-drive.service.ts     ← Google Drive operations (download/upload/ifGenerationMatch)
├── oplog-state.service.ts     ← Estado local (replay-state.json, etc.)
├── oplog-compaction.service.ts ← Compaction (squash de eventos)
└── oplog-migration.service.ts ← Bootstrap desde sistema actual
```

---

## 13. Integración con el stack existente

### 13.1 Desde los controllers actuales

Cada controller existente (songs, media, themes, etc.) DEBE llamar a
`oplogService.appendEvent()` después de cada mutación:

```typescript
class SongsService {
  async createSong(data) {
    const song = await prisma.song.create({ data })
    await oplogService.appendEvent({
      entityType: 'song',
      entityId: String(song.id),
      op: 'upsert',
      data: song,
    })
    return song
  }

  async deleteSong(id) {
    // Obtener data antes de borrar (para el checksum de lyrics files si existieran)
    await prisma.song.delete({ where: { id } })
    await oplogService.appendEvent({
      entityType: 'song',
      entityId: String(id),
      op: 'delete',
    })
  }
}
```

### 13.2 appendEvent: cómo funciona

```typescript
async function appendEvent(event: OplogEventInput) {
  // 1. Cargar OpLog local
  const doc = readLocalOplog()

  // 2. Appendeaar evento (Automerge change)
  let newDoc = automerge.change(doc, (d) => {
    d.ops.push({
      ...event,
      id: crypto.randomUUID(),
      seq: getNextSeq(),
      deviceId: currentDeviceId,
      timestamp: Date.now(),
    })
  })

  // 3. Persistir localmente
  writeLocalOplog(newDoc)

  // 4. Disparar push debounced (si el scheduler está activo)
  scheduleMicroPush()
}
```

### 13.3 Socket.IO / IPC Progress

El scheduler emite progreso vía Socket.IO (igual que ahora):

```
Evento 'syncProgress': { phase: 'pull'|'push'|'blob'|'gc', progress: 0-100, message }
```

---

## 14. Plan de implementación

### Fase 1: Core (1-2 semanas)
- [x] Diseño de arquitectura (este documento)
- [ ] Instalar `@automerge/automerge` y `@automerge/automerge-repo`
- [ ] Implementar `oplog.types.ts` con tipos de eventos
- [ ] Implementar `oplog-drive.service.ts` (download/upload con ifGenerationMatch)
- [ ] Implementar `oplog-replay.service.ts` (apply event → DB)
- [ ] Implementar `oplog.service.ts` (pull + push con optimistic lock)
- [ ] Tests unitarios del ciclo pull/push

### Fase 2: Blobs + File lifecycle (1 semana)
- [ ] Implementar `oplog-blob.service.ts` (download/upload/GC)
- [ ] Implementar sync de blobs en el ciclo (syncBlobs)
- [ ] Tests: create/delete/move de archivos

### Fase 3: Compaction + Migration (1 semana)
- [ ] Implementar `oplog-compaction.service.ts`
- [ ] Implementar `oplog-migration.service.ts` (bootstrap desde DB actual)
- [ ] Tests de compactación y migración

### Fase 4: Integración en controllers (1 semana)
- [ ] Agregar `appendEvent()` en songs, media, themes, schedules, etc.
- [ ] Reemplazar scheduler actual por el nuevo
- [ ] Pruebas de integración end-to-end

### Fase 5: Corte (días)
- [ ] Desactivar snapshot sync
- [ ] Eliminar archivos viejos de Drive
- [ ] Monitoreo post-migración
