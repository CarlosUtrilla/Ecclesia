# ScheduleContext Agent

## Propósito

ScheduleContext es el contexto central para la gestión del cronograma (schedule) en Ecclesia. Orquesta el estado, edición, persistencia, drag & drop y proyección en vivo de los items del cronograma, integrando datos de canciones, medios, biblias y temas de presentación.

---

## Estructura de archivos

- **index.tsx**: Proveedor principal del contexto. Expone el estado, acciones y helpers para manipular el cronograma y coordina los sub-contextos (LiveProvider, DragAndDropSchedule).
- **schema.ts**: Esquema Zod para validación de schedules y tipado de datos.
- **types.d.ts**: Tipos TypeScript para el contexto, items, helpers y DTOs relacionados.
- **utils/**: Utilidades especializadas:
  - **dragAndDropSchedule.tsx**: Lógica de drag & drop (dnd-kit) para items y plantillas.
  - **indexDataItems.tsx**: Helpers para obtener iconos, etiquetas y contenido de items (canciones, medios, biblias).
  - **liveContext.tsx**: Sub-contexto para gestión de pantallas en vivo y sincronización de contenido.
  - **LibraryItemPreview.tsx**: Vista previa de items durante drag & drop.

---

## Integración con SchedulePanel y Library

### Uso principal del contexto

La carpeta [`app/screens/panels/schedule/`](../../screens/panels/schedule/) es el principal consumidor de ScheduleContext:

- **ScheduleContent** y **ScheduleItemComponent** usan `useSchedule()` para acceder y modificar el cronograma en tiempo real.
- El drag & drop de items (canciones, medios, versículos) desde la biblioteca se gestiona vía `DragAndDropSchedule` y los métodos `addItemToSchedule`, `reorderItems`, etc.
- El contexto también provee helpers para renderizar iconos, labels y previews de cada item en la UI del cronograma.
- La proyección en vivo se coordina con `useLive()` y los métodos de LiveContext.

### Recepción de items desde Library

La carpeta [`app/screens/panels/library/`](../../screens/panels/library/) expone los recursos draggables:

- **SongItem**, **MediaCard** y los versículos de **ViewVerses** usan `useDraggable` con `data: { type, accessData }`.
- Al hacer drag & drop sobre el cronograma, `DragAndDropSchedule` detecta el tipo y llama a `addItemToSchedule` con la posición adecuada.
- También es posible agregar items por click/context menu (ej: "Agregar al cronograma"), que llaman directamente a `addItemToSchedule` desde el contexto.
- El flujo soporta tanto inserción por drop en zonas específicas (InsertionDropZone) como al final del cronograma.

#### Resumen de integración

- **Drag externo:** Desde biblioteca (songs/media/bible) → drop en cronograma → `addItemToSchedule`.
- **Click/context menu:** Desde biblioteca → acción "Agregar al cronograma" → `addItemToSchedule`.
- **Reordenamiento:** Drag interno en cronograma → `reorderItems`.

Ver detalles de implementación y convenciones en los agents de [schedule](../../screens/panels/schedule/agents.md) y [library](../../screens/panels/library/agents.md).

---

## Principales responsabilidades

### 1. Estado y edición del cronograma

- Usa React Hook Form + Zod para manejar el formulario del schedule.
- Permite agregar, eliminar, reordenar y editar items (canciones, medios, biblias, presentaciones, grupos).
- Sincroniza el estado con la base de datos vía IPC (window.api.schedule).
- Expone helpers para obtener iconos, etiquetas y contenido renderizable de cada item.

### 2. Drag & Drop avanzado

- Implementa drag & drop con dnd-kit, soportando:
  - Arrastrar desde biblioteca o plantillas (drag externo).
  - Reordenar items dentro del cronograma (drag interno).
  - Inserción en posiciones específicas.
- Usa helpers para distinguir el origen y tipo de drag.

### 3. Proyección en vivo (LiveProvider)

- Gestiona el estado de las pantallas en vivo (ventanas Electron).
- Sincroniza el contenido y tema visual en tiempo real con las pantallas conectadas.
- Expone helpers para mostrar un item en vivo, cambiar de item, y actualizar el tema.
- Escucha eventos IPC para saber cuándo las pantallas están listas o deben ocultarse.

### 4. Integración con recursos

- Obtiene y cachea datos de canciones y medios asociados a los items del cronograma.
- Permite obtener el texto completo de versículos bíblicos y etiquetas enriquecidas para cada tipo de item.
- Integra con el MediaServer para obtener URLs de medios locales.

---

## API del contexto (IScheduleContext)

- `itemOnLive`, `setItemOnLive`: Item actualmente proyectado en vivo.
- `selectedTheme`, `setSelectedTheme`: Tema visual activo para la proyección.
- `currentSchedule`: Lista ordenada de items del cronograma.
- `form`: Instancia de React Hook Form para edición y validación.
- `getScheduleItemIcon`, `getScheduleItemLabel`, `getScheduleItemContentScreen`: Helpers para UI y proyección.
- `songs`, `media`: Recursos asociados al cronograma.
- `addItemToSchedule`, `deleteItemFromSchedule`, `reorderItems`, `reorderInMainSchedule`: Acciones CRUD y de ordenamiento.
- `saveScheduleChanges`: Persistencia en base de datos.
- `itemsSortableIndex`: IDs ordenados para drag & drop.

---

## Buenas prácticas y convenciones

- Mantener la lógica de dominio (edición, validación, persistencia) en el contexto y helpers, no en la UI.
- Usar hooks y helpers para desacoplar la obtención de datos de la presentación.
- Sincronizar el estado con la base de datos solo mediante métodos IPC definidos.
- Documentar cualquier cambio relevante en este agent.

---

## Ejemplo de uso

```tsx
import { ScheduleProvider, useSchedule } from '@/contexts/ScheduleContext'

<ScheduleProvider>
  {/* children que consumen el contexto */}
</ScheduleProvider>

const {
  currentSchedule,
  addItemToSchedule,
  saveScheduleChanges,
  ...
} = useSchedule()
```

---

## Última actualización

2026-02-19
