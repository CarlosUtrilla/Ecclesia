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
- Si el item seleccionado es `PRESENTATION`, escucha `presentation-saved` y refresca `itemContent` para que la preview del cronograma se actualice al guardar cambios de diapositivas en el editor.
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

Deteccion: un drag externo tiene `data.accessData` pero NO `data.item`.

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
