# Schedule & Live Agent
#
## Cambios recientes

- Los métodos `createNewSchedule` y `updateSchedule` ahora aceptan un array de items (`AddScheduleItemDto[]`) al crear o actualizar un cronograma.
- Los DTOs `CreateScheduleDto` y `UpdateScheduleDto` permiten incluir items opcionales.
- El controller fue actualizado para aceptar estos items y pasarlos al service.


> **Agent router:** [`/agents.md`](../../../../agents.md)

## Descripcion

Panel de cronograma que ocupa la parte superior-izquierda de la aplicacion. Gestiona la lista de items del servicio, drag & drop para reordenar, grupos visuales, y la vista previa de presentacion. Tambien controla la proyeccion en pantallas en vivo.

## Archivos

```
app/screens/panels/schedule/
├── index.tsx                           # SchedulePanel: alterna entre lista de schedules y contenido
├── scheduleList.tsx                    # ScheduleList: CRUD de cronogramas
├── components/
│   └── scheduleGroups/
│       ├── scheduleGruopItem.tsx       # Item visual de grupo en el cronograma
│       └── GroupTemplateManagerDialog.tsx  # Dialog para CRUD de plantillas de grupo
└── scheduleContent/
    ├── index.tsx                       # ScheduleContent: vista principal del cronograma activo
    ├── scheduleItem.tsx                # ScheduleItemComponent: item individual (sortable + droppable)
    ├── previewSchedule.tsx             # PreviewSchedule: grid de slides para vista previa
    ├── emptyShcedule.tsx               # EmptySchedule: estado vacio con drop zone
    └── insertionDropZone.tsx           # InsertionDropZone: zona de insercion entre items
```

## Flujo principal

```
SchedulePanel (index.tsx)
  ├── [Vista "lista"] ScheduleList
  │     - Lista de cronogramas guardados
  │     - Boton crear nuevo / sesion temporal
  │     - Click en schedule -> carga y cambia a vista "contenido"
  │
  └── [Vista "contenido"] ScheduleContent
      - Header: titulo, boton guardar y boton "Cronogramas" (volver)
        - Lista de items (SortableContext de dnd-kit)
        - Cada item es ScheduleItemComponent (sortable + drop zone)
        - InsertionDropZone entre items para insertar desde biblioteca
  - Layout principal usa paneles resizables (`ResizablePanelGroup` y `ResizablePanel`) para adaptar el espacio entre cronograma, pantallas en vivo y biblioteca.
  - El input de nombre del cronograma crece automáticamente al ancho del panel.
        - EmptySchedule cuando no hay items
        - PreviewSchedule al seleccionar un item (parte inferior)
```

## Componentes

### ScheduleList (`scheduleList.tsx`)

- Lista de cronogramas con React Query (`queryKey: ['schedules']`).
- CRUD completo: crear, editar (dialog), eliminar.
- Boton "Sesion Temporal" para crear cronograma sin guardar.
- Context menu en cada schedule: Editar, Eliminar.
- El schedule activo se resalta con borde primary.
- Accesibilidad: `role="button"`, `tabIndex`, `onKeyDown` en items clickeables.

### ScheduleContent (`scheduleContent/index.tsx`)

- Vista principal del cronograma activo.
- Usa `SortableContext` de dnd-kit para reordenamiento.
- Detecta drags externos (de biblioteca) vs internos (reordenar).
- `useDroppable` en el contenedor para drops al final.
- Overlay animado cuando se arrastra sobre el area (usa `LazyMotion` + `m`).
- Al seleccionar un item, muestra `PreviewSchedule` en la parte inferior.
- Si el item seleccionado depende de recursos editables (`PRESENTATION`, `SONG`, `MEDIA`), el cronograma refresca `itemContent` en caliente al guardar (`presentation-saved`, `song-saved`, `media-saved`) para que labels y preview se actualicen sin recargar la app.
- `useKeyboardShortcuts` para Delete y click outside.

### ScheduleItemComponent (`scheduleContent/scheduleItem.tsx`)

- Doble comportamiento: `useSortable` (para reordenar) + `useDroppable` (para insercion).
- Dos modos visuales:
  - **GROUP**: Header de color con nombre del grupo. No clickeable para seleccionar.
  - **Item normal**: Card con icono + label. Click selecciona, doble-click presenta en vivo.
- Label se carga async via `getScheduleItemLabel()` (puede necesitar fetch del nombre).
- Color de fondo hereda del grupo al que pertenece.
- Zona de insercion debajo de cada item para drops de biblioteca.
- Context menu: Presentar en vivo, Eliminar.

### InsertionDropZone (`scheduleContent/insertionDropZone.tsx`)

- Zona invisible que se activa cuando se arrastra un item de biblioteca.
- Se expande visualmente al hacer hover (drop indicator).
- Usa `useDroppable` con `id: insert-position-{index}`.
- Solo se activa para drags externos (no para reordenar).

### PreviewSchedule (`scheduleContent/previewSchedule.tsx`)

- Grid de `PresentationView` components mostrando cada slide del item seleccionado.
- Click selecciona un slide, doble-click lo presenta en vivo.
- Boton "Presentar en vivo" envia todo el item a pantallas.

### EmptySchedule (`scheduleContent/emptyShcedule.tsx`)

- Estado vacio con animacion (LazyMotion + m).
- Drop zone para el primer item.
- Cambia visualmente cuando se arrastra algo sobre el.

### GroupTemplateManagerDialog (`components/scheduleGroups/GroupTemplateManagerDialog.tsx`)

- Dialog para gestionar plantillas de grupos (Alabanza, Predicacion, etc.).
- CRUD de `ScheduleGroupTemplate` con nombre y color.
- Al guardar emite IPC `schedule-group-templates-saved`.

## Interaccion con Live

El cronograma se conecta con las pantallas en vivo a traves de `useLive()`:

1. **Seleccionar item** -> muestra preview en `PreviewSchedule`
2. **Doble-click o "Presentar en vivo"** -> `showItemOnLiveScreen(item, slideIndex)`
3. **LiveContext** -> carga contenido del item, abre ventanas en displays configurados
4. **Pantalla live** -> recibe contenido via IPC y lo renderiza con `PresentationView`

### Pantallas relacionadas

- `app/screens/panels/items-on-live/` - Panel central que muestra controles del item en vivo
- `app/screens/panels/live-screens/` - Panel derecho que muestra miniaturas de pantallas live
- `app/screens/live-screen/` - Ventana de proyeccion fullscreen (ruta `/live-screen/:displayId`)

## Drag & Drop

Dos flujos de drag & drop coexisten:

### 1. Reordenar items (interno)

```
ScheduleItemComponent (useSortable)
  -> DragAndDropSchedule detecta drag interno
  -> reorderItems(activeId, overId)
  -> Actualiza orden en el form de React Hook Form
```

### 2. Insertar desde biblioteca (externo)

```
SongItem/MediaCard/VerseItem (useDraggable, data: { type, accessData })
  -> DragAndDropSchedule detecta drag externo
  -> InsertionDropZone o ScheduleItemComponent (useDroppable)
  -> addItemToSchedule({ type, accessData }, insertPosition)
  -> Nuevo ScheduleItem con UUID generado
```

Deteccion: un drag externo tiene `data.accessData` pero NO `data.item` (helper compartido
`isExternalDragData` en `contexts/ScheduleContext/utils/scheduleCollision.ts`).

### Deteccion de colisiones

`DndContext` usa `scheduleCollisionDetection` (`contexts/ScheduleContext/utils/scheduleCollision.ts`)
en lugar de `pointerWithin` a secas:

1. Zona bajo el puntero, priorizando el tipo que corresponde al drag
   (`insertion-zone` para drags de biblioteca, `item` para reordenar). Evita que el
   contenedor `schedule-drop-area` gane y el item termine al final de la lista.
2. Si el puntero esta dentro del cronograma pero en un hueco (margenes, separadores),
   se elige la zona mas cercana al puntero.
3. Si no, lo que devuelva `pointerWithin` (cronograma vacio, carpetas de la biblioteca).

Ademas:

- `measuring={{ droppable: { strategy: Always, frequency: 100 } }}`: los droppables se
  habilitan/deshabilitan durante el drag y la lista puede scrollear, asi que hay que
  re-medirlos mientras se arrastra (por defecto dnd-kit mide una sola vez al empezar).
- Los indicadores "Soltar para insertar aqui" viven en `insertionIndicator.tsx`: hueco de
  altura fija con el indicador en `absolute`. El espacio real lo abren los items
  siguientes desplazandose con `transform: translate3d(0, INSERTION_GAP, 0)`, no con
  layout: dnd-kit mide los droppables con `ignoreTransform: true`, asi que el hueco se ve
  pero las zonas de deteccion no se mueven (si se cambia el layout, los rects cacheados
  dejan de coincidir con lo que ve el usuario y el drop deja de detectarse).
- El hueco se mantiene abierto entre el drop y el commit de react-hook-form
  (`utils/pendingInsertion.tsx`): `form.setValue` no entra en el mismo commit que el
  `DragEnd` de dnd-kit, asi que sin eso los items subian 44px y volvian a bajar. Se libera
  en el mismo render en que cambia el largo de la lista.
- `useSortable` va con `animateLayoutChanges: () => false`: por defecto devuelve `true`
  tras un drag (`wasDragging` es true incluso para drags externos) y animaba los items
  siguientes desde su posicion anterior al insertarse uno nuevo, sumandose al hueco.
- `DragOverlay` usa un `dropAnimation` propio: para drags de biblioteca el preview se
  desvanece donde se solto (la animacion por defecto lo devolvia al origen, como si el
  drop se hubiera rechazado); para el reordenamiento interno se mantiene la de dnd-kit.
- La copia del item que se renderiza dentro del `DragOverlay` recibe `isPreview` para no
  registrar droppables con los ids del item real (dnd-kit indexa por id y el registro del
  overlay sobreescribia al del item, que dejaba de detectarse).

## Convenciones

- IDs de ScheduleItem son UUIDs generados con `generateUniqueId()` (de `lib/utils`).
- El `order` es global (no por grupo), se recalcula al reordenar.
- Items de tipo GROUP son cabeceras visuales, no contienen sub-items anidados.
- Los items heredan el color del ultimo GROUP que los precede en orden.
- Animaciones usan `LazyMotion` + `m` (no `motion`) para optimizar bundle.
- Accesibilidad: todos los items interactivos tienen `role="button"`, `tabIndex`, `onKeyDown`.

## Agents relacionados

- ScheduleContext y LiveContext -> `/app/contexts/agents.md`
- Items de biblioteca (drag sources) -> `/app/screens/panels/library/agents.md`
- PresentationView (renders) -> `/app/ui/agents.md`
- Modelos Schedule/ScheduleItem -> `/prisma/agents.md`
- Backend schedule controller -> `/database/agents.md`
