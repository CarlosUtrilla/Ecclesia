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
