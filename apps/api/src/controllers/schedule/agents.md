# Schedule Controller Agent

## Descripción

Controlador para la gestión de cronogramas y sus items en Ecclesia.

## Responsabilidad

- CRUD de schedules (cronogramas).
- Gestión de items del cronograma (agregar, eliminar, actualizar).
- Sincronización con la UI y drag & drop.
- `updateSchedule`, `createNewSchedule` y `addItemToSchedule` usan **operaciones top-level** (`scheduleItem.updateMany`, `scheduleItem.createMany`, `scheduleItem.create`) en vez de nested writes dentro de `schedule.update`/`schedule.create`. Esto es **crítico** para el sync: las extensiones de Prisma (`$allOperations`) NO capturan operaciones anidadas, así que los nested writes generaban cero eventos en el oplog y los items no se sincronizaban entre PCs.

## Ubicación

`database/controllers/schedule/`
