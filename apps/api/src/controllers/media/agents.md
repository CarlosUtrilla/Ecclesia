# Media Controller Agent

## Descripción
Controlador para la gestión de archivos de medios (imágenes, videos, etc.) en Ecclesia.

## Responsabilidad
- CRUD de archivos de medios.
- Gestión de rutas y metadatos de archivos.
- Integración con el MediaServer de Electron.
- **Verificación de integridad**: `verifyFiles()` revisa todos los registros activos de Media y confirma que `filePath`, `thumbnail` y `fallback` existan realmente en disco. Retorna un resumen con conteos de archivos presentes/faltantes y detalle por registro.
- **Limpieza de archivos huérfanos**: `cleanupOrphans()` escanea `media/files/` y `media/thumbnails/`, compara contra todos los registros de la DB (incluyendo soft-delete), y elimina:
  - Archivos en disco sin registro en DB (huérfanos)
  - Archivos en disco cuyo registro DB tiene `deletedAt != null`
  - Thumbnails/fallbacks sin referencia en ningún registro
  - Retorna resumen con conteos y bytes liberados.

## Ubicación
`database/controllers/media/`
