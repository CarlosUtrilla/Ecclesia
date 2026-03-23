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
│   ├── textTabContent.tsx                 # Contenido de la pestaña "Texto" (texto/biblia/media)
│   ├── animationTabContent.tsx            # Contenido de la pestaña "Animar"
│   ├── insertTabContent.tsx               # Contenido de la pestaña "Insertar"
│   └── sortableSlideCard.tsx              # Miniatura sortable para carrusel
├── hooks/
│   ├── usePresentationEditorHistory.ts    # Undo/redo con snapshots
│   ├── usePresentationEditorShortcuts.ts  # Delete/Duplicate/Undo/Redo + Copy/Paste globales
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
- `components/textTabContent.tsx`: encapsula los controles de inspector de la pestaña `Texto` para mantener `index.tsx` liviano.
- `components/textTabContent.tsx`: incluye controles compartidos de efectos (`Sombra`, `Contorno`, `Fondo`) reutilizados desde `app/screens/editors/components/textEffectsControls.tsx`.
- `components/animationTabContent.tsx`: encapsula la configuración de animaciones de item y transición por slide.
- `components/insertTabContent.tsx`: encapsula acciones de inserción (texto, biblia, media).
- `hooks/*`: lógica reutilizable y estado derivado (acciones, historial, shortcuts, snapping).
- `utils/*`: transformaciones puras de datos y helpers de serialización/parsing.

## Flujos clave

- Inserción de contenido (`Texto`, `Biblia`, `Media`) en la diapositiva seleccionada.
- Inserción de formas (`Rectángulo`, `Círculo`, `Flecha`, `Flecha de línea`, `Triángulo`, `Línea`, `Cruz`) en la diapositiva seleccionada como items `SHAPE`, usando el mismo sistema de drag/resize/rotate y capas del canvas.
- Punto único de inserción desde el menú `Insertar` (evita duplicar acciones en toolbar de texto).
- La opción de media en `Insertar` está etiquetada para indicar origen desde biblioteca (más explícita para usuario).
- El menú Insertar incluye la acción Importar Canva (MP4/ZIP): permite seleccionar múltiples archivos .mp4 y/o .zip exportados desde Canva; extrae videos .mp4 desde ZIP en temporales, crea una carpeta en Media por ZIP con nombre base del archivo (si existe, usa sufijo incremental "(1)", "(2)", ...), importa cada video y crea automáticamente una diapositiva MEDIA por cada archivo importado.
- Las diapositivas MEDIA creadas/actualizadas desde importación Canva se normalizan como full-bleed (100% del slide) para que el video ocupe todo el lienzo al importar.
- Cada slide importada desde Canva persiste metadatos `canvaSourceKey` + `canvaSlideNumber` (número detectado del nombre de archivo, ej. `1.mp4`, `2.mp4`). En reimportaciones del mismo source key, el editor actualiza la diapositiva existente que coincide por número aunque el usuario haya insertado slides intermedias; los números nuevos sin match se agregan al final.
- El editor escucha el evento IPC `media-saved` y refresca su query local de media para resolver inmediatamente los `mediaId` recién importados (evita slides en blanco por cache desactualizada).
- Atajos de clipboard en editor: `Ctrl/Cmd + C` copia el item seleccionado al portapapeles interno del editor y `Ctrl/Cmd + V` lo pega en la diapositiva activa como nuevo item (nuevo `id`, `layer` superior y leve offset para feedback visual).
- El canvas permite selección múltiple de items con `Cmd/Ctrl + click`; el copy/paste del editor aplica sobre toda la selección activa y al pegar mantiene orden relativo con capas consecutivas.
- Cuando el foco está en un `contenteditable` del canvas, `Ctrl/Cmd + C` mantiene copia nativa si hay texto realmente seleccionado; si no hay selección de texto, se interpreta como copia del item seleccionado.
- El editor maneja evento global `paste`: si el portapapeles contiene una imagen (`image/*`), la importa automáticamente a Media (`window.mediaAPI.importFile` + `window.api.media.create`) y la inserta como item `MEDIA` en la diapositiva activa.
- Si la imagen pegada no expone ruta de archivo (caso común al copiar desde WhatsApp Web/navegador), el editor usa importación por bytes de portapapeles (`window.mediaAPI.importClipboardImage`) para permitir pegado desde apps externas.
- El menú contextual de items del canvas incluye acciones explícitas `Copiar` y `Pegar` además de `Duplicar`/`Eliminar`.
- Carrusel inferior de diapositivas en formato compacto (`w-36`) para priorizar el espacio útil del canvas.
- Cada diapositiva soporta nombre opcional (`slideName`), editable desde el menú contextual de la miniatura (`Renombrar diapositiva`) mediante un diálogo propio del editor y persistido al guardar la presentación.
- El carrusel inferior incluye slots de inserción entre diapositivas (y al inicio) que muestran en hover el botón `Añadir diapositiva aquí`, insertando una slide nueva en la posición exacta.
- Cada miniatura de slide en el carrusel expone menú contextual (`click derecho`) con acciones `Duplicar diapositiva` y `Eliminar diapositiva`.
- El menú contextual de miniaturas evita selección implícita al abrirse (no dispara automáticamente la primera acción en click derecho).
- Al ejecutar acciones del menú contextual de miniaturas (`Duplicar`/`Eliminar`), el menú se cierra inmediatamente para mantener UX consistente.
- Al duplicar una diapositiva se generan nuevos IDs para `slide` e `items[]` y se limpian metadatos de Canva (`canvaSourceKey`, `canvaSlideNumber`) para evitar conflictos en reimportaciones.
- Al cerrar la ventana desde Electron, el editor intercepta `presentation-close-requested`: si no hay cambios pendientes confirma cierre inmediato; si hay cambios sin guardar muestra un diálogo con `Cancelar`, `Salir sin guardar` y `Guardar y salir`. Si el título aún está vacío, deriva primero al diálogo de guardado.
- Atajo `Del/Backspace`: cuando el foco/hover está en el carrusel de slides, elimina la diapositiva seleccionada; fuera del carrusel mantiene el comportamiento de eliminar item de canvas.
- El área inferior del carrusel incluye control de zoom del canvas (`50%` a `200%`) con slider, botones `+/-` y reset rápido a `100%`.
- Las formas seleccionadas exponen controles en la pestaña de propiedades: `Texto interior`, presets rápidos (`Énfasis`, `Advertencia`, `Marco`, `Oscuro`), `Relleno`, `Borde`, `Grosor del borde`, `Opacidad` y estilo básico del texto.
- Al redimensionar con `Shift` presionado, el editor conserva la relación de aspecto original para formas, media y bloques de texto. En items textuales, además recalcula `fontSize` proporcionalmente al nuevo tamaño del contenedor para mantener la escala visual.
- Resize textual invertido: en items de texto (`TEXT/BIBLE/SONG/GROUP`) el comportamiento proporcional con escalado de `fontSize` ahora es el default **sin** `Shift`; al mantener `Shift` se activa resize libre (equivalente al comportamiento previo sin `Shift`). En `MEDIA/SHAPE` se mantiene la convención tradicional (`Shift` para proporcional).
- Handles laterales especiales en texto: al redimensionar con `left/right` en `TEXT/BIBLE/SONG/GROUP`, solo cambia el ancho del contenedor (sin escalar `fontSize`), incluso en el modo proporcional por defecto.
- Handles de eje especiales en texto: al redimensionar con `left/right/top/bottom` en `TEXT/BIBLE/SONG/GROUP`, solo cambia la dimensión del eje correspondiente (sin escalar `fontSize`) y sin forzar proporcionalidad.
- Resize proporcional en esquinas refinado: el cálculo elige automáticamente el eje (ancho/alto) con menor error respecto al puntero para evitar saltos bruscos de tamaño y mantener el handle visual más cercano al cursor durante el drag.
- Al montar el editor, el zoom inicial se calcula automáticamente para que el canvas ocupe el **90%** del contenedor disponible (mide `previewAreaRef` con `getComputedStyle` + `clientWidth/Height`, descuenta paddings del contenedor y del wrapper `p-2`, toma el menor ratio ancho/alto y lo escala a 90%, redondeado al múltiplo de 5 más cercano).
- Además del slider, el canvas permite zoom directo con `Ctrl/Cmd + rueda` para acercar/alejar rápidamente durante edición.
- La franja inferior distribuye carrusel y zoom en una sola línea (carrusel a la izquierda con scroll horizontal + bloque de zoom a la derecha) para mejorar legibilidad y uso del espacio.
- El canvas usa viewport base fijo en px (`1280x720`) y aplica zoom con escalado relativo (`transform: scale`) sobre ese viewport; así se preservan proporciones, aspect ratio y crecimiento uniforme del contenido.
- El cálculo de interacción en canvas (drag, resize, rotate, snapping y posición de puntero) es zoom-aware: normaliza deltas/coords por escala para mantener precisión en cualquier nivel de zoom.
- Las guías de snapping de centro y bordes usan siempre coordenadas base del canvas (sin reescalar `clientWidth/clientHeight`) para evitar desfase al trabajar con zoom distinto de `100%`.
- El umbral de snapping (move y resize) se ajusta en función del zoom (`threshold / scale`) para mantener una sensibilidad visual homogénea en pantalla.
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
- Inserciones de `TEXT/BIBLE` calculan tamaño inicial según contenido (ancho y altura) para que el contenedor nazca ajustado al texto y no como caja amplia por defecto.
- Inserciones de `TEXT/BIBLE` se crean centradas en el canvas base (1280x720) con altura autoajustada.
- Inserción de `BIBLE` sin tema: el bloque inicial se crea centrado ocupando el `90%` del ancho y `90%` del alto del canvas para facilitar edición rápida a pantalla completa.
- Cuando existe `themeId` activo, las inserciones de `TEXT/BIBLE` pueden iniciarse con layout derivado de `theme.textStyle` (posición, contenedor y escala tipográfica/efectos) convertido del baseline de tema al canvas del editor para mantener paridad visual con el render final.
- En inserción bíblica theme-aware, si el indicador del verso está desacoplado (`underText`, `overText`, `upScreen`, `downScreen`), el cálculo inicial fusiona los bounds del texto con los del indicador para que el contenedor final cubra ambos bloques.
- Para esa fusión, `underText/overText` usa continuidad exacta sin gap artificial y la altura del indicador se estima en DOM con tipografía real del tema (font/line-height/letter-spacing), replicando el comportamiento visual de `PresentationView`.
- Las diapositivas nuevas ahora nacen vacías (sin item de texto por defecto).
- Al insertar cualquier elemento desde la pestaña `Insertar` (texto, biblia, media o shape), el inspector cambia automáticamente a la pestaña `Texto` para editar de inmediato el elemento agregado/seleccionado.
- El selector bíblico permite seleccionar múltiples versos contiguos por rango (click para inicio y `Shift+click` para extender el final).
- El selector bíblico del PresentationEditor ahora hace auto-scroll al primer verso seleccionado cuando la selección cambia por búsqueda (`Libro Capítulo:Verso`) o cambio de capítulo, alineando UX con el buscador bíblico de biblioteca.
- El picker muestra referencia seleccionada con versión (`Libro capítulo:versoInicio-versoFin (versión)`) antes de agregar.
- En `textCanvasItem`, los items bíblicos con rango muestran un micro-control dentro del recuadro (anterior/siguiente) para previsualizar y ajustar posición/estilo verso por verso durante la edición.
- El contador de ese micro-control es relativo al rango seleccionado (ej. `1/3`, `2/3`, `3/3`), no al número absoluto de verso bíblico.
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
- Cada slide permite configurar `backgroundColor` opcional desde la barra superior; este color sobrescribe solo el fondo de esa diapositiva y, si el tema base usa media, lo reemplaza por color sólido para ese slide.
- El selector `Video en live` usa icono de rayo (`Zap`) junto al label para mejorar descubrimiento visual de la configuración de reproducción en vivo.
- En la pestaña `Texto`, cuando el item seleccionado es un video, el editor expone un toggle `Repetición` ligado a `slide.videoLoop`; las nuevas slides de video y las importaciones de Canva nacen con repetición desactivada.
- La toolbar del editor incluye selector de `Tema global` para aplicar un `themeId` común a todas las diapositivas; también ofrece `Sin tema` para quitar el tema global.
- Las nuevas diapositivas creadas desde el editor heredan automáticamente el `themeId` global seleccionado al momento de insertarse.
- Los items bíblicos del canvas respetan configuración global de biblia vía `BibleTextRender` (`useDefaultBibleSettings`).
- El render no-edit del canvas envuelve estos componentes con `LazyMotion` + `domAnimation` para habilitar correctamente los nodos `m.*` de Framer Motion fuera de `PresentationView`.
- El flujo de edición inline resetea explícitamente estado interno de entrada/salida (`wasEditingRef`) para evitar pérdida visual del contenido al deseleccionar y volver a editar.
- La escritura inline en `textCanvasItem` está optimizada con debounce suave (~100ms) y `flush` inmediato en `Enter`, `Escape` y `blur`, reduciendo lag al teclear sin perder cambios.
- La query de carga inicial del editor (`['presentation', id]`) desactiva `refetchOnWindowFocus`; al volver a enfocar la ventana no debe recargar desde DB ni hacer `reset(...)`, para preservar cambios locales no guardados y evitar reinicio visual del canvas/presentación.
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
- La activación de edición por doble click en `TEXT` usa sincronización local de selección en `EditorCanvas` para evitar que el modo edición se cancele por race condition al cambiar de item.
- La entrada a modo edición en `TEXT` también se dispara por `click.detail >= 2` para mantener compatibilidad con el flujo de drag por `pointer capture` del canvas.
- Para convivir con edición por doble click, el drag `move` en canvas se activa con umbral de desplazamiento (no en `pointerdown` inmediato), evitando conflicto entre clic/edición y arrastre.
- En items `TEXT` editables, el `pointerdown` no inicia arrastre de movimiento; se prioriza edición inline por doble click para evitar bloqueos de entrada a edición.
- Para conservar movimiento de items `TEXT` sin romper la edición inline, el arrastre se habilita con `Alt + drag` sobre el texto.
- En `textTabContent.tsx`, el componente `BibleReferenceEditor` tiene ahora un select de libros (reemplazó al input numérico). El select muestra todos los libros disponibles del `bibleSchema` permitiendo selección rápida sin necesidad de conocer el ID numérico del libro.
- En edición inline de `TEXT`, al perder foco temporal por interacción con el inspector, el editor conserva la selección de texto (save/restore de `Range`) y no sale automáticamente del modo edición.
- Los controles tipográficos de `textTabContent.tsx` (`Fuente`, `Tamaño`, `Estilo`, `Color`, `Espaciado`) intentan aplicar cambios a la selección activa del `contenteditable`; si no hay selección válida, mantienen el comportamiento previo de aplicar el estilo al item completo.
- Se agregó utilidad dedicada `utils/textSelection.ts` con pruebas `utils/textSelection.test.ts` para cubrir selección activa, aplicación de estilos inline y reutilización de selección guardada tras pérdida de foco.
- `textCanvasItem.tsx` mantiene la definición explícita de `activeEditorVerse` y `verseProgress` fuera de efectos, evitando errores de referencia en runtime (`activeEditorVerse is not defined`) cuando se renderizan controles de navegación de versos.
- Al aplicar color/estilos desde el inspector con foco fuera del `contenteditable` (ej: drag sostenido en `ColorPicker`), `textSelection` actualiza solo la selección interna guardada y evita tocar `window.getSelection()`, previniendo cierre prematuro del popover por robo de foco.
- `textSelection` prioriza siempre una selección no colapsada: si `window.getSelection()` está colapsada (caso típico al interactuar con controles del inspector), reutiliza `lastSavedSelection` para aplicar estilos al fragmento correcto sin caer al fallback de estilo global.
- La toolbar de `textTabContent.tsx` sincroniza estado con la selección activa del `contenteditable` (negrita/cursiva/subrayado/color/tamaño). Si la selección contiene estilos mezclados, el control se comporta en modo mixto (sin marcar un valor único), similar a editores de texto convencionales.
- El color detectado desde selección para la toolbar se normaliza a `hex` (ej: `#ff0000`) para mantener compatibilidad y estabilidad del `ColorPicker` durante interacción continua.
- Tras aplicar estilo a una selección desde toolbar/inspector, `textSelection` sincroniza también la selección DOM (sin forzar focus), de modo que el fragmento permanece visualmente seleccionado y no se pierde el feedback de selección en texto virgen.
- Estrategia híbrida de foco/selección: en toggles de estilo (`Negrita/Cursiva/Subrayado`) se previene `mousedown` por defecto para no robar foco del editor y mantener la selección visual; en `ColorPicker`, cuando el foco pasa al inspector, `textSelection` evita sincronizar selección DOM para no cerrar el popover durante drag.
- `usePresentationEditorActions.ts` incorpora un mapper de `theme.textStyle` -> `customStyle` de canvas (`BASE_PRESENTATION_*` -> `BASE_CANVAS_*`), incluyendo `fontSize`, offsets, contenedor útil y escalado de efectos (`shadow/stroke/block`) para que texto insertado desde tema mantenga proporciones en el editor.
- `usePresentationEditorActions.ts` también unifica bounds texto+verso mediante `mergeBoundsWithVerse` al insertar `BIBLE`, contemplando offset de borde (`positionStyle`) y ancho/translate horizontal del indicador (`verseWidthPercent`, `verseTranslateX`).
- Existe prueba de regresión en `hooks/useCanvasSnapping.test.tsx` que valida snap al centro con zoom `1x` y `2x`.
