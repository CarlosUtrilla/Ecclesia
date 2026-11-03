# Settings Controller Agent

## Descripción
Controlador para la gestión de configuraciones globales de la aplicación.

## Responsabilidad
- CRUD de settings.
- Persistencia y recuperación de preferencias de usuario y sistema.

## Ubicación
`database/controllers/settings/`

## Sincronización entre computadoras (REGLA)

Los settings se escriben con SQL crudo (`$executeRaw`) porque `key` es un enum incompleto. Ese camino **no pasa por el middleware del oplog**: todo servicio que escriba en `Setting` debe registrar después el evento a mano con `oplogService.appendEvent({ entityType: 'setting', op: 'upsert', data: { id, key, value } })`. Lo hacen `SettingsService.updateSetting` y `AIService.saveRawSetting` (API keys, modelo y proveedor de IA); la IA no lo hacía y sus keys no llegaban a otras computadoras.

- El replay identifica los settings por `key` (no por `id`), así que un `DELETE` no se propaga. Para "borrar" un valor sincronizado, guardarlo vacío y tratar el vacío como ausencia (como hace la API key de IA).
