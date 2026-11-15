# Plan: oplog sin Automerge

Rama: `exp/oplog-sin-automerge`. Contexto y mediciones: rama `exp/medicion-ram`,
`docs/experimentos/medicion-ram.md`.

## Por qué

- `Automerge.load()` del oplog (2,9 MB, 12 670 ops) deja el proceso main en
  **~1,3 GB de footprint** que nunca se libera (memoria WASM). Es el mayor
  consumo de RAM de la app, por encima de todas las ventanas juntas.
- `load`/`save`/`merge`/`clone` son síncronos: ~2,9 s bloqueando main en `init()`
  (ya documentado en `apps/api/src/controllers/sync-oplog/AGENTS.md`).
- El sync no usa nada propio de un CRDT de texto. Solo necesita unir listas de ops,
  rellenar campos de ops existentes y podar ops (ver tabla en `medicion-ram.md`).

Objetivo: misma semántica de sync, con el oplog como JSON plano en memoria
(estimado: decenas de MB) y merge propio, determinista y testeable.

## Diseño

### Formato v2

```ts
interface OplogFileV2 {
  format: 'ecclesia-oplog'
  version: 2
  schemaHash: string
  createdAt: number
  ops: OplogEvent[]                     // sin cambios en OplogEvent
  tombstones: Record<string, number>    // opId → timestamp de poda
}
```

- Local: `sync/oplog-v2.json.gz` (gzip; JSON del oplog actual ≈ 12 MB → ~1–2 MB).
- Drive: **archivo nuevo** `ecclesia-oplog-v2.json.gz`. El viejo
  `ecclesia-oplog.bin` no se toca: una versión antigua de la app nunca lee ni pisa
  el formato nuevo (y viceversa).
- `oplog.bin` local se conserva tras migrar (renombrado a `oplog.v1.bak.bin`) para
  poder volver atrás.

### Merge propio (`oplog-merge.ts`, módulo puro sin Prisma ni Drive)

`mergeOplogs(local, remote): { merged, newOps }`

1. `tombstones` = unión; si un id está en ambos, gana el timestamp menor.
2. Ops = unión por `op.id`, excluyendo ids con tombstone.
3. Op presente en ambos lados → merge campo a campo de los campos "rellenables"
   (`checksum`, `thumbnailChecksum`, `fallbackChecksum`, `blobPath`,
   `thumbnailBlobPath`, `fallbackBlobPath`, `blobSize`, `blobMimeType`,
   `data.thumbnail`, `data.fallback`): gana el valor no vacío; si ambos tienen
   valor y difieren, gana el remoto (regla fija y determinista; hoy Automerge
   elige por actor id, igual de arbitrario). El resto de campos son inmutables.
4. Orden canónico: `(timestamp, deviceId, seq)`. Ambos dispositivos producen el
   mismo array tras el merge.
5. `newOps` = ops del resultado cuyo id no estaba en local.

Propiedades a cubrir con tests: conmutativo, asociativo, idempotente, y una op
podada no resucita desde el otro lado.

### Detección de cambios sin subir

Sustituye `getHeads`/`lastPushedHeads`: `lastPushedHash` = sha256 del
JSON canónico (o, más barato, `ops.length + tombstones.length + max(seq)` por
dispositivo + contador de mutaciones locales). Recomendación: hash; el coste de
hashear 12 MB es ~30 ms.

### Estado de replay (arreglo de paso)

Hoy `replayState.lastAppliedIndex` es un **índice** en `ops`. Con Automerge ya es
frágil (el merge puede insertar ops remotos en medio); con orden canónico por
timestamp también lo sería. Se sustituye por `appliedSeqByDevice:
Record<deviceId, number>` y se aplica toda op con `seq` mayor que el máximo
aplicado de su dispositivo. Requiere que `seq` sea monótono por dispositivo (lo
es: `currentSeq` en `oplog.service.ts`).

## Fases

### Fase 1 — Capa de almacenamiento (sin cambiar comportamiento)

- `oplog-store.ts`: clase `OplogStore` que encapsula el doc con la API que hoy usa
  `oplog.service.ts`: `append(op)`, `updateOps(indices|ids, patch)`,
  `removeOps(predicate)`, `ops`, `serialize()`, `hash()`.
- Primera implementación **sobre Automerge** para refactorizar `oplog.service.ts`
  (≈20 llamadas a `change/save/load/clone/merge/getHeads`) sin cambiar el formato.
  Verificar sync real entre dos equipos antes de seguir.
- Archivos tocados: `oplog.service.ts`, `oplog-state.service.ts`,
  `oplog-migration.service.ts`, `oplog-compaction.service.ts` (sin uso; borrar o
  dejar fuera del store).

### Fase 2 — Implementación JSON + merge

- `oplog-merge.ts` + tests de propiedades (aquí sí se blinda: es lógica de datos
  entre equipos).
- `OplogStore` JSON: `ops` array + `Map<id, index>` + `tombstones`.
- `prune-deleted-media` → `removeOps` añade tombstones.
- `replayState` → `appliedSeqByDevice`.
- Persistencia: `schedulePersist`/`drainPersist` siguen igual, serializando JSON gzip.
- Opcional: serializar/gzip en `worker_threads` si sigue bloqueando.

### Fase 3 — Migración v1 → v2

En `init()`:

1. Si existe `oplog-v2.json.gz` → cargar y listo.
2. Si no, y existe `oplog.bin` → `Automerge.load` + `toJS` **una sola vez**,
   escribir v2, renombrar v1 a `.bak`. Calcular `appliedSeqByDevice` desde
   `lastAppliedIndex` actual.
3. Drive: si no existe `ecclesia-oplog-v2.json.gz` pero sí el v1 → descargar v1,
   convertir, mergear con local y subir como v2 (con `ifGenerationMatch` para que
   dos equipos migrando a la vez no se pisen: el segundo recibe 412, hace pull del
   v2 y mergea).
4. Tras migrar, Automerge solo se importa con `import()` dinámico dentro de la
   migración, para que el WASM no se cargue en arranques normales.

Riesgo de convivencia: un equipo sin actualizar sigue sincronizando contra el v1 y
deja de ver los cambios de los equipos migrados. Mitigación: al migrar, escribir
en Drive un marcador (`ecclesia-oplog-migrated.json`, o una propiedad en el v1) y
mostrar en versiones nuevas un aviso si detectan actividad reciente en el v1. Las
versiones viejas no pueden avisar, así que **el release debe indicar actualizar
todos los equipos**.

### Fase 4 — Medición y limpieza

- Repetir `ECCLESIA_MEM_PROBE` + `vmmap` del proceso main (objetivo: < 200 MB de
  footprint tras arranque; hoy 1,3 GB) y el tiempo de `init()` (hoy ~2,9 s).
- Quitar `@automerge/automerge` de `apps/api/package.json` cuando la migración v1
  lleve un par de releases (o mantenerlo solo para el import dinámico).
- Actualizar `sync-oplog/AGENTS.md` (secciones "Coste de cada ciclo" y
  "Flujo de sync").

## Verificación manual (dos equipos)

1. Ambos en v1 sincronizados → actualizar A → A migra y sube v2.
2. Actualizar B → B detecta v2 en Drive, migra su v1 local, mergea, sin duplicados.
3. Cambios concurrentes en A y B (canción nueva en cada uno, editar la misma) →
   ambos convergen al mismo `hash()`.
4. Borrar media en A → poda en A → B no resucita la op.
5. Equipo virgen → descarga v2 y replica la DB.

## Decisiones abiertas

- Regla de conflicto para campos rellenables con valores distintos (propuesta:
  remoto gana).
- Hash vs. contador para "cambios sin subir" (propuesta: hash).
- ¿Borrar `oplog-compaction.service.ts` (sin uso) en la fase 1?
