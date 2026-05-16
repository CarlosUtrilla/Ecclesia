# Contexts & Hooks Agent

> **Agent router:** [`/agents.md`](../../agents.md)

## Descripcion

Providers de React y hooks compartidos que gestionan el estado global de la aplicacion. Incluye gestion de cronograma, pantallas en vivo, servidor de medios, displays y tamanos de pantalla.

## Jerarquia de Providers

```
MediaServerProvider          (top-level, sin dependencias)
  └── DisplaysProvider       (detecta pantallas, escucha IPC display-update)
        └── ScreenSizeProvider (calcula tamanos segun displays)
              └── Routes
                    └── ScheduleProvider   (solo en ruta "/")
                          ├── LiveProvider          (nested, sincroniza live screens)
                          └── DragAndDropSchedule   (nested, dnd-kit)
```

## Contexts

### MediaServerContext

**Archivo:** `app/contexts/MediaServerContext.tsx`
**Hook:** `useMediaServer()`

| Export | Tipo | Descripcion |
|--------|------|-------------|
| `port` | `number \| null` | Puerto del servidor HTTP local |
| `isReady` | `boolean` | Si el servidor esta listo |
| `buildMediaUrl(filePath)` | `(string) => string` | Construye URL completa para un archivo de medios |


### DisplaysContext

**Archivo:** `app/contexts/displayContext.tsx`
**Hook:** `useDisplays()`

| Export | Tipo | Descripcion |
|--------|------|-------------|
| `displays` | `DisplayWithUsage[]` | Pantallas configuradas con su rol |
| `mainDisplay` | `DisplayWithUsage \| null` | Pantalla principal del sistema |
| `refresh()` | `() => void` | Fuerza refetch de pantallas |


### ScreenSizeContext

**Archivo:** `app/contexts/ScreenSizeContext.tsx`
**Hook:** `useScreenSize(maxHeight, displayId?)`

| Export | Tipo | Descripcion |
|--------|------|-------------|
| `width` | `number` | Ancho calculado |
| `height` | `number` | Alto calculado |
| `aspectRatio` | `string` | Ratio como string CSS (ej: "16/9") |


### ScheduleContext

**Archivo:** `app/contexts/ScheduleContext/index.tsx`
**Hook:** `useSchedule()`

| Export | Tipo | Descripcion |
|--------|------|-------------|
| `currentSchedule` | `ScheduleItem[]` | Items del cronograma actual |
| `form` | `UseFormReturn` | React Hook Form para el schedule |
| `selectedTheme` | `ThemeWithMedia` | Tema activo para presentacion |
| `songs` | `SongResponseDTO[]` | Canciones cargadas |
| `media` | `Media[]` | Medios cargados |
| `itemsSortableIndex` | `string[]` | IDs para dnd-kit SortableContext |
| `isTemporary` | `boolean` | Si es sesion temporal (sin guardar) |
| `addItemToSchedule(item)` | `function` | Agrega item al cronograma |
| `deleteItemFromSchedule(index)` | `function` | Elimina item |
| `reorderItems(activeId, overId)` | `function` | Reordena items |
| `saveScheduleChanges()` | `function` | Guarda en base de datos |
| `loadSchedule(id)` | `function` | Carga un cronograma |
| `createTemporarySchedule()` | `function` | Crea sesion temporal |
| `getScheduleItemIcon(item)` | `function` | Retorna icono React del item |
| `getScheduleItemLabel(item)` | `async function` | Retorna label del item |
| `getScheduleItemContentScreen(item)` | `async function` | Retorna contenido para presentacion |

- Las variantes personalizadas de una misma familia se registran con el mismo `font-family` y metadata `font-weight`/`font-style` inferida desde el nombre de archivo, para que `bold`/`italic` use variantes reales cuando existen.

  La inferencia de peso/estilo se realiza desde `fileName` (no desde `name`) para mantener robustez aunque `name` se guarde como familia normalizada.
- `utils/indexDataItems.tsx` - Queries de React Query para songs/media/presentations, funciones de display
- `utils/LibraryItemPreview.tsx` - Componente de preview para drag overlay
- `utils/indexDataItems.tsx` incluye un cache reactivo local para recursos enviados directo a live (sin estar en schedule), evitando mutaciones in-place de arrays de React Query y garantizando que `items-on-live` hydrate título/icono/contenido correctamente.

**Tipos de items soportados:** BIBLE, SONG, MEDIA, PRESENTATION, GROUP

## Sistema de Chunks para Textos Bíblicos Largos

**Objetivo:** Dividir textos bíblicos largos en fragmentos (`chunks`) navegables para que se puedan mostrar gradualmente en pantalla sin sobrecargar la vista.

### Arquitectura de Chunks (BibleChunkWithMetadata)

Desde la migración (commits recientes), la arquitectura de chunks pasó de **parallel arrays** (`chunkParts: string[]` + `chunkVerses: number[]`) a **un solo array de objetos con metadata** (`chunks: BibleChunkWithMetadata[]`).

**Tipo actual:**
```typescript
type BibleChunkWithMetadata = {
  book: number      // ID del libro bíblico
  chapter: number   // Número de capítulo
  verse: number     // Número de verso al que pertenece el chunk
  content: string   // Contenido de texto del chunk
}
```

**Ventajas:**
- Metadata completa por chunk (no hay que sincronizar arrays paralelos)
- El verso del chunk siempre está disponible para badges, tooltips y navegación
- Más fácil de razonar y debuggear

### Flujo de Hidratación y Generación de Chunks

**1. Hidratación desde la Base de Datos**
En `utils/indexDataItems.tsx`, cuando se carga un item `BIBLE` o `PRESENTATION` con layers bíblicos:

```typescript
// Se obtienen los versículos desde la BD
const result = await window.api.bible.getVerses({
  book: bookId,
  chapter,
  verses: [1, 2, 3, ...],  // Array de versículos
  version: 'RVR1960'
})

// El texto se hidrata directamente desde la BD
const text = result.map((v) => v.text).join(' ')
// NO se agregan números de verso aquí - vienen del DB o no
```

**Formato del texto hidratado:**
- Puede venir con números de verso: `"1 texto verso 1... 2 texto verso 2..."`
- Puede venir sin números: `"texto completo sin marcadores"`
- Puede tener saltos de línea: `<br/>`, `\n`

**2. Detección de Versículos**
La función `splitBibleRangeIntoVerses()` detecta versículos por regex:

```typescript
// Soporta: "1 ", "1. ", "1.) "
const versePattern = /(\d+)\.?\)?\s+/g
```

**3. Generación de Chunks**
Función `attachPresentationBibleChunkParts()` en `app/lib/presentationSlides.ts`:

```typescript
// Para cada layer/slide bíblico:
const chunks = resolveChunkParts(
  layer.text,           // Texto hidratado
  maxChunkLength,       // 100/150/200/250 según setting
  bookId,
  chapter,
  verseStart,
  verseEnd
)

// Chunks se adjuntan al item
layer.chunks = chunks  // BibleChunkWithMetadata[]
```

**Cálculo de `maxChunkLength`:**
```typescript
// Lee setting del usuario
const splitMode = '100' | '150' | '200' | '250' | 'auto'

if (splitMode !== 'auto') {
  maxChunkLength = Number(splitMode)
} else {
  // Escala según tamaño de fuente del tema
  const fontSize = theme.fontSize || 72
  maxChunkLength = Math.round(180 * (72 / fontSize))
  // Bounded: Math.max(100, Math.min(250, scaled))
}
```

**4. Limpieza de HTML**
Antes de chunkear, se limpian `<br>` y `\n`:

```typescript
const cleanedText = sourceText
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/\n/g, ' ')
```

**Validación:** Si contiene HTML complejo (no solo `<br>`), se rechaza:
```typescript
if (/<(?!br\s*\/?>)[^>]+>/i.test(sourceText)) return undefined
```

**5. Split Inteligente**
`splitLongBibleVerse()` divide el texto respetando:
- Puntuación (`,`, `.`, `:`, `;`, `!`, `?`) dentro de ventana de ±24 chars
- Límites de palabra (espacios)
- Ellipsis de continuidad (`...` al inicio y final de chunks intermedios)

### Navegación por Chunks

**slideStepController:**
```typescript
{
  mode: 'chunk',        // Tipo de navegación
  current: 2,           // Chunk actual (1-indexed)
  start: 1,             // Primer chunk
  end: 8,               // Último chunk
  slideKey: 'mnv9...',  // Key única del slide
  layerId?: 'layer-1'   // ID del layer (si es PRESENTATION)
}
```

**presentationVerseBySlideKey:**
```typescript
{
  'mnv9o00s-5zz334785r': 2  // slideKey → chunk index (1-indexed)
}
```

**Navegación con flechas:**
En `items-on-live/index.tsx`:
```typescript
// Si hay chunks y no llegó al final
if (verseController.current < verseController.end) {
  setPresentationVerseBySlideKey(prev => ({
    ...prev,
    [verseController.slideKey]: verseController.current + 1
  }))
  return  // No cambiar de slide
}

// Si llegaste al final, avanzar slide
setItemIndex(itemIndex + 1)
```

### Render de Chunks

**En PresentationRender:**
```typescript
const chunkIndex = (slideStepController?.current ?? 1) - 1
const currentChunk = item.chunks?.[chunkIndex]

// Metadata del chunk
const chunkText = currentChunk?.content      // "...y se juntó todo el pueblo..."
const chunkVerse = currentChunk?.verse       // 1

// Badge muestra el verso del chunk actual
<Badge>{bookShortName} {chapter}:{chunkVerse}</Badge>
```

### Tooltips de Navegación

En `VerseRangeController.tsx`, los tooltips de prev/next muestran:

```typescript
// Chunk adyacente
const targetChunkIndex = targetStep - 1
const chunk = layer.chunks[targetChunkIndex]

// Tooltip con referencia + contenido
const verseReference = `${bookShortName} ${chapter}:${chunk.verse}`
const truncatedContent = trimPreviewText(chunk.content)
const tooltipText = `${verseReference}\n${truncatedContent}`
// Ejemplo: "Neh 8:2\ny Esdras el escriba trajo la ley..."
```

### Preview de Presentaciones con Chunks

**Archivo:** `app/screens/panels/library/presentations/components/PresentationPreview.tsx`

El preview de biblioteca ahora:

1. **Lee el setting de chunk size:**
```typescript
const { data: splitSettings } = useQuery({
  queryKey: ['bible-chunk-mode-setting'],
  queryFn: () => window.api.setttings.getSettings(['BIBLE_LIVE_CHUNK_MODE'])
})

const maxChunkLength = resolveBibleChunkMaxLength(splitMode, theme.fontSize)
```

2. **Hidrata textos bíblicos:**
```typescript
// Recopila referencias de todos los layers bíblicos
const bibleReferences = [...slides con layers BIBLE]

// Hidrata desde BD
const hydratedTexts = await Promise.all(
  bibleReferences.map(ref => window.api.bible.getVerses(...))
)
```

3. **Genera chunks:**
```typescript
const viewItemsWithChunks = presentation.slides.map(slide => {
  // Adjuntar texto hidratado a layers
  const hydratedLayers = layers.map(layer => ({ ...layer, text }))
  
  // Generar chunks
  const itemsWithChunks = attachPresentationBibleChunkParts(
    [viewItem],
    maxChunkLength
  )
  return itemsWithChunks[0]
})
```

4. **Muestra solo el primer chunk:**
```typescript
const presentationVerseBySlideKey = {
  [slideKey]: 1  // Forzar chunk 1 para todos los slides
}

<PresentationView
  presentationVerseBySlideKey={presentationVerseBySlideKey}
  currentIndex={slideIndex}
/>
```

**Resultado:** El preview muestra exactamente cómo se verá en pantalla (solo el primer fragmento), no el texto completo.

### Problemas Resueltos

1. ✅ **Verso siempre en 1:** El indicador mostraba verso 1 aunque navegaras → chunk metadata lo resuelve
2. ✅ **Texto no carga:** Faltaba hidratación desde BD → ahora se hidrata en `indexDataItems.tsx`
3. ✅ **Siempre chunk 0:** `slideStepController` no se pasaba correctamente → ahora se propaga
4. ✅ **Modo prioritario erróneo:** `getSlideVerseRange` priorizaba verse sobre chunk → ahora chunk primero
5. ✅ **HTML rechazado:** `<br>` y `\n` rechazados → ahora se limpian en vez de rechazar
6. ✅ **Formato "1.":** Regex no detectaba → actualizado para soportar "1 ", "1. ", "1.) "
7. ✅ **Números duplicados:** Se agregaban en hidratación → ahora usa texto de BD as-is
8. ✅ **maxChunkLength hardcoded:** Preview usaba 150 → ahora lee setting real del usuario
9. ✅ **Preview texto completo:** Mostraba todo el texto → ahora genera chunks y muestra chunk 1

### LiveContext

**Archivo:** `app/contexts/ScheduleContext/utils/liveContext.tsx`
**Hook:** `useLive()`

| Export | Tipo | Descripcion |
|--------|------|-------------|
| `itemIndex` | `number` | Indice del slide actual |
| `setItemIndex` | `function` | Cambia slide actual |
| `liveContentVersion` | `number` | Versión incremental del envío a live (cambia en cada `showItemOnLiveScreen`) |
| `appliedTheme` | `ThemeWithMedia` | Tema congelado que se aplicó al último envío live; no cambia al mover solo el selector |
| `itemOnLive` | `ScheduleItem \| null` | Item mostrandose en vivo |
| `liveScreens` | `DisplayWithUsage[]` | Pantallas en modo live |
| `stageScreens` | `DisplayWithUsage[]` | Pantallas en modo stage |
| `showLiveScreen` | `boolean` | Si hay pantalla live activa |
| `setShowLiveScreen` | `function` | Activa/desactiva pantalla live |
| `contentScreen` | `ContentScreen \| null` | Contenido actual del live |
| `showItemOnLiveScreen(item, index?)` | `async function` | Presenta item en pantallas |

- Abre/cierra ventanas de Electron en displays con rol `LIVE_SCREEN` y `STAGE_SCREEN` cuando se activa/desactiva `showLiveScreen`.
- **Reconciliación reactiva de pantallas**: Cuando cambia la cantidad o configuración de displays (por ejemplo, se agrega nueva pantalla stage durante live), el efecto principal detecta el cambio, cierra todas las ventanas actuales y reabre el nuevo conjunto. Esto permite que cambios en `SelectedScreens` se reflejen instantáneamente sin bajar de live.
- Envia contenido y tema via IPC: `updateLiveScreenContent`, `updateLiveScreenTheme`.
- `appliedTheme` se captura al ejecutar `showItemOnLiveScreen(item, index?)`, separando el tema actualmente aplicado en live del `selectedTheme` del selector de temas.
- Escucha `live-screen-ready` para saber cuando la ventana esta lista.
- Si hay item en vivo, `Escape` limpia el item (`setItemOnLive(null)`) y deja la pantalla live abierta mostrando fondo.
- Depende de `useSchedule()` y `useDisplays()`.
- `showItemOnLiveScreen` incrementa una versión (`liveContentVersion`) para que consumidores como `items-on-live` puedan refetchear contenido incluso al reenviar el mismo item.

### DragAndDropSchedule

**Archivo:** `app/contexts/ScheduleContext/utils/dragAndDropSchedule.tsx`

- Wrapper con dnd-kit `DndContext`.
- Soporta:
  - Reordenamiento de items dentro del cronograma
  - Arrastre desde biblioteca (songs, media, bible) al cronograma
  - Zonas de insercion con posicion especifica
- Usa `PointerWithin` como estrategia de colision.
- Muestra `LibraryItemPreview` como drag overlay para items de biblioteca.

## Hooks (app/hooks/)

### useThemes

**Archivo:** `app/hooks/useThemes.ts`

```typescript
const { themes, refetchThemes } = useThemes()
```

- React Query: `queryKey: ['themes']`
- Escucha IPC `theme-saved` -> refetch automatico
- Exporta `BlankTheme` (tema por defecto: fondo blanco, texto negro, Arial)
- `BlankTheme` replica campos obligatorios del modelo Prisma (`deletedAt: null`) para mantener compatibilidad de tipos en contexto y previews.

### useTagSongs

**Archivo:** `app/hooks/useTagSongs.tsx`

```typescript
const { tagSongs, refetch } = useTagSongs()
```

- React Query: `queryKey: ['tagSongs']`
- Escucha IPC `tags-saved` -> refetch automatico

### useBibleSchema

**Archivo:** `app/hooks/useBibleSchema.tsx`

```typescript
const { bibleSchema, getShortNameById, getCompleteNameById, getCompleteVerseText } = useBibleSchema()
```

- React Query: `queryKey: ['bibleSchema']`, `staleTime: Infinity` (se cachea permanentemente)
- Provee funciones utilitarias para buscar nombres de libros y formatear referencias
- La resolución de libros prioriza `book_id` (id canónico bíblico usado por schedule/live) con fallback a `id` de fila para compatibilidad, evitando referencias nulas al renderizar en cronograma y pantallas live/stage.

### useBibleVersions

**Archivo:** `app/hooks/useBibleVersions.ts`

```typescript
const { data: versions } = useBibleVersions()
```

- React Query: `queryKey: ['bibleVersions']`
- Retorna lista de biblias disponibles (archivos .ebbl importados)

### useDefaultBiblePresentationSettings

**Archivo:** `app/hooks/useDefaultBiblePresentationSettings.ts`

```typescript
const { defaultBiblePresentationSettings } = useDefaultBiblePresentationSettings()
```

- React Query para la configuracion global de presentacion de biblia (`isGlobal: true`)

### useScheduleGroupTemplates

**Archivo:** `app/hooks/useScheduleGroupTemplates.tsx`

```typescript
const { scheduleGroupTemplates, refetch } = useScheduleGroupTemplates()
```

- React Query: `queryKey: ['scheduleGroupTemplates']`
- Escucha IPC `schedule-group-templates-saved` -> refetch automatico

### usePresentations

**Archivo:** `app/hooks/usePresentations.ts`

```typescript
const { presentations, refetchPresentations } = usePresentations({ search })
```

- React Query: `queryKey: ['presentations', search]`
- Escucha IPC `presentation-saved` -> refetch automatico
- Se usa en la pestaña de biblioteca `Presentaciones`

### useKeyboardShortcuts

**Archivo:** `app/hooks/useKeyboardShortcuts.ts`

```typescript
const { handleItemClick } = useKeyboardShortcuts(containerRef, {
  onNavigate: (direction, extendSelection) => { ... },
  onDelete: () => { ... },
  onItemClick: (item, event) => { ... },
  onClickOutside: () => { ... }
})
```

- Maneja atajos de teclado dentro de un contenedor con ref.
- Soporta: Copy, Cut, Paste, Delete, SelectAll, Navigate (flechas), ClickOutside.
- Detecta Mac vs Windows para Cmd/Ctrl.
- Auto-configura `tabIndex` y estilos de outline en el contenedor.

### useCanvasWidgetTransform

**Archivo:** `app/hooks/useCanvasWidgetTransform.ts`

```typescript
const { startMove, startResize } = useCanvasWidgetTransform({
  canvasRef,
  minWidth: 8,
  minHeight: 6,
  snap: snapToGrid,
  onUpdateWidgetRect: (widgetId, nextRect) => { ... }
})
```

- Hook compartido para mover y redimensionar widgets rectangulares dentro de un canvas.
- Soporta handles de esquinas y bordes (`top-left`, `right`, `bottom`, etc.).
- Trabaja en coordenadas porcentuales y aplica clamp a limites del canvas.
- Permite configurar `snap` y tamanos minimos para reuso en editores visuales.

## Convenciones

- Todos los hooks de datos usan React Query con `queryKey` descriptivos.
- Los hooks que dependen de IPC events usan `useEffect` con `window.electron.ipcRenderer.on()` para escuchar cambios.
- Los contexts siguen el patron: `createContext` + `Provider component` + `useX() hook`.
- Los providers no deben tener logica de UI, solo estado y funciones.
- Los hooks de `app/hooks/` son independientes de los contexts (pueden usarse en cualquier componente).

## Agents relacionados

- APIs IPC consumidas -> `/database/agents.md` y `/electron/agents.md`
- Modelos de datos -> `/prisma/agents.md`
- UI que consume estos contexts -> `/app/screens/panels/schedule/agents.md`, `/app/screens/panels/library/agents.md`
