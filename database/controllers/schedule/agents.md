# Schedule Controller Agent

## Descripción

Controlador para la gestión de cronogramas y sus items en Ecclesia.

## Responsabilidad

- CRUD de schedules (cronogramas).
- Gestión de items del cronograma (agregar, eliminar, actualizar).
- Sincronización con la UI y drag & drop.
- `updateSchedule` evita transacciones interactivas: hace soft-delete de items previos y creación de items nuevos en una sola mutación `schedule.update` con `items.updateMany` + `items.create` para reducir timeouts en SQLite.

## Ubicación

`database/controllers/schedule/`
