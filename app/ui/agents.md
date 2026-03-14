# UI Components Agent

> **Agent router:** [`/agents.md`](../../agents.md)

## Descripcion

Componentes UI compartidos de la aplicacion. Incluye el componente central `PresentationView` (renders de presentacion), componentes Shadcn UI personalizados y utilidades de interfaz.

Tambien considera la configuracion de tema global en `app/assets/globals.css`; se ajusto el modo oscuro para mejorar contraste y legibilidad (fondos menos oscuros y texto secundario mas claro), y se reforzo el token `--secondary` para que destaque mas visualmente en dark mode.

## Archivos

```text
app/ui/
├── PresentationView/
│   ├── index.tsx                       # PresentationView: componente principal de presentacion
│   ├── types.d.ts                      # Tipos: PresentationViewProps, PresentationViewItems, ThemeWithMedia
│   ├── components/
│   │   ├── AnimatedText.tsx            # Render genérico de texto animado (sin lógica bíblica)
│   │   ├── BibleTextRender.tsx         # Render específico para biblia (referencia + versión + configuración)
│   │   ├── PresentationRender.tsx      # Render por capas para PRESENTATION (items mixtos + animación por item)
│   │   ├── ResourceContent.tsx         # Render por tipo de recurso (PRESENTATION/BIBLE/TEXT)
│   │   ├── LiveThemeTransitionShell.tsx # Wrapper de transición de tema en modo live
│   │   ├── LiveSlideTransitionShell.tsx # Wrapper de transición de slide en modo live
│   │   ├── PresentationFrame.tsx       # Estructura compartida del frame (capas + interacción)
│   │   ├── PresentationBody.tsx        # Composición de capas (fondo, contenido, tag) para preview/live
│   │   ├── BackgroundImage.tsx         # Fondo de imagen animado (m.img)
│   │   ├── BackgroundVideoLive.tsx     # Fondo de video en vivo (m.video + m.img fallback)
│   │   └── BackgroundVideoThumbnail.tsx # Thumbnail de video para preview (m.img)
│   └── hooks/
│       ├── useBibleSetting.tsx         # Hook para config de presentacion de biblia
│       ├── usePresentationSizing.ts    # Medición de contenedor + screenSize
│       ├── usePresentationBackground.ts # Derivación de fondo/media y estado de video
│       ├── usePresentationTextLayout.ts # Escalado de texto, offsets, bounds, shadow, stroke y blockBg
│       └── useTextBoundsInteraction.ts # Interacción drag/resize del cuadro de texto editable + snap-to-center
│   └── utils/
│       └── parseAnimationSettings.ts   # Parse robusto de JSON de animaciones con defaults
├── renderSongLyricList.tsx             # Lista de letras de cancion con tags de color
├── colorPicker.tsx                     # Color picker con ChromePicker
├── fontFamilySelector.tsx              # Selector de fuentes del sistema
├── virtualized-scroll-area.tsx         # Scroll virtualizado con @tanstack/react-virtual
├── pagination.tsx                      # Paginacion (Shadcn)
│
│   # Shadcn UI components (auto-generados, raramente modificados)
├── alert.tsx
├── autocomplete.tsx
├── badge.tsx
├── button.tsx
├── card.tsx
├── checkbox.tsx
├── combobox.tsx
├── command.tsx
├── context-menu.tsx
├── dialog.tsx
├── dropdown-menu.tsx
├── input.tsx
├── label.tsx
├── popover.tsx
├── progress.tsx
├── resizable.tsx
├── scroll-area.tsx
├── select.tsx
├── separator.tsx
├── sheet.tsx
├── sidebar.tsx
├── skeleton.tsx
├── slider.tsx
├── sonner.tsx
├── spinner.tsx
├── switch.tsx
├── table.tsx
├── tabs.tsx
├── textarea.tsx
└── tooltip.tsx
```

## PresentationView (Componente central)

El componente mas importante de la aplicacion. Renderiza un slide de presentacion con fondo, texto animado y tags de cancion.

### Props (`types.d.ts`)

```typescript
interface PresentationViewProps {
  items: PresentationViewItems[]     // Array de slides
  theme: ThemeWithMedia              // Tema con estilos y fondo
  live?: boolean                     // true = modo live (video activo), false = preview (thumbnail)
  currentIndex?: number              // Indice del slide actual
  onClick?: () => void               // Handler de click
  selected?: boolean                 // Resaltado de seleccion
  tagSongId?: number                 // ID del tag para mostrar barra de color inferior
  className?: string
  style?: React.CSSProperties
  displayId?: string                 // ID del display para calcular aspect ratio
  customAspectRatio?: string         // Aspect ratio opcional (ej. "16 / 9") para forzar cálculo relativo
}

interface PresentationViewItems {
  text: string                       // Contenido HTML del slide
  videoLiveBehavior?: 'auto' | 'manual' // Preferencia por diapositiva para reproducción de video en live
  media?: { duration?: number | null }   // Metadata opcional para fallback de duración en controladores live
  verse?: {                          // Datos de versiculo (opcional)
    bookId: number
    chapter: number
    verse: string
    verseEnd?: number
    version: string
  }
}

type ThemeWithMedia = Themes & {
  backgroundMedia?: Media | null
  biblePresentationSettings?: BiblePresentationSettings | null
}
```

### Arquitectura interna

```text
PresentationView (index.tsx)
  └── LazyMotion features={domAnimation}   <- Wrapper para optimizar bundle
        ├── AnimatePresence                 <- Transicion de fondos
        │     ├── BackgroundImage           <- Fondo de imagen (m.img)
        │     ├── BackgroundVideoThumbnail  <- Thumbnail de video (preview)
        │     └── BackgroundVideoLive       <- Video en vivo (m.video)
        │
        ├── AnimatePresence mode="wait"     <- Transicion de contenido
        │     ├── PresentationRender         <- Flujo dedicado para resourceType PRESENTATION
        │     ├── BibleTextRender            <- Texto bíblico con referencia configurable
        │     └── AnimatedText               <- Texto animado genérico (SONG/otros)
        │
        └── Tag bar (opcional)              <- Barra de color inferior con nombre del tag
```

- `PresentationRender` interpreta `presentationItems` ordenados por `layer` y aplica `animationSettings` por item para entradas independientes.
- En `PresentationRender`, los layers de texto se renderizan mediante `AnimatedText` (preview y live), en lugar de HTML crudo, para mantener consistencia de sanitización, alineación y animación con el resto del sistema.
- En `PresentationRender`, cuando un layer es bíblico (`resourceType: 'BIBLE'`) y contiene rango, el texto se resuelve con el verso activo provisto por `presentationVerseBySlideKey`, manteniendo un único slide lógico con contenido dinámico.
- Los layers bíblicos de `PRESENTATION` usan `BibleTextRender` para respetar la configuración de ubicación/formato del versículo: primero configuración global (`useDefaultBibleSettings`), y si el tema de la diapositiva define settings propios, se usan esos.
- En `PresentationRender`, los layers de texto heredan `textStyle` desde `usePresentationTextLayout` y aplican overrides de `customStyle`; para tipografía por layer (`font-size`, `line-height`, `letter-spacing`), la escala se normaliza al baseline real `1280x720` del editor de presentaciones, evitando sobreescalado por diferencias de baseline histórico.
- En `PresentationRender` (live), los layers `MEDIA` de tipo video usan sincronización por `live-media-state` (`window.liveMediaAPI.onMediaState`) para que controles externos (panel live) puedan reproducir/pausar/reiniciar también videos embebidos en diapositivas de presentación.
- En `PresentationView/index.tsx`, el branch no-`PRESENTATION` separa `BIBLE` (con `BibleTextRender`) de `SONG/otros` (con `AnimatedText` genérico).
- `PresentationView` aplica transición por slide con `items[n].transitionSettings` (default `fade`) al cambiar `currentIndex`.
- En `live`, la transición por slide usa capas superpuestas (`AnimatePresence mode="sync"`) para que el item entrante y saliente se animen al mismo tiempo, evitando frames negros entre items.
- Cuando live pasa de estado vacío a primer item, la transición de slide aplica animación de entrada inicial (no se suprime `initial`) para evitar aparición brusca.
- `PresentationView` admite `presentationVerseBySlideKey` para controlar el verso activo por slide sin cambiar `currentIndex`.
- `PresentationView` también soporta transición por cambio de tema con `theme.transitionSettings` + `themeTransitionKey` (default `fade`).
- `PresentationView` interpreta `theme.textStyle.justifyContent` para alineación vertical del bloque de texto (`flex-start`/`center`/`flex-end`); si no existe, usa centrado por defecto.
- `PresentationView` prioriza `presentationHeight`/`maxHeight` cuando se proveen (por ejemplo en previews embebidos), y usa `ResizeObserver` como fallback para calcular `screenSize`.
- `PresentationView` acepta `customAspectRatio` opcional para forzar el cálculo interno de `screenSize` (ancho/alto relativos) con una relación específica en previews o contenedores controlados.
- La medición de altura en `PresentationView` usa `useResizeObserver` con `box: 'border-box'` y estabiliza el valor reutilizando la última altura válida cuando el observer reporta `0` temporalmente.
- Para evitar saltos de escala durante transiciones (`AnimatePresence`), `PresentationView` conserva la última altura no-cero observada del contenedor y la reutiliza cuando el observer reporta `0` temporalmente.
- En modo `live`, la estabilización de altura está simplificada en un solo efecto: primero usa `ResizeObserver` y, si arranca en `0`, hace medición directa de `containerRef.getBoundingClientRect().height` con un ciclo corto en `requestAnimationFrame` hasta obtener un valor válido.
- El render de fondo (imagen/video/color) vive fuera del contenedor animado por slide; así, cambiar texto/slide no desmonta ni recarga el fondo en `live`.
- El estado de fondo/video solo se reinicia cuando cambia la fuente real del fondo (`background`, `backgroundMedia.filePath`, `thumbnail`, `fallback`), evitando flashes negros por cambios de objeto sin cambio real de asset.
- La transición de tema en `PresentationView` usa `AnimatePresence` en `mode="sync"` con capas superpuestas (`absolute inset-0`) para evitar frames vacíos/negros entre salida y entrada.
- En live, la primera entrada de contenido también ejecuta la transición de tema configurada (no se suprime `initial` en la shell de tema), para evitar aparición brusca al pasar de vacío a item.
- La animación del tema entrante se aplica tanto al `enter` como al `exit` (cross animation), de modo que el tema saliente y el entrante comparten el mismo patrón de transición configurado en el nuevo tema.
- En transiciones de tema tipo slide/zoom/scale en `live`, se fuerza `opacity: 1` durante `initial/animate/exit` para impedir que aparezca fondo negro entre capas animadas.
- `PresentationView` soporta `hideTextInLive` para ocultar solo capas textuales en modo `live` (SONG/BIBLE/TEXT y layers textuales de `PRESENTATION`) manteniendo capas de media y fondo.
- En `AnimatedText`, el modo `hideTextInLive` nunca debe retornar antes de completar hooks; la ocultación se resuelve después de declarar hooks para evitar errores de React por orden de hooks.
- `PresentationView` tiene dos paths de render: `live` (completo, con transiciones y video en reproducción) y `preview` (`!live`) estático, sin `AnimatePresence` ni wrappers `m.*` a nivel raíz/slide.
- Para slides con `resourceType: PRESENTATION`, `PresentationView` aplica `effectiveTheme`: usa `item.theme` si existe (override explícito por slide) y, si no existe, fuerza `BlankTheme` (fondo blanco) en lugar de heredar el tema global; esta regla aplica tanto en `live` como en `preview` (`!live`).
- En `preview` (`!live`), `PresentationView` muestra un badge superior derecho para rangos bíblicos (`vX-Y`) cuando el item o un layer bíblico de `PRESENTATION` incluye `verseEnd`; así se identifica rápido que esa tarjeta representa un rango.
- En cambios de verso interno (`presentationVerseBySlideKey`), `PresentationView` mantiene estable el key del slide live para evitar re-animar capas no bíblicas; solo el layer bíblico actualiza/animación su contenido.
- Cuando cambia el verso interno, el layer bíblico se remonta con key por verso para re-disparar su animación configurada sin afectar la animación de los demás layers del mismo slide.
- `usePresentationTextLayout` procesa campos personalizados de `theme.textStyle` (eliminándolos antes de pasarlos al DOM): sombra (`textShadowEnabled/Color/Blur/OffsetX/OffsetY`), contorno (`textStrokeEnabled/Color/Width` → CSS `-webkit-text-stroke` escalado) y fondo de bloque (`blockBgEnabled/Color/Blur/Radius` → retorna `blockBgStyle: CSSProperties | null`). El `blockBgStyle` se propaga por toda la cadena (`PresentationBody` → `ResourceContent` → `AnimatedText`, `BibleTextRender`, `PresentationRender`) y se aplica en el wrapper interno `<div style={{ width: '100%', ...blockBgStyle }}>` de `AnimatedText`.
- `ThemeToolbar` expone tres Popovers de efectos de texto: **Sombra** (`Blend`), **Contorno** (`PenLine`, controla `textStrokeEnabled/Color/Width`) y **Fondo** (`Layers`, controla `blockBgEnabled/Color/Blur/Radius`).
- En `preview`, los videos (fondo y capas de presentación) no se reproducen: se renderizan thumbnails estáticos para reducir CPU/GPU cuando hay muchas instancias simultáneas.
- Las transiciones de tema/slide (`useMemo` + `AnimatePresence` + `m.div`) se encapsulan en shells solo de `live`, evitando cálculo/instanciación en `preview`.
- En `preview`, fondos de imagen y thumbnails de video usan `<img>` estático (`loading="lazy"`) en lugar de componentes animados, para minimizar costo de render masivo.
- `PresentationView` está memoizado (`React.memo`) con comparación explícita de props para evitar re-renders en cascada cuando se renderiza muchas veces en paralelo.
- El cálculo de variantes de animación se corta en `preview`: usa variantes vacías y tipo `none`, evitando parse/instanciación de animaciones cuando no se van a reproducir.
- La lógica interna de `PresentationView` está separada en hooks de dominio (`sizing`, `background`, `textLayout`) para reducir complejidad del componente principal y aislar cálculos que antes estaban mezclados.
- El JSX duplicado entre `preview` y `live` se consolidó en capas compartidas (`backgroundLayer`, `contentLayer`, `tagSongLayer`) y un `viewContent` único; la diferencia entre modos queda solo en el wrapper de transición.
- El render por tipo de recurso (`PRESENTATION`/`BIBLE`/texto genérico) se extrae a `ResourceContent` dentro del módulo para acortar el flujo principal y hacer más visible la orquestación de capas.
- El frame visual e interacción base del contenedor (`role`, teclado, padding por tag y montaje de capas) está en `PresentationFrame`, dejando `index.tsx` centrado en composición/orquestación.
- La construcción de capas compartidas (`backgroundLayer`, `contentLayer`, `tagSongLayer`) se movió a `PresentationBody`, por lo que `index.tsx` solo coordina hooks, props y wrappers de modo.
- `PresentationBody` y `ResourceContent` están memoizados con comparadores explícitos para reducir re-renders en cascada cuando no cambian props efectivas.

### Logica de fondos

El campo `theme.background` determina el tipo:

- **Color/Gradient**: Se aplica directamente como `background` CSS.
- **`"media"`**: Usa `theme.backgroundMedia` para determinar si es imagen o video.
  - Imagen: `BackgroundImage` (fade in/out con `m.img`).
  - Video (preview): `BackgroundVideoThumbnail` (muestra thumbnail estatico).
  - Video (live): `BackgroundVideoLive` (reproduce video + fallback image mientras carga).

### AnimatedText (`components/AnimatedText.tsx`)

Renderiza texto genérico del slide con animaciones:

- API estricta: solo recibe props de render/texto y edición de bounds del bloque principal; no recibe props bíblicas (`bibleVerseIsSelected`, `onBibleVersePositionChange`) ni de settings de biblia.

- El contenedor del texto aplica padding configurable por tema (`textStyle.paddingInline` y `textStyle.paddingBlock`), permitiendo ajustar márgenes desde el editor de temas.
- El contenedor también admite desplazamiento configurable mediante `textStyle.translate` (string CSS) para mover el bloque de texto en ambos ejes.
- El cálculo de `fontSize`/`padding` en `PresentationView` acepta números y strings con unidad (ej. `"64px"`) usando parseo robusto; así evita `NaNpx` y discrepancias de tamaño entre editor y salida live.
- Márgenes y desplazamiento se escalan por eje para mantener consistencia visual entre previews pequeños y pantallas grandes: valores horizontales (`paddingInline`, `translateX`) en función del ancho, y verticales (`paddingBlock`, `translateY`) en función del alto.
- El recálculo de estos valores depende explícitamente de cambios en ancho y alto del viewport renderizado para evitar desalineaciones al redimensionar o cambiar de display.
- Soporta guía visual opcional del área de texto (`showTextBounds`) para mostrar el contenedor efectivo con borde punteado en modos de edición/preview.
- La visibilidad/interacción de esa guía también depende de `textBoundsIsSelected`; esto permite usar el mismo componente en editores donde el cuadro solo se muestra cuando está seleccionado.
- La selección del bloque editable puede hacerse directamente con click sobre el texto, reutilizando el mismo flujo de selección/edición en `AnimatedText`.
- El contenedor principal del texto ocupa toda el área renderizable y alinea verticalmente el contenido según `verticalAlign` (`top`/`center`/`bottom`), con default `center`.
- En modo edición, la guía visual del área de texto es interactiva: permite mover el cuadro arrastrando y redimensionarlo desde bordes (izquierdo/derecho/superior/inferior), emitiendo cambios de `paddingInline`, `paddingBlock` y `translate` al editor.
- Durante la edición interactiva, el cursor cambia dinámicamente según el borde detectado (`ew-resize` en laterales, `ns-resize` en superior/inferior, `move` en el centro) para dar feedback visual sin mostrar handles.
- Además se muestran handles circulares sobrios en las cuatro esquinas del recuadro para redimensionado diagonal (`nwse-resize` y `nesw-resize`) con precisión estilo editor profesional.
- `AnimatedText` está memoizado (`React.memo`) con comparación de props críticas para reducir re-renders masivos en vistas con muchas instancias.
- El saneado de HTML se memoiza (`sanitizeHTML`) y, en modo `split`, se precomputa por líneas/palabras para evitar repetir saneado en cada render.
- Los estilos estáticos de handles se hoistean fuera del componente para evitar recreación de objetos en cada render.
- La lógica de interacción del cuadro de texto (detectar bordes, drag, resize y cursores) se extrajo a `useTextBoundsInteraction`, dejando `AnimatedText` enfocado en render y composición.
- `useTextBoundsInteraction` incluye snap-to-center magnético: durante el drag (`move`), si `translateX` o `translateY` están a menos de 8px lógicos de 0, se snappean a 0. Se expone `snapGuides: { centerX, centerY }` para que `AnimatedText` renderice líneas guía (teal, 1px) sobre el frame cuando el snap está activo.

- **Preview mode** (`isPreview: true`): Sin animacion, solo `dangerouslySetInnerHTML` con `sanitizeHTML()`.
- **Animacion "split"**: Divide por palabras, cada una animada individualmente con `m.span`.
- **Otras animaciones**: Bloque completo animado con `m.div`.

### BibleTextRender (`components/BibleTextRender.tsx`)

- Encapsula solo la lógica bíblica específica (referencia con libro/capítulo/verso, versión y ubicación según settings).
- Reutiliza `AnimatedText` para el render/base interactiva del bloque de texto y mantiene en este componente solo la edición/posición del verso en modo pantalla.
- Si el contenido entrante del verso ya trae prefijo numérico (`"16. ..."`) y `showVerseNumber` está desactivado, `BibleTextRender` elimina ese prefijo para respetar la configuración visual del tema/global.

### Estado interno de PresentationView

- `mediaType`, `backgroundUrl`, `thumbnailUrl`, `fallbackUrl`: Derivados de `theme.background` y `theme.backgroundMedia` en un solo `useEffect`.
- `videoLoaded`, `videoError`: Estado de carga de video, reseteados junto con los URLs.
- `animationSettings`, `variants`: Parseados de `theme.animationSettings` con `useMemo`.
- `calculatedFontSize`: Proporcional al alto del contenedor via `useResizeObserver`.

## Componentes personalizados (no-Shadcn)

### RenderSongLyricList (`renderSongLyricList.tsx`)

- Renderiza las estrofas de una cancion agrupadas por tag.
- Cada grupo tiene barra lateral de color con `shortName` del tag.
- Click en estrofa selecciona (resalta), doble-click ejecuta accion.
- Keys usan `group-{tagSongsId}-{index}` y `{tagSongsId}-{idx}` (no index puro).
- Accesibilidad: `role="button"`, `tabIndex`, `onKeyDown`.

### ColorPicker (`colorPicker.tsx`)

- Wrapper de `react-color` ChromePicker en un Popover.
- Usa `value` prop directamente (sin estado local, onChange se propaga inmediatamente).

### FontFamilySelector (`fontFamilySelector.tsx`)

- Selector de fuentes del sistema y personalizadas.
- Permite elegir fuentes del sistema detectadas automáticamente.
- Permite subir fuentes personalizadas (`.ttf`, `.otf`) mediante un diálogo visual moderno, que soporta carga múltiple y feedback de éxito/error.
- Elimina fuentes personalizadas con confirmación.
- UI moderna, accesible y responsiva, con separación clara entre fuentes propias y del sistema.
- Usa el componente desacoplado `uploadFontDialog.tsx` para la carga de fuentes.

### UploadFontDialog (`uploadFontDialog.tsx`)

- Componente desacoplado para subir fuentes personalizadas.
- Permite seleccionar varios archivos a la vez.
- Feedback visual de progreso, éxito y error.
- Diseño espacioso, botones grandes y claros, inputs accesibles.
- Se controla desde el selector de fuentes o cualquier otro componente que requiera subir fuentes.

### VirtualizedScrollArea (`virtualized-scroll-area.tsx`)

- Wrapper de `@tanstack/react-virtual`.
- Recibe `items`, `renderItem`, `estimateSize`.
- Componente `VirtualRow` extraido para reconciliacion correcta.

## Utilidades (`app/lib/`)

### utils.ts

- `cn()`: Wrapper de `clsx` + `tailwind-merge`.
- `sanitizeHTML(html)`: Sanitiza HTML para uso seguro con dangerouslySetInnerHTML.
- `getContrastTextColor(bgColor)`: Retorna blanco o negro segun contraste.
- `getGrupedLyrics(lyrics)`: Agrupa letras por tagSongsId.
- `generateUniqueId()`: Genera UUID para ScheduleItem.

### animations.ts

- Define tipos de animacion disponibles: fade, slide, scale, rotate, flip, bounce, blur, zoom, split, none.
- `getAnimationVariants(type, duration, delay, easing)`: Retorna variantes de Framer Motion.
- `wordVariants`: Variantes para animacion palabra-por-palabra.
- `animations[]`: Array con metadata de cada animacion (label, icon, description).

### animationSettings.ts

- `AnimationSettings` type: `{ type, duration, delay, easing }`.
- `defaultAnimationSettings`: Valores por defecto.
- `easingOptions[]`: Opciones de easing disponibles.

### themeConstants.ts

- Constantes de temas (si existen valores por defecto).
- Incluye `BASE_PRESENTATION_HEIGHT` y `BASE_PRESENTATION_WIDTH` como referencias base para escalar tipografía, márgenes y offsets por eje en `PresentationView`.

## Convenciones

- **Framer Motion**: Siempre usar `LazyMotion` + `m` (no `motion` directamente). Ahorra ~30kb de bundle.
- **dangerouslySetInnerHTML**: Solo con `sanitizeHTML()` de `lib/utils.ts`. Necesario para renderizar estrofas con formato HTML.
- **Shadcn components**: No modificar directamente. Si necesitas cambios, extiende con wrapper.
- **Accesibilidad**: Todos los elementos clickeables no-interactivos necesitan `role="button"`, `tabIndex={0}`, `onKeyDown`.
- **prefers-reduced-motion**: Manejado globalmente en `app/assets/globals.css` con media query.
- **Keys de listas**: Usar identificadores estables, nunca index puro. Patron: `{tipo}-{id}-{subIndex}`.

## Agents relacionados

- Contextos que alimentan PresentationView -> `/app/contexts/agents.md`
- Temas y animaciones -> `/app/screens/editors/agents.md`
- Modelos Themes, Media -> `/prisma/agents.md`
- Utilidades en lib/ son transversales a todo el proyecto
