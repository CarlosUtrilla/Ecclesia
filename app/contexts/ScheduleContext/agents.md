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
    - Incluye soporte MVP para `PRESENTATION`: resuelve título, ícono y contenido por diapositiva.
    - Para slides legacy de tipo `MEDIA` y para slides mixtos (`items[]`), carga los `Media` requeridos y los mapea a `PresentationViewItems`.
    - En ese mapeo también resuelve `themeId` por slide (desde `useThemes`) para que la proyección respete tema global de presentación cuando existe.
    - Para PRESENTATION en live, conserva una diapositiva lógica por slide (sin expansión por rango) y delega el avance bíblico a un controlador interno de verso por slide.
    - Para PRESENTATION en live también puede aplicar overrides temporales de versión bíblica por slide o por layer, de modo que el operador cambie la versión en el panel live sin persistir cambios en la presentación original.
    - Para `BIBLE` directo, divide automáticamente versículos demasiado largos en múltiples slides legibles, manteniendo la misma referencia bíblica (`bookId/chapter/verse`) pero con `id` único por fragmento para navegación/render estable en live.
    - La longitud de fragmentación se controla con el setting `BIBLE_LIVE_CHUNK_MODE`: valores fijos (`100/150/200/250`) o `auto`, que estima el límite según el `fontSize` del tema activo.
    - Escucha `presentation-saved` para refetch de queries de presentaciones/medios asociados al cronograma y evitar labels/previews desactualizados.
  - **liveContext.tsx**: Sub-contexto para gestión de pantallas en vivo y sincronización de contenido.
    - Mantiene `presentationVerseBySlideKey` para sincronizar el verso activo de cada slide de presentación entre el panel `items-on-live` y las ventanas `live-screen`.
    - Mantiene `presentationBibleOverrideByKey` para sincronizar overrides temporales `{ version, text }` de contenido bíblico por `slideKey/layerId` entre el panel `items-on-live` y las ventanas `live-screen`.
    - Mantiene `appliedTheme` como snapshot del tema realmente aplicado al último `showItemOnLiveScreen`; así el panel live puede seguir mostrando el tema proyectado aunque el operador cambie después el selector global.
    - Mantiene controles de emergencia de proyección (`hideTextOnLive`, `showLogoOnLive`, `blackScreenOnLive`) y los sincroniza por IPC en payload parcial de `liveScreen-update`.
    - Se separa el envío de `liveScreen-update` en dos efectos: uno para `itemIndex/contentScreen/presentationVerseBySlideKey` y otro para `liveControls`, evitando reenviar contenido completo cuando solo cambian controles.
    - Atajos globales del operador:
      - `F7`: abre/activa ventanas live.
      - `F9`: alterna ocultar texto solo en live (no afecta preview).
      - `F10`: alterna mostrar logo/fallback sin quitar el item del cronograma.
      - `F11`: alterna pantalla negra en live.
      - `Escape`: limpia item en vivo manteniendo la ventana live abierta.
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
- Regla actual para `PRESENTATION`: en live se fuerza `BlankTheme` como base (fondo blanco) mientras no exista tema explícito por diapositiva; para otros tipos se mantiene `selectedTheme`.

### 4. Integración con recursos

- Obtiene y cachea datos de canciones y medios asociados a los items del cronograma.
- Permite obtener el texto completo de versículos bíblicos y etiquetas enriquecidas para cada tipo de item.
- Integra con el MediaServer para obtener URLs de medios locales.

---

## API del contexto (IScheduleContext)

- `itemOnLive`, `setItemOnLive`: Item actualmente proyectado en vivo.
- `selectedTheme`, `setSelectedTheme`: Tema visual activo para la proyección.
- `appliedTheme`: Tema efectivamente aplicado al item live actual; se congela al presentar y no cambia por seleccionar otro tema hasta reenviar contenido.
- `selectedTheme` se resincroniza automáticamente cuando `useThemes()` refetchea cambios (por ejemplo al guardar desde ThemeEditor), para aplicar inmediatamente updates de `textStyle`, fondo y animación en `PresentationView` sin re-seleccionar manualmente el tema.
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
