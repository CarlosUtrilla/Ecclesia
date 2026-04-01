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
- En `utils/indexDataItems.tsx`, el contenido `PRESENTATION` mantiene cada diapositiva bíblica como unidad única en runtime (sin expandir en múltiples slides) y adjunta `chunkParts` cuando el texto bíblico largo llega en bloque; antes de chunkear, se limpia numeración incrustada al inicio del texto (`23`, `23.`, `23...`) para evitar duplicados con el prefijo visual del verso.

- `utils/indexDataItems.tsx` incluye un cache reactivo local para recursos enviados directo a live (sin estar en schedule), evitando mutaciones in-place de arrays de React Query y garantizando que `items-on-live` hydrate título/icono/contenido correctamente.

**Tipos de items soportados:** BIBLE, SONG, MEDIA, PRESENTATION, GROUP

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
