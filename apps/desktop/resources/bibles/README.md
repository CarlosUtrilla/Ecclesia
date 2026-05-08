# Biblias Precargadas

Esta carpeta contiene las biblias que se incluirán por defecto en la aplicación.

## Formato de archivos

Los archivos de biblia deben tener extensión `.ebbl` (que internamente son bases de datos SQLite).

### Estructura de la base de datos

Cada archivo `.ebbl` debe contener las siguientes tablas:

```sql
-- Información de la biblia
CREATE TABLE bible_info (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,           -- Ej: "Reina Valera 1960"
  abbreviation TEXT NOT NULL,   -- Ej: "RVR1960"
  language TEXT NOT NULL        -- Ej: "es"
);

-- Libros
CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,           -- Ej: "Génesis"
  abbreviation TEXT NOT NULL,   -- Ej: "Gn"
  testament TEXT NOT NULL,      -- "OT" o "NT"
  order_number INTEGER NOT NULL -- Orden del libro (1-66)
);

-- Versículos
CREATE TABLE verses (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  text TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_verses_book_chapter ON verses(book_id, chapter);
CREATE INDEX idx_verses_location ON verses(book_id, chapter, verse);
```

## Archivos incluidos

Coloca aquí los archivos `.ebbl` de las biblias por defecto.

### Ejemplo de biblias disponibles

- `reina-valera-1960.ebbl` - Reina Valera 1960 (Español)
- `nueva-version-internacional.ebbl` - NVI (Español)
