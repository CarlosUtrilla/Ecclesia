# Library (Songs / Media / Bible) Agent

> **Agent router:** [`/agents.md`](../../../../agents.md)

## Descripcion

Panel de biblioteca que ocupa la parte inferior de la aplicacion. Contiene cuatro secciones en tabs: Canciones, Medios, Biblia y Presentaciones. Permite buscar, explorar y arrastrar recursos al cronograma.
En el extremo derecho del header de tabs incluye un botón `Ajustes` que abre la ventana de configuración.
Al lado de `Ajustes` incluye acceso rápido a `Control Stage` para abrir la ventana operativa de stage sin salir del flujo principal.
Cuando hay una operación activa de sync con Google Drive, muestra la etiqueta `Sincronizando X%` junto al botón (fallback `Sincronizando...` mientras inicializa el progreso).
La visibilidad del botón `Sync` se refresca automáticamente al recuperar foco en la ventana principal (al volver de `Ajustes`) y al finalizar eventos `sync-state`, para reflejar conexiones nuevas sin reiniciar la app.

## Archivos

```text
app/screens/panels/library/
├── index.tsx                  # LibraryPanel: tabs de Songs/Media/Bible/Presentations
├── songs/
│   ├── index.tsx              # SongsPanel: lista de canciones con busqueda
│   ├── songItem.tsx           # SongItem: un item de cancion (draggable)
│   ├── previewSong.tsx        # PreviewSong: preview lateral de cancion seleccionada
│   ├── songImporter.tsx       # SongImporter: dialog de importación de canciones (Holyrics/OpenLP)
│   └── TagPreviewDialog.tsx   # TagPreviewDialog: dialog para crear etiquetas faltantes antes de importar
├── media/
│   ├── index.tsx              # MediaLibrary: gestion completa de medios (514 lineas)
│   ├── MediaGrid.tsx          # Grilla de medios (cards)
│   ├── MediaGridWrapper.tsx   # Wrapper con context menu y drag/drop zone
│   ├── MediaList.tsx          # Vista de lista de medios
│   ├── MediaCard.tsx          # Card de un medio (imagen/video, draggable)
│   ├── FolderCard.tsx         # Card de carpeta (draggable, drop target)
│   ├── MediaPicker.tsx        # Dialog para seleccionar un medio (usado en ThemesEditor)
│   ├── NewFolderDialog.tsx    # Dialog para crear carpeta
│   ├── RenameDialog.tsx       # Dialog para renombrar
│   ├── types.ts               # Tipos: Media, MediaType
│   ├── utils.ts               # Utilidades: formatFileSize
│   ├── exports.ts             # Re-exports publicos del modulo
│   └── hooks/
│       ├── useClipboard.ts    # Copiar/cortar/pegar medios
│       ├── useDragAndDrop.ts  # Drag & drop entre carpetas
│       ├── useMediaOperations.ts  # CRUD de medios (importar, eliminar, renombrar)
│       └── useSelection.ts    # Seleccion multiple con Shift/Ctrl
└── bible/
    ├── index.tsx              # BiblePanel: selector de libro/capitulo + vista de versiculos
    ├── bibleVersions.tsx      # Selector de version de biblia
    ├── importBible.tsx        # Boton para importar archivo .ebbl
    ├── textFragmentSearch.tsx # Busqueda de texto en versiculos
    ├── groupSearchResultsByBook.ts # Aplana los resultados en filas cabecera-de-libro + versiculo
    ├── verseSearch.tsx        # Busqueda rapida: Libro Cap. Vers.
    └── viewVerses.tsx         # Lista de versiculos con seleccion multiple y drag
└── presentations/
    ├── index.tsx              # PresentationsPanel: composición principal (búsqueda + lista + preview)
    └── components/
        ├── PresentationLibraryItem.tsx  # Item draggable/context menu de presentación
        └── PresentationPreview.tsx      # Preview lateral de diapositivas de presentación
```

## Songs (Canciones)

### SongsPanel (`songs/index.tsx`)

- Lista de canciones con busqueda por titulo/autor.
- Usa React Query (`queryKey: ['songs']`) con scroll infinito.
- Cada cancion es un `SongItem` draggable (dnd-kit `useDraggable`).
- Al hacer click selecciona, doble-click agrega al cronograma.
- Boton para crear nueva cancion (abre ventana via `window.windowAPI.openSongWindow()`).

### SongItem (`songs/songItem.tsx`)

- Draggable con `data: { type: 'SONG', accessData: song.id }`.
- Context menu: Editar, Agregar al cronograma, Presentar en vivo, Eliminar.
- Usa `useSchedule()` para `addItemToSchedule` y `useLive()` para `showItemOnLiveScreen`.

### PreviewSong (`songs/previewSong.tsx`)

- Muestra vista previa de letras de la cancion seleccionada.
- Usa `RenderSongLyricList` para mostrar las estrofas con tags de color.
- Resetea `selectedIndex` a 0 cuando cambia la cancion (patron render-time reset con ref).

### SongImporter (`songs/songImporter.tsx`)

- Dialog de importación de canciones desde Holyrics (JSON) o OpenLP (XML).
- Flujo: seleccionar app → elegir archivos → click Importar.
- Antes de importar, llama a `previewMissingTags` para detectar etiquetas de verso que no existen aún en la BD.
- Si hay etiquetas faltantes, abre `TagPreviewDialog` para que el usuario revise/edite/elimine las etiquetas antes de crearlas.
- Una vez confirmadas las etiquetas, las crea via `Api.fetch.tagSongs.createTagSongs` y luego ejecuta `importSongsFromFile`.

### TagPreviewDialog (`songs/TagPreviewDialog.tsx`)

- Dialog que muestra etiquetas faltantes antes de importar canciones.
- Cada etiqueta es editable: nombre (Input) + color (ColorPicker).
- Permite eliminar etiquadas individuales con botón de basura.
- Botón "Crear (N) e importar" confirma y dispara la creación + importación.
- Se cierra sin crear nada si el usuario cancela.

## Media (Medios)

### MediaLibrary (`media/index.tsx`)

- Componente principal de gestion de medios (514 lineas).
- **Header unificado (2 filas):**
  - Fila 1: Botón "Atrás" (visible en subcarpetas) + navegación breadcrumb con scroll horizontal (oculta scrollbar visual)
  - Fila 2: Búsqueda + toggle Grid/List + botones "Crear carpeta" + "Importar"
  - Responsive: en móvil flex-col, en desktop (md+) flex-row compacto
- Soporta vista en grilla y lista.
- Navegacion por carpetas con breadcrumbs clickeables (tipo explorador Windows).
- Importacion de archivos (drag & drop de archivos del sistema + boton).
- La importación específica de Canva (MP4/ZIP por diapositiva) se gestiona en `PresentationEditor` desde la pestaña `Insertar`.
- La biblioteca escucha el evento IPC `media-saved` para refrescar queries de `media` y `folders`, y también refresca ambas al completar importaciones con progreso para mostrar carpetas nuevas sin recargar la ventana.
- Operaciones: copiar, cortar, pegar, renombrar, eliminar, mover entre carpetas.
- El borrado de carpetas en Media Library es recursivo (incluye archivos y subcarpetas internas); si la carpeta contiene subcarpetas, exige confirmación explícita escribiendo `eliminar` antes de ejecutar la acción.
- **Menús contextuales mejorados:**
  - Ambas vistas (grid/list) permiten copiar, cortar, pegar, renombrar, eliminar
  - Carpetas: también permiten "Crear carpeta" (crea dentro de la carpeta seleccionada)
  - Botón derecho en espacio vacío: "Pegar" + "Crear carpeta" (nuevos items en la carpeta actual)
  - Funciona en home (carpeta raíz) y en subcarpetas
- Usa hooks especializados en `hooks/` para separar logica.

### Hooks de Media

| Hook | Proposito |
| ---- | --------- |
| `useMediaOperations` | Importar, eliminar, renombrar medios y carpetas (mutations de React Query) |
| `useSelection` | Seleccion multiple (click, Shift+click, Ctrl+click). Tipo `SelectableItem = Media \| string` |
| `useClipboard` | Estado de clipboard interno (copiar/cortar medios/carpetas) |
| `useDragAndDrop` | Drag & drop entre carpetas con HTML5 API (incluye `.pdf` en `VALID_EXTENSIONS`) |

### MediaCard y FolderCard

- `MediaCard`: Muestra thumbnail, nombre, tipo. Draggable con `data: { type: 'MEDIA', accessData: media.id }`.
  - Para `type: 'PDF'`: muestra icono `FileText` + badge "PDF" en lugar de thumbnail.
  - La info bar muestra `FileText` icon en lugar de `Image`/`Video`.
- `FolderCard`: Muestra icono de carpeta. Draggable Y drop target (para mover items a carpetas).
- Al enviar recursos directo a live (`showItemOnLiveScreen`), los items temporales incluyen `deletedAt: null` para cumplir el tipo `ScheduleItem` de Prisma.
- Ambos tienen `role="button"`, `tabIndex`, `onKeyDown` para accesibilidad.

### MediaGridWrapper (`media/MediaGridWrapper.tsx`)

- Envuelve `MediaGrid` con `ContextMenu` para drag & drop y opciones de menú contextual.
- Props: `onPaste`, `onCreateFolder`, `onDrop`, y todas las props de `MediaGrid`.
- **Menú contextual (click derecho en espacio vacío):**
  - Pegar: restaura items copiados/cortados a la carpeta actual
  - Crear carpeta: abre el dialog para crear una carpeta nueva
- Maneja `onDragEnter/Over/Leave/Drop` para feedback visual durante drag & drop.
- Overlay visual (borde punteado + mensaje) aparece cuando se arrastra archivos sobre el componente.

### MediaList (`media/MediaList.tsx`)

- Vista de lista de medios/carpetas con filas interactivas.
- Props: `onPaste`, `onCreateFolder`, `onRename`, `onCopy`, `onCut`, `onDelete`, etc.
- **Menú contextual por fila:**
  - **Para carpetas:** Abrir, Renombrar, Copiar, Cortar, Pegar, Eliminar
  - **Para archivos:** Renombrar, Copiar, Cortar, Pegar, Eliminar
- Cada fila es clickeable y seleccionable (soporta Ctrl+click, Shift+click).
- Muestra nombre y tamaño del archivo (o "-" para carpetas).

### MediaPicker (`media/MediaPicker.tsx`)

- Dialog reutilizable para seleccionar un medio.
- Usado por `ThemesEditor` para seleccionar imagen/video de fondo.
- Soporta filtro por tipo (`IMAGE` o `VIDEO`).

## Bible (Biblia)

### LibraryPanel (`library/index.tsx`)

- Escucha `bible-search` IPC event para recibir versículos desde la vista live (`RenderBibleLiveControls`). Al recibir `BibleSearchParams { version, bookId, chapter, verse }`, cambia al tab `bible` y pasa los parámetros a `BiblePanel`.
- `BibleSearchParams` se pasa como prop `searchParams` a `BiblePanel`.

### BiblePanel (`bible/index.tsx`)

- Acepta prop opcional `searchParams?: BibleSearchParams | null` para recibir versículos desde el buscador de biblia (enviados desde live).
- Cuando `searchParams` cambia, actualiza `selectedVersion`, `selectedBook`, `selectedChapter`, `selectedVerse` y resetea `selectedChunkKey`.
- Layout de 3 columnas: [Busqueda + Versiones | Libros + Capitulos | Versiculos].
- Estado: `selectedVersion`, `selectedBook`, `selectedChapter`, `selectedVerse[]`.
- Auto-scroll al libro/capitulo/versiculo seleccionado via refs.
- Cada seccion scrolleable independiente.
- El panel de versículos maneja casos de texto de verso faltante sin crashear al seleccionar versiones.

### VerseSearch (`bible/verseSearch.tsx`)

- Input compuesto: [Libro] [Cap.] [Vers.].
- Autocompletado progresivo: al escribir libro, auto-avanza a capitulo, luego a versiculo.
- Si el libro inicia con prefijo numerico (ej: `1` para `1 Corintios`), inserta automaticamente un espacio tras el numero (`1` + espacio) para facilitar la escritura.
- Usa `useBibleSchema()` para validar libros y capitulos.
- Patron render-time reset (ref para sincronizar props -> state).

### ViewVerses (`bible/viewVerses.tsx`)

- Lista de versiculos del capitulo seleccionado.
- **Visualización de chunks:** Versículos largos se muestran divididos en múltiples líneas según la configuración de `BIBLE_LIVE_CHUNK_MODE` (igual que en el cronograma). Cada chunk muestra:
  - Mismo número de versículo
  - Texto con indicadores "..." al inicio/final según posición del chunk
  - Indicador visual `(n/total)` al final de cada chunk
  - Borde izquierdo azul en chunks continuos (excepto el primero)
- **Selección individual de chunks:** Cuando un versículo está dividido en chunks, se puede seleccionar un chunk específico haciendo click en él:
  - Click simple: selecciona el chunk específico (destacado más intenso con anillo visual)
  - Al seleccionar un chunk individual, `selectedChunkKey` se establece en formato `"verse-chunkIndex"` (ej: `"1-0"`, `"1-1"`)
  - Enviar con Enter o doble-click: envía solo el chunk seleccionado a live (no todo el verso)
  - Shift+click o Ctrl+click: selecciona múltiples versos completos y limpia la selección de chunk específico
  - Cambio de libro/capítulo/versión: limpia automáticamente la selección de chunk específico
- **Indicador visual diferenciado:**
  - Chunk específicamente seleccionado: fondo más intenso (`bg-secondary/30`) + anillo de borde (`ring-1 ring-secondary/50`)
  - Verso seleccionado sin chunk específico: fondo suave (`bg-secondary/20`)
  - Chunks no seleccionados: fondo normal con hover (`hover:bg-muted/40`)
- Cada chunk es draggable independientemente, pero todos arrastran el verso completo (el chunking real ocurre al agregarlo al cronograma).
- Seleccion multiple con Shift+click (rango) y Ctrl+click (toggle).
- La selección múltiple preserva segmentos no contiguos (ej: `1-3,8,12`) al arrastrar o enviar a cronograma/live, evitando colapsar automáticamente a un único rango continuo.
- Cuando la selección cambia externamente (ej: cambio de libro/capítulo o selección inicial desde panel superior), `ViewVerses` sincroniza el ancla interna de rango con el verso seleccionado actual para que `Shift+click` extienda desde ese verso (ej: 1 -> Shift+6 selecciona 1..6).
- Navegacion con flechas (Shift+flecha extiende seleccion).
- Navegacion adicional con `PageUp/PageDown` para retroceder/avanzar versiculos con teclado.
- Cada versiculo es draggable con `data: { type: 'BIBLE', accessData: "bookId,chapter,verseRange,version" }`.
- El parser de `accessData` bíblico soporta `verseRange` con comas internas (`bookId,chapter,1-3,8,12,version`) reconstruyendo correctamente el rango desde los segmentos intermedios.
- El `bookId` del `accessData` debe salir de `book_id` (identificador bíblico canónico) y no del `id` de la fila de `BibleSchema`; si `book_id` no existe, se usa `id` solo como fallback de compatibilidad.
- Context menu: Agregar al cronograma, Presentar en vivo.
- Usa `useKeyboardShortcuts()` para navegacion por teclado.

### TextFragmentSearch (`bible/textFragmentSearch.tsx`)

- Busqueda de texto libre en versiculos de la version seleccionada.
- Llama a `window.api.bible.searchTextFragment(version, text)`.
- El campo `book` es **opcional**: vacío busca en toda la Biblia. No ponerlo como requerido en el schema Zod — el formulario arranca con `book: ''` y un `min(1)` bloquea `handleSubmit` en silencio (el error no se renderiza) y el botón Buscar parece no hacer nada.
- Los `value` de las opciones de `AutoComplete` deben ser **string**: el form guarda `book` como texto y `AutoComplete` compara con `===`, así que un `book_id` numérico nunca marca la opción como seleccionada.
- La coincidencia sin tildes/mayúsculas la resuelve el backend normalizando la consulta (`bibleSearchText.ts`); el componente envía el texto tal cual lo escribe el usuario.
- Los resultados se muestran **agrupados por libro**: `groupBibleSearchResultsByBook()` (`bible/groupSearchResultsByBook.ts`) aplana la respuesta en filas `{ kind: 'book' }` (cabecera con nombre y número de coincidencias) y `{ kind: 'verse' }`. Se aplana en vez de anidar listas para conservar una sola `VirtualizedScrollArea`; `estimateSize` devuelve distinta altura según el `kind` y el virtualizador remide con `measureElement`.
- No hace falta reordenar en el cliente: la query ya devuelve `ORDER BY book_id, chapter, verse`, así que basta cortar cuando cambia el libro. Las filas de versículo muestran solo `capítulo:versículo` porque el libro ya va en la cabecera.
- Diseño de la lista: cabecera de libro con punto (`bg-primary`) + nombre en `uppercase text-[11px]` y conteo a la derecha; los versículos cuelgan de una guía vertical (`border-l` con `pl-[11px]`, alineada bajo el punto) con la referencia en columna fija `w-9 tabular-nums` y el texto en `text-xs`. La densidad es intencional: con cientos de resultados el texto grande impedía ubicar el libro actual.
- El separador entre libros usa `border-t` condicional a `index > 0` (el `renderItem` recibe el índice). NO usar `first:border-t-0`: el virtualizador envuelve cada fila en su propio `div`, así que toda cabecera es `:first-child` y la regla se aplicaría a todas.
- La cabecera del libro actual queda **fija arriba** mientras se scrollea vía `renderStickyHeader` de `VirtualizedScrollArea`, resolviendo el libro con `findBookHeaderForIndex(rows, índiceVisible)`. El componente `BookHeader` se reutiliza en la lista y en el sticky, con fondo opaco (`bg-muted`, no `bg-muted/60`) para que las filas no se transparenten por debajo.
- La lista se remonta con `key={submittedAt}` de la mutación en cada búsqueda nueva, para volver arriba y reiniciar la cabecera fija.
- El `rounded-md border` va en un wrapper con `overflow-hidden`, NO en el propio contenedor de scroll: la cabecera fija es rectangular y, sin el clip del wrapper, el radio del borde dejaba ver una franja del fondo por encima de ella.

## Drag & Drop hacia cronograma

Los tres tipos de items de biblioteca son draggables con dnd-kit:

| Tipo | Data de drag | accessData |
| ---- | ----------- | ---------- |
| Song | `{ type: 'SONG', accessData: songId }` | ID numerico del Song |
| Media | `{ type: 'MEDIA', accessData: mediaId }` | ID numerico del Media |
| Bible | `{ type: 'BIBLE', accessData: "bookId,chapter,verseRange,version" }` | String compuesto |
| Presentation | `{ type: 'PRESENTATION', accessData: presentationId }` | ID numerico de la Presentation |

## Presentations (Presentaciones)

### PresentationsPanel (`presentations/index.tsx`)

- Lista de presentaciones con búsqueda por título (`window.api.presentations.getPresentations`).
- Botón `+` abre `window.windowAPI.openPresentationWindow()`.
- Cada presentación es draggable con `type: 'PRESENTATION'`.
- Acciones por context menu: editar, añadir al cronograma, presentar en vivo y eliminar.
- Preview lateral con miniaturas de diapositivas usando `PresentationView`.
- En `PresentationPreview`, cada miniatura permite doble click para enviar la presentación a live iniciando en esa diapositiva (índice específico) mediante `showItemOnLiveScreen(item, slideIndex)`.
- En previews, resuelve medios de slides legacy y de slides mixtos (`items[]` con `type: 'MEDIA'`) para renderizar capas correctamente.
- En previews, también resuelve `themeId` por diapositiva para que miniaturas de presentación reflejen el tema global guardado (si existe).
- `PresentationPreview` usa el patrón de layout `panel-scrollable` + `panel-header` + `panel-scroll-content` para evitar desbordes verticales y mantener scroll interno consistente con el resto de paneles.
- Escucha `presentation-saved` para refrescar la lista de presentaciones y el mapeo de medios del preview en caliente.

El `DragAndDropSchedule` (en ScheduleContext) detecta estos drags y los inserta en el cronograma.

## Convenciones

- Cada sub-modulo (songs, media, bible) es auto-contenido con su propio directorio.
- Los hooks de media estan en `media/hooks/` porque son especificos de ese sub-modulo.
- Los hooks compartidos (bible schema, tags) estan en `app/hooks/`.
- Los items draggables usan el patron `{ type: ScheduleItemType, accessData: id }`.
- Context menus se implementan con Shadcn `ContextMenu` component.
- Las listas interactivas usan `role="button"`, `tabIndex={0}`, `onKeyDown` para accesibilidad.

## Agents relacionados

### ThemesSidePanel (`themesSidePanel.tsx`)

- Panel lateral compacto, ubicado a la izquierda de la biblioteca.
- Permite seleccionar, editar, eliminar y añadir temas rápidamente.
- Incluye acción de importar temas desde archivos `.zip` (selección múltiple) y exportación por tema desde menú contextual.
- Tras importar temas ZIP, informa en UI cuando el archivo de fondo fue renombrado automáticamente por conflicto de ruta/nombre, mostrando la ruta final guardada.
- Siempre visible junto al cronograma y la biblioteca, no compite visualmente.
- Usa utilidades globales `panel-scrollable` (raíz) y `panel-scroll-content` (lista) para soportar scroll interno dentro de `ResizablePanel`.
- El wrapper raíz del panel usa `flex-1 min-h-0` para heredar correctamente altura en layouts flex y habilitar el overflow vertical de la lista.
- La grilla de previews se renderiza dentro de un contenedor interno, dejando `panel-scroll-content` solo para el comportamiento de scroll.
- El contenedor scrolleable aplica `h-0 flex-1` para evitar problemas de min-content en layouts flex y asegurar el scroll en Electron.
- Usa `PresentationView` para previews.
- Acciones: seleccionar tema (aplica al schedule), editar, eliminar, añadir, importar desde ZIP y exportar tema actual a ZIP.
- Context menu para editar/eliminar.
- Context menu también ofrece `Exportar tema (.zip)` para generar backup/portabilidad rápida.
- Accesibilidad: todos los previews son botones accesibles.

## Cambios recientes

- **Fix: Lista de medios no se actualiza en modo remoto tras importar** (2026-08-16): las mutaciones de media (`importMutation`, `createFolderMutation`, `deleteFolderMutation`, `renameMutation`, `deleteMutation`, `moveMutation`, `copyMutation`) en `useMediaOperations.ts` no tenían `onSuccess` para invalidar el cache de React Query. Dependían exclusivamente del evento socket `queryKeysInvalidate`, que en modo remoto puede perderse por timing de conexión o reconexiones durante la subida.
  - **Problema**: al subir archivos desde el client al host, los archivos se subían correctamente y aparecían en la lista del host, pero el client no refrescaba su lista.
  - **Solución**: agregar `onSuccess` con `queryClient.invalidateQueries({ queryKey: ['media'] })` y `['folders']` a todas las mutaciones de media. Esto invalida el cache local directamente tras cada operación exitosa, funcionando tanto en modo local como remoto, independientemente del estado del socket.
  - **Archivo**: `app/screens/panels/library/media/hooks/useMediaOperations.ts`.
