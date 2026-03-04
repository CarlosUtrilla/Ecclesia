# Presentation Editor Agent

> **Agent router:** [../agents.md](../agents.md)

## Descripcion

Modulo dedicado al editor de presentaciones (`/presentation/new`, `/presentation/:id`).
Su objetivo es crear/editar presentaciones con diapositivas mixtas (`items[]`) y edición visual en canvas.

## Estructura del modulo

```text
app/screens/editors/presentationEditor/
├── index.tsx                              # Orquestador del editor
├── bibleTextPicker.tsx                    # Selector de texto bíblico para inserción
├── schema.ts                              # Zod schema del formulario
├── agents.md                              # Este documento
├── components/
│   ├── editorCanvas.tsx                   # Canvas de edición (drag/resize/rotate)
│   ├── canvasItemNode.tsx                 # Nodo orquestador por item (media/texto + acciones de menú)
│   ├── canvasTransformHandles.tsx         # Handles reutilizables de resize/rotate
│   ├── canvasItemContextMenu.tsx          # Menú contextual reutilizable para items del canvas
│   ├── canvasItemShell.tsx                # Tarjeta base visual/posicional de items en canvas
│   ├── mediaCanvasItem.tsx                # Render de item media en canvas (imagen/video + handles)
│   ├── textCanvasItem.tsx                 # Item de texto editable inline
│   ├── slideControls.tsx                  # Controles contextuales de MEDIA/BIBLE
│   ├── textStyleToolbar.tsx               # Toolbar tipográfica y posición
│   └── sortableSlideCard.tsx              # Miniatura sortable para carrusel
├── hooks/
│   ├── usePresentationEditorHistory.ts    # Undo/redo con snapshots
│   ├── usePresentationEditorShortcuts.ts  # Delete/Duplicate/Undo/Redo globales
│   ├── usePresentationEditorActions.ts    # Acciones de negocio del editor
│   ├── useCanvasSnapping.ts               # Snapping magnético y guías visuales
│   └── useCanvasTransform.ts              # Transformaciones pointer-driven (move/resize/rotate)
└── utils/
    ├── slideUtils.ts                      # Factories/normalización de slides e items
    └── bibleAccessData.ts                 # Parse/build de accessData bíblico
```

## Responsabilidades por capa

- `index.tsx`: composición de UI, queries, routing y wiring entre hooks/componentes.
- `components/*`: render e interacción visual (canvas, toolbar, controles, miniaturas).
- `hooks/*`: lógica reutilizable y estado derivado (acciones, historial, shortcuts, snapping).
- `utils/*`: transformaciones puras de datos y helpers de serialización/parsing.

## Flujos clave

- Inserción de contenido (`Texto`, `Biblia`, `Media`) en la diapositiva seleccionada.
- Punto único de inserción desde el menú `Insertar` (evita duplicar acciones en toolbar de texto).
- La opción de media en `Insertar` está etiquetada para indicar origen desde biblioteca (más explícita para usuario).
- Carrusel inferior de diapositivas en formato compacto para priorizar el espacio útil del canvas.
- Canvas del editor con fondo blanco por defecto y estilo base de texto en negro para edición inicial.
- El tamaño de preview del canvas usa `useScreenSize` (mismo cálculo que `PresentationView`) para respetar aspect ratio de pantalla LIVE.
- La toolbar tipográfica de texto se integra en la barra superior (junto al título/acciones), no en una fila separada.
- En pantallas estrechas, la toolbar tipográfica usa scroll horizontal para mantenerse en una sola línea.
- El bloque de toolbar tipográfica y el menú `Insertar` se mantienen agrupados visualmente para reducir separación innecesaria en header.
- Click en área vacía del canvas deselecciona el item activo y cierra edición inline de texto.
- Los items del canvas usan shell visual transparente (sin fondo gris) para preservar fidelidad del preview.
- Inserciones de `TEXT/BIBLE` calculan altura inicial según contenido (autosize) para evitar cajas excesivamente altas.
- Inserciones de `TEXT/BIBLE` se crean centradas en el canvas base (1280x720) con altura autoajustada.
- El selector bíblico permite seleccionar un único verso por inserción (evita bloques saturados por rangos largos).
- El picker muestra referencia seleccionada con versión (`Libro capítulo:verso (versión)`) antes de agregar.
- Los items de texto en canvas (cuando no están en edición inline) reutilizan renderers de `PresentationView`: `AnimatedText` para texto general y `BibleTextRender` para bíblico.
- El render en canvas aplica `item.animationSettings` (si existe) para previsualizar transiciones/animaciones compatibles con la proyección final.
- La toolbar tipográfica del editor incluye alineación vertical por item (`Arriba`, `Centro`, `Abajo`) y se persiste en `customStyle` mediante `align-items`.
- El editor reutiliza `AnimationSelector` (desde `themesEditor`) para configurar animaciones por item de texto/biblia, persistiendo en `item.animationSettings`.
- El botón de preview de animación fuerza remount controlado del render no-edit para volver a reproducir la transición en canvas.
- Cada slide permite configurar `transitionSettings` (default `fade`) con `AnimationSelector` reutilizado; esta transición se usa al cambiar de slide en runtime.
- Los items bíblicos del canvas respetan configuración global de biblia vía `BibleTextRender` (`useDefaultBibleSettings`).
- El render no-edit del canvas envuelve estos componentes con `LazyMotion` + `domAnimation` para habilitar correctamente los nodos `m.*` de Framer Motion fuera de `PresentationView`.
- El flujo de edición inline resetea explícitamente estado interno de entrada/salida (`wasEditingRef`) para evitar pérdida visual del contenido al deseleccionar y volver a editar.
- La escritura inline en `textCanvasItem` está optimizada con debounce suave (~100ms) y `flush` inmediato en `Enter`, `Escape` y `blur`, reduciendo lag al teclear sin perder cambios.
- Durante drag de items de texto, `textCanvasItem` usa un render liviano estático (HTML sanitizado) y restaura `AnimatedText`/`BibleTextRender` al soltar, para reducir tirones en movimiento.
- Las transformaciones de drag/resize/rotate en canvas se emiten con `requestAnimationFrame` + `flush` al soltar para suavizar movimiento y evitar ráfagas de updates.
- Edición multi-item por slide con capas (`layer`) y estilos serializados (`customStyle`).
- Snapping por centros/bordes con guías visuales y `Alt` para desactivar temporalmente.
- Handles de transformación (`resize/rotate`) centralizados en `canvasTransformHandles.tsx` para evitar duplicación entre MEDIA y TEXT.
- Cada item del canvas se orquesta desde `canvasItemNode.tsx` para mantener `editorCanvas.tsx` declarativo y con menor complejidad.
- La lógica de interacción por puntero para `move/resize/rotate` del canvas está desacoplada en `useCanvasTransform.ts`.
- El menú contextual de acciones (`Editar texto`, `capas`, `duplicar`, `eliminar`) está centralizado en `canvasItemContextMenu.tsx`.
- El contenedor visual común de los items se centraliza en `canvasItemShell.tsx` y lo reutilizan `textCanvasItem` y `mediaCanvasItem`.
- Historial de cambios con pausa de captura durante drag/resize/rotate.
- Guardado normalizando shape legacy + `items[]` para persistencia en presentations.

## Convenciones y guardrails

- Texto UI en español; identificadores y tipos en inglés.
- No usar `dangerouslySetInnerHTML` sin sanitización (`sanitizeHTML`).
- Evitar `useEffect` para estado derivado de props salvo listeners/side-effects reales.
- Mantener `index.tsx` como orquestador; lógica de negocio nueva debe ir a hooks.
- Cualquier cambio en este módulo debe actualizar este `agents.md`.
