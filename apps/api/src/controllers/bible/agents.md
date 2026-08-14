# Bible Controller Agent

## Descripción
Controlador para la gestión de biblias, versiones y versículos en la aplicación Ecclesia.

## Responsabilidad
- CRUD de biblias y versiones.
- Búsqueda y consulta de versículos.
- Importación y gestión de archivos de biblias.

## Búsqueda de texto (`searchTextFragment`)

- Los `.ebbl` traen una columna `text_normalized` ya en minúsculas y **sin diacríticos** (`Jesús` → `jesus`, `niño` → `nino`, `vergüenza` → `verguenza`).
- La consulta del usuario DEBE normalizarse igual antes del `LIKE`, con `buildBibleSearchPattern()` de `bibleSearchText.ts`. Solo pasarla a minúsculas no basta: `jesús` nunca coincidiría con `jesus`.
- El patrón escapa los comodines `%` y `_`, por eso el SQL usa `LIKE ? ESCAPE '\'`.
- `book` es opcional: sin él la búsqueda cubre toda la Biblia. Se convierte con `Number(book)` porque `book_id` es INTEGER en el `.ebbl`.

## Ubicación
`database/controllers/bible/`
