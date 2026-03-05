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
- Carrusel inferior de diapositivas en formato compacto (`w-36`) para priorizar el espacio útil del canvas.
- El área inferior del carrusel incluye control de zoom del canvas (`50%` a `200%`) con slider, botones `+/-` y reset rápido a `100%`.
- Además del slider, el canvas permite zoom directo con `Ctrl/Cmd + rueda` para acercar/alejar rápidamente durante edición.
- La franja inferior distribuye carrusel y zoom en una sola línea (carrusel a la izquierda con scroll horizontal + bloque de zoom a la derecha) para mejorar legibilidad y uso del espacio.
- El canvas usa viewport base fijo en px (`1280x720`) y aplica zoom con escalado relativo (`transform: scale`) sobre ese viewport; así se preservan proporciones, aspect ratio y crecimiento uniforme del contenido.
- El cálculo de interacción en canvas (drag, resize, rotate, snapping y posición de puntero) es zoom-aware: normaliza deltas/coords por escala para mantener precisión en cualquier nivel de zoom.
- Canvas del editor con fondo blanco por defecto y estilo base de texto en negro para edición inicial.
- El stage del canvas se presenta dentro de un contenedor visual sutil (borde + fondo + sombra ligera) para separar mejor el lienzo del fondo del editor.
- El canvas del editor renderiza el fondo del tema global activo (color, gradiente, imagen o thumbnail de video) para mantener paridad visual con previews/live mientras se edita.
- El tamaño de preview del canvas usa `useScreenSize` (mismo cálculo que `PresentationView`) para respetar aspect ratio de pantalla LIVE.
- La toolbar tipográfica de texto se integra en la barra superior (junto al título/acciones), no en una fila separada.
- En pantallas estrechas, la toolbar tipográfica usa scroll horizontal para mantenerse en una sola línea.
- El bloque de toolbar tipográfica y el menú `Insertar` se mantienen agrupados visualmente para reducir separación innecesaria en header.
- Click en área vacía del canvas deselecciona el item activo y cierra edición inline de texto.
- Click en el fondo del área de preview (detrás del stage/canvas) también deselecciona el item activo sin afectar otras zonas del editor.
- Los items del canvas usan shell visual transparente (sin fondo gris) para preservar fidelidad del preview.
- Inserciones de `TEXT/BIBLE` calculan altura inicial según contenido (autosize) para evitar cajas excesivamente altas.
- Inserciones de `TEXT/BIBLE` se crean centradas en el canvas base (1280x720) con altura autoajustada.
- El selector bíblico permite seleccionar múltiples versos contiguos por rango (click para inicio y `Shift+click` para extender el final).
- El picker muestra referencia seleccionada con versión (`Libro capítulo:versoInicio-versoFin (versión)`) antes de agregar.
- En `textCanvasItem`, los items bíblicos con rango muestran un micro-control dentro del recuadro (anterior/siguiente) para previsualizar y ajustar posición/estilo verso por verso durante la edición.
- El verso previsualizado en ese micro-control se conserva por item durante la sesión del editor (no se pierde al seleccionar otro item y volver).
- Los items de texto en canvas (cuando no están en edición inline) reutilizan renderers de `PresentationView`: `AnimatedText` para texto general y `BibleTextRender` para bíblico.
- El render no-edit de `textCanvasItem` no aplica padding interno adicional alrededor de `AnimatedText`/`BibleTextRender`, para mantener paridad de tamaño visual con `PresentationView`.
- El render en canvas aplica `item.animationSettings` (si existe) para previsualizar transiciones/animaciones compatibles con la proyección final.
- Los items `MEDIA` de tipo video en canvas exponen controles nativos de reproducción (`controls`) para previsualizar el video dentro del editor; el drag del item sigue disponible sobre el área del video y la franja inferior de controles queda reservada para interacción del reproductor.
- La toolbar tipográfica del editor incluye alineación vertical por item (`Arriba`, `Centro`, `Abajo`) y se persiste en `customStyle` mediante `align-items`.
- El editor reutiliza `AnimationSelector` (desde `themesEditor`) para configurar animaciones por item de texto/biblia, persistiendo en `item.animationSettings`.
- El botón de preview de animación fuerza remount controlado del render no-edit para volver a reproducir la transición en canvas.
- Cada slide permite configurar `transitionSettings` (default `fade`) con `AnimationSelector` reutilizado; esta transición se usa al cambiar de slide en runtime.
- Cada slide permite configurar `videoLiveBehavior` (`Inicio manual` / `Inicio automático`) desde la barra superior; el valor se persiste en `slides[]` y controla reproducción de video al entrar en vivo.
- El selector `Video en live` usa icono de rayo (`Zap`) junto al label para mejorar descubrimiento visual de la configuración de reproducción en vivo.
- La toolbar del editor incluye selector de `Tema global` para aplicar un `themeId` común a todas las diapositivas; también ofrece `Sin tema` para quitar el tema global.
- Las nuevas diapositivas creadas desde el editor heredan automáticamente el `themeId` global seleccionado al momento de insertarse.
- Los items bíblicos del canvas respetan configuración global de biblia vía `BibleTextRender` (`useDefaultBibleSettings`).
- El render no-edit del canvas envuelve estos componentes con `LazyMotion` + `domAnimation` para habilitar correctamente los nodos `m.*` de Framer Motion fuera de `PresentationView`.
- El flujo de edición inline resetea explícitamente estado interno de entrada/salida (`wasEditingRef`) para evitar pérdida visual del contenido al deseleccionar y volver a editar.
- La escritura inline en `textCanvasItem` está optimizada con debounce suave (~100ms) y `flush` inmediato en `Enter`, `Escape` y `blur`, reduciendo lag al teclear sin perder cambios.
- Durante drag de items de texto, `textCanvasItem` usa un render liviano estático (HTML sanitizado) y restaura `AnimatedText`/`BibleTextRender` al soltar, para reducir tirones en movimiento.
- Las transformaciones de drag/resize/rotate en canvas se emiten con `requestAnimationFrame` + `flush` al soltar para suavizar movimiento y evitar ráfagas de updates.
- Durante la rotación de un item, el canvas muestra una etiqueta temporal con el ángulo actual (`°`) sobre el elemento para facilitar ajuste preciso.
- Al rotar con `Shift` presionado, el ángulo se ajusta en saltos de `45°` para alineación rápida (`0/45/90/...`).
- La etiqueta de ángulo se posiciona por encima del handle de rotación para mantener visibilidad durante el ajuste.
- Edición multi-item por slide con capas (`layer`) y estilos serializados (`customStyle`).
- Snapping por centros/bordes con guías visuales y `Alt` para desactivar temporalmente.
- El snapping de move/resize usa coordenadas y dimensiones del área `client` del canvas (no `getBoundingClientRect` completo) para evitar desfases de 1px por borde del contenedor y alinear exactamente a los bordes visibles.
- El resize también hace snap contra bordes del slide (izquierda/derecha/arriba/abajo) para ajustar items de punta a punta con precisión.
- Handles de transformación (`resize/rotate`) centralizados en `canvasTransformHandles.tsx` para evitar duplicación entre MEDIA y TEXT.
- Cada item del canvas se orquesta desde `canvasItemNode.tsx` para mantener `editorCanvas.tsx` declarativo y con menor complejidad.
- La lógica de interacción por puntero para `move/resize/rotate` del canvas está desacoplada en `useCanvasTransform.ts`.
- El menú contextual de acciones (`Editar texto`, `capas`, `duplicar`, `eliminar`) está centralizado en `canvasItemContextMenu.tsx`.
- En `canvasItemNode.tsx`, tanto `TEXT/BIBLE` como `MEDIA` usan trigger DOM directo para `canvasItemContextMenu`, asegurando apertura consistente con click derecho en todos los tipos de item.
- Las acciones de item (`Subir/Bajar capa`, `Duplicar`, `Eliminar`) se ejecutan desde el context menu del item en canvas (no desde una barra superior dedicada), reduciendo ruido visual en el header.
- Un slide puede quedar temporalmente sin items (`items: []`): eliminar el último item ya no forza recreación automática en el editor.
- El contenedor visual común de los items se centraliza en `canvasItemShell.tsx` y lo reutilizan `textCanvasItem` y `mediaCanvasItem`.
- `CanvasItemShell` usa `outline`/`shadow` para estados visuales (selección, hover, snap target) en lugar de borde persistente, evitando alterar la geometría efectiva del item y eliminando separaciones al hacer snap a los bordes.
- Historial de cambios con pausa de captura durante drag/resize/rotate.
- Guardado normalizando shape legacy + `items[]` para persistencia en presentations.
- Las miniaturas del carrusel normalizan estilos del canvas (`left/top/width/height`) a valores relativos (%) para que texto/media se previsualicen con proporción correcta en tamaños pequeños.
- La normalización de miniaturas aplica clamp de bordes para evitar gaps visuales cuando un item está prácticamente a pantalla completa (snap cercano a 0/100%).
- Las miniaturas del carrusel se renderizan sobre viewport base (`1280x720`) y se escalan al ancho de tarjeta para que tamaño de texto/media mantenga la misma relación visual que en el canvas.
- En carrusel, `PresentationView` recibe `presentationHeight/maxHeight = 720` para usar el mismo baseline de cálculo de escala tipográfica que el canvas del editor.
- En carrusel, `PresentationView` también recibe `customAspectRatio = "1280 / 720"` para alinear el cálculo relativo con el viewport base del canvas.
- La tarjeta de carrusel evita footer externo de texto (que alteraba altura visual): el label de diapositiva se renderiza como overlay dentro de la miniatura para mantener dimensiones consistentes.

## Convenciones y guardrails

- Texto UI en español; identificadores y tipos en inglés.
- No usar `dangerouslySetInnerHTML` sin sanitización (`sanitizeHTML`).
- Evitar `useEffect` para estado derivado de props salvo listeners/side-effects reales.
- Mantener `index.tsx` como orquestador; lógica de negocio nueva debe ir a hooks.
- Cualquier cambio en este módulo debe actualizar este `agents.md`.

## Nota reciente

- La selección de `Tema global` ahora se hace con un dialog `ThemePicker` con buscador y previews visuales.
- La edición inline en canvas queda habilitada solo para items `TEXT`; los items `BIBLE` no permiten escritura manual.
