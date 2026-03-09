# Prisma / Database Schema Agent

> **Agent router:** [`/agents.md`](../agents.md)

## Descripcion

Este modulo define el schema completo de la base de datos SQLite usando Prisma ORM. Todos los modelos, relaciones, enums y migraciones se gestionan aqui.

## Archivos

```text
prisma/
├── schema.prisma    # Definicion de modelos y relaciones
├── dev.db           # Base de datos SQLite (desarrollo)
├── seed.ts          # Script de seed inicial
└── migrations/
    └── 20260309000000_beta_v1_baseline/   # Migración única (baseline consolidada para beta)
        └── migration.sql
```

## Modelos

### Song (Canciones)

```prisma
model Song {
  id        Int      @id @default(autoincrement())
  title     String
  author    String?
  copyright String?
  fullText  String   @default("")  // Busqueda full-text (contenido de letras concatenado)
  lyrics    Lyrics[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- `fullText` se genera concatenando el contenido de todas las `Lyrics` asociadas. Se usa para busqueda rapida sin JOINs.
- Una cancion tiene multiples estrofas (`Lyrics`), cada una opcionalmente asociada a un `TagSongs`.

### Lyrics (Estrofas)

```prisma
model Lyrics {
  id         Int       @id @default(autoincrement())
  content    String                              // Contenido HTML de la estrofa
  tagSongs   TagSongs? @relation(...)            // Tag opcional (Verso, Coro, etc.)
  tagSongsId Int?
  song       Song      @relation(...)
  songId     Int
}
```

- El `content` puede contener HTML basico (negrita, cursiva) del editor TipTap.

```prisma
model TagSongs {
  id        Int    @id @default(autoincrement())
  name      String @unique          // "Verso", "Coro", "Puente"
  shortName String @unique          // "V", "C", "P"
  shortCut  String @unique          // Atajo de teclado
  color     String                  // Color HEX
  lyrics    Lyrics[]
}
```

- Se usan para categorizar estrofas visualmente con colores en la UI.
- `shortName` se muestra en el lateral de la vista de letras.

### Themes (Temas de presentacion)

```prisma
model Themes {
  id                          Int     @id @default(autoincrement())
  name                        String  @unique
  background                  String  // Color HEX, gradient CSS, o "media" si usa backgroundMedia
  backgroundMediaId           Int?
  backgroundMedia             Media?  @relation(...)
  textStyle                   String  // JSON: { fontSize, fontFamily, fontWeight, color, textAlign, ... }
  animationSettings           String  // JSON: { type, duration, delay, easing }
  transitionSettings          String  // JSON: transición al cambiar de tema (default fade)
  previewImage                String  // Imagen de preview del tema
  useDefaultBibleSettings     Boolean @default(true)
  biblePresentationSettingsId Int?
  biblePresentationSettings   BiblePresentationSettings? @relation(...)
}
```

- `background` tiene 3 modos: color HEX directo, gradient CSS, o el string literal `"media"` que indica usar `backgroundMedia`.
- `textStyle` es un JSON string con propiedades CSS para el texto.
- `animationSettings` es un JSON con config de animación de contenido.
- `transitionSettings` es un JSON con config de transición de tema (se ejecuta solo cuando cambia de tema).

### Media (Medios)

```prisma
model Media {
  id        Int       @id @default(autoincrement())
  name      String
  type      MediaType                // IMAGE | VIDEO
  format    String                   // webp, png, jpg, mp4, webm, etc.
  filePath  String    @unique        // Ruta relativa al directorio de datos
  fileSize  Int                      // Bytes
  width     Int?
  height    Int?
  duration  Float?                   // Solo videos, en segundos
  thumbnail String?                  // Ruta a miniatura generada
  fallback  String?                  // Frame inicial para videos
  folder    String?                  // Carpeta organizativa ("Navidad/2025" o null = raiz)
  themesUsingAsBackground Themes[]   // Temas que usan este medio como fondo
}
```

- Los archivos se almacenan en el directorio de datos de la app, no en la DB.
- `thumbnail` se genera automaticamente al importar (frame en segundo 1.5 para videos).
- `folder` permite organizar medios en carpetas virtuales.

### Presentation (Presentaciones)

```prisma
model Presentation {
  id        Int      @id @default(autoincrement())
  title     String
  slides    String   @default("[]") // JSON serializado de diapositivas (soporta slides con items mixtos)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- `slides` almacena la estructura de diapositivas como JSON serializado.
- Cada slide puede incluir `items[]` mixtos (schedule-like) para capas, animación por item y composición libre.
- El recurso se consume como item único `PRESENTATION` dentro del cronograma.

### BibleSchema y BibleVerses

```prisma
model BibleSchema {
  id         Int           @id @default(autoincrement())
  book       String                    // "Genesis", "Exodo", etc.
  book_id    Int                       // ID numerico del libro (1-66)
  book_short String                    // "Gn", "Ex", etc.
  testament  TestamentEnum             // Old | New
  chapter    BibleVerses[]
}

model BibleVerses {
  id            Int  @id @default(autoincrement())
  chapter       Int                    // Numero de capitulo
  verses        Int                    // Cantidad de versiculos en ese capitulo
  bibleSchemaId Int?
}
```

- `BibleSchema` almacena la estructura de libros, no el contenido.
- El contenido de versiculos se almacena en archivos `.ebbl` separados (SQLite independientes por version) en `/resources/bibles/`.
- Cada version de la Biblia (RVR1960, TLA) tiene su propia base de datos SQLite.

### BiblePresentationSettings

```prisma
model BiblePresentationSettings {
  id              Int                      @id @default(autoincrement())
  description     BibleDescriptionMode     @default(complete)    // short | complete
  position        BibleDescriptionPosition @default(underText)   // beforeText | afterText | underText | overText | upScreen | downScreen
  showVersion     Boolean  @default(true)
  showVerseNumber Boolean  @default(false)
  isGlobal        Boolean  @default(false)     // true = config global por defecto
  positionStyle   Float?                       // Offset en px para posiciones upScreen/downScreen
  defaultTheme    Int?
  themes          Themes[]
}
```

- Controla como se muestra la referencia biblica en la presentacion.
- `isGlobal: true` marca la configuracion por defecto que se usa si un tema no tiene la suya propia.

### Schedule y ScheduleItem

```prisma
model Schedule {
  id       Int            @id @default(autoincrement())
  title    String
  dateFrom DateTime?
  dateTo   DateTime?
  items    ScheduleItem[]
}

model ScheduleItem {
  id         String           @unique        // UUID generado en frontend
  order      Int                             // Orden global dentro del schedule
  type       ScheduleItemType                // BIBLE | SONG | MEDIA | PRESENTATION | GROUP
  accessData String                          // ID del recurso como string
  scheduleId Int
  schedule   Schedule @relation(...)
}
```

- `ScheduleItem.id` es un UUID (no autoincrement) generado en el frontend.
- `accessData` almacena el identificador del recurso segun el tipo:
  - SONG: `"123"` (id de Song)
  - BIBLE: `"1,3,16,RVR1960"` (bookId,chapter,verse,version)
  - MEDIA: `"45"` (id de Media)
  - GROUP: `"7"` (id de ScheduleGroupTemplate)
- `order` es global dentro del schedule (no por grupo).
- Los items de tipo GROUP actuan como cabeceras visuales en el cronograma.

### ScheduleGroupTemplate

```prisma
model ScheduleGroupTemplate {
  id    Int    @id @default(autoincrement())
  name  String                  // "Alabanza", "Predicacion", etc.
  color String                  // Color HEX del grupo
}
```

- Son plantillas reutilizables para agrupar items en el cronograma.
- El color se muestra como fondo de la cabecera del grupo.

### SelectedScreens

```prisma
model SelectedScreens {
  id         Int        @id @default(autoincrement())
  screenId   Int        @unique       // ID del display de Electron
  screenName String
  rol        ScreenRol?               // LIVE_SCREEN | STAGE_SCREEN | null
  stageConfig StageScreenConfig?
}
```

- Guarda la configuracion de pantallas conectadas.
- `LIVE_SCREEN` = pantalla de proyeccion publica.
- `STAGE_SCREEN` = pantalla para musicos/predicador.

### StageScreenConfig

```prisma
model StageScreenConfig {
  id               Int             @id @default(autoincrement())
  selectedScreenId Int             @unique
  selectedScreen   SelectedScreens @relation(...)
  themeId          Int?
  theme            Themes?         @relation("StageScreenTheme", ...)
  layout           String          // JSON del layout editable de widgets stage
  state            String          // JSON de estado operativo (mensaje persistente y timers múltiples)
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
}
```

- Modelo dedicado para configuración altamente customizable de cada pantalla stage.
- Se relaciona 1:1 con `SelectedScreens` para separar infraestructura de display vs configuración stage.

### Setting

```prisma
model Setting {
  id    Int            @id @default(autoincrement())
  key   SettingOptions @unique
  value String                    // JSON string
}

### SyncState / SyncOutboxChange / SyncInboxChange (Fase 1 sync diferencial)

```prisma
enum SyncOperation {
  CREATE
  UPDATE
  DELETE
}

model SyncState {
  id                Int      @id @default(autoincrement())
  workspaceId       String
  deviceId          String
  lastPulledAt      DateTime?
  lastPushedAt      DateTime?
  lastAckedChangeId Int?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([workspaceId, deviceId])
}

model SyncOutboxChange {
  id              Int           @id @default(autoincrement())
  workspaceId     String
  deviceId        String
  tableName       String
  recordId        String
  operation       SyncOperation
  payload         String
  entityUpdatedAt DateTime?
  deletedAt       DateTime?
  ackedAt         DateTime?
  createdAt       DateTime      @default(now())
}

model SyncInboxChange {
  id              Int           @id @default(autoincrement())
  workspaceId     String
  sourceDeviceId  String
  remoteChangeId  String
  tableName       String
  recordId        String
  operation       SyncOperation
  payload         String
  entityUpdatedAt DateTime?
  deletedAt       DateTime?
  appliedAt       DateTime?
  createdAt       DateTime      @default(now())

  @@unique([workspaceId, sourceDeviceId, remoteChangeId])
}
```

- `SyncState` guarda checkpoint por `workspaceId + deviceId`.
- `SyncOutboxChange` registra cambios locales pendientes por entidad para empuje incremental.
- `SyncInboxChange` recibe cambios remotos deduplicados antes de aplicar merge.

### Regla de sincronización aplicada (9-Mar-2026)

- Todos los modelos de la base Prisma cuentan con `updatedAt` para soportar reconciliación completa y evitar pérdida de datos por cambios concurrentes entre dispositivos.
- En modelos que no lo tenían (`Font`, `BibleSchema`, `BibleVerses`, `BiblePresentationSettings`, `Schedule`, `ScheduleGroupTemplate`, `ScheduleItem`, `SelectedScreens`, `SyncOutboxChange`, `SyncInboxChange`) se añadió `updatedAt` con `@default(now()) @updatedAt`.

- Almacena configuraciones globales de la aplicacion como pares clave-valor.

## Enums

| Enum | Valores | Uso |
| ---- | ------- | --- |
| `MediaType` | IMAGE, VIDEO | Tipo de medio |
| `TestamentEnum` | Old, New | Antiguo/Nuevo Testamento |
| `BibleDescriptionMode` | short, complete | Nombre corto/completo del libro |
| `BibleDescriptionPosition` | beforeText, afterText, underText, overText, upScreen, downScreen | Posicion de referencia biblica |
| `ScheduleItemType` | BIBLE, SONG, MEDIA, PRESENTATION, GROUP | Tipo de item en cronograma |
| `ScreenRol` | LIVE_SCREEN, STAGE_SCREEN | Rol de pantalla conectada |
| `SettingOptions` | SALES_DAILY, SALES_MONTHLY, LOGO_FALLBACK_MEDIA_ID, LOGO_FALLBACK_COLOR | Claves de configuracion |

## Convenciones

- IDs son `Int @id @default(autoincrement())` excepto `ScheduleItem` que usa `String @unique` (UUID).
- Todos los modelos con timestamps usan `createdAt DateTime @default(now())` y `updatedAt DateTime @updatedAt`.
- Los campos JSON se almacenan como `String` y se parsean en el frontend/service.
- `@unique` se usa en campos que necesitan ser buscados directamente (filePath, name de tema, etc.).
- Las relaciones opcionales usan `?` tanto en el campo FK como en la relacion.
- `Presentation` no modela tablas hijas en MVP; la estructura interna se serializa en `slides` para iterar rápido en editor/biblioteca.
- Stage también usa serialización JSON para evolucionar rápido en MVP: `layout` (widgets) y `state` (mensaje persistente y múltiples timers).

## Migraciones

- Hay 46 migraciones desde `20260105` hasta `20260307`.
- Para crear una nueva migracion: `npx prisma migrate dev --name nombre_descriptivo`
- Para aplicar migraciones pendientes: `npx prisma migrate deploy`
- El sistema tiene migracion automatica con backup en produccion (ver `/electron/agents.md`).

## Agents relacionados

- Cambios en modelos -> actualizar tambien `/database/agents.md` (controllers/services afectados)
- Cambios en BibleSchema -> revisar `/electron/agents.md` (bibleManager)
- Cambios en Media -> revisar `/electron/agents.md` (mediaManager)
- Cambios en Schedule/ScheduleItem -> revisar `/app/contexts/agents.md` (ScheduleContext)
- Cambios en Themes -> revisar `/app/screens/editors/agents.md` (ThemesEditor)
