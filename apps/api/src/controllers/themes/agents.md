# Themes Controller Agent

## Descripción
Controlador para la gestión de temas de presentación en Ecclesia.

## Responsabilidad
- CRUD de temas.
- Gestión de estilos y recursos asociados a temas.

## Ubicación
`database/controllers/themes/`

## Notas

- El modelo `Themes` incluye `backgroundBlur` (Int px, `0` = sin blur) para desenfocar fondos media (imagen/video).
- `exportThemeToZip` y `importThemeFromZip` persisten `backgroundBlur` (con fallback `?? 0`) dentro del `theme.json` del ZIP para que el desenfoque sobreviva exportación/importación de temas.
