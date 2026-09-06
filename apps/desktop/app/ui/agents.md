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
│   │   ├── TimerRender.tsx             # Render de cuenta atrás (círculo radial que se vacía) para resourceType TIMER
│   │   ├── ResourceContent.tsx         # Render por tipo de recurso (PRESENTATION/BIBLE/TIMER/TEXT)
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
│       ├── parseAnimationSettings.ts   # Parse robusto de JSON de animaciones con defaults
│       ├── composeLiveTransitionVariants.ts # Variantes de cross para las shells live (opaqueLayer)
│       ├── themeTransitionSignature.ts # Firma visual del tema: clave de AnimatePresence
│       └── mediaThemePolicy.ts         # Tema neutro para items MEDIA en live
├── renderSongLyricList.tsx             # Lista de letras de cancion con tags de color
├── UpdateNotification.tsx              # Globo de notificación de actualizaciones disponibles
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
├── menubar.tsx                         # Menubar shadcn (Radix) — barra de menú superior incrustada
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
  videoLoop?: boolean                // Repetición del video de la diapositiva
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

- `PresentationLayerItem` admite `videoLoop?: boolean` para que los layers de video en slides `PRESENTATION` respeten repetición por diapositiva en live.
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
- `PresentationRender` también soporta layers `SHAPE` (`rectangle`, `circle`, `arrow`, `line-arrow`, `triangle`, `line`, `cross`) usando `customStyle` del editor de presentaciones para posicionamiento, color de relleno, borde, opacidad y texto interior.
- En `PresentationRender`, los layers de texto se renderizan mediante `AnimatedText` (preview y live), en lugar de HTML crudo, para mantener consistencia de sanitización, alineación y animación con el resto del sistema.
- En `PresentationRender`, cuando un layer es bíblico (`resourceType: 'BIBLE'`) y contiene rango, el texto se resuelve con el verso activo provisto por `presentationVerseBySlideKey`, manteniendo un único slide lógico con contenido dinámico.
- En `PresentationRender`, los slides/layers bíblicos pueden recibir `chunkParts` (texto largo fragmentado lógico) y renderizan la parte activa controlada por `presentationVerseBySlideKey`, manteniendo una sola diapositiva física.
- Los layers bíblicos de `PRESENTATION` usan `BibleTextRender` para respetar la configuración de ubicación/formato del versículo: primero configuración global (`useDefaultBibleSettings`), y si el tema de la diapositiva define settings propios, se usan esos.
- En `PresentationRender`, los layers de texto heredan `textStyle` desde `usePresentationTextLayout` y aplican overrides de `customStyle`; para tipografía por layer (`font-size`, `line-height`, `letter-spacing`), la escala se normaliza al baseline real `1280x720` del editor de presentaciones, evitando sobreescalado por diferencias de baseline histórico.
- En `PresentationRender` (live), los layers `MEDIA` de tipo video usan sincronización por `live-media-state` (`window.liveMediaAPI.onMediaState`) para que controles externos (panel live) puedan reproducir/pausar/reiniciar también videos embebidos en diapositivas de presentación.
- En `PresentationRender` (live), `LiveSyncedLayerVideo` arranca por sí mismo (`autoPlay` + `play()` en montaje) solo cuando la diapositiva tiene `videoLiveBehavior: 'auto'`; con `'manual'` sigue esperando comandos por `live-media-state`. El comportamiento y el `loop` de la diapositiva se propagan a los layers desde `PresentationRender` (`slideVideoLiveBehavior`, `slideVideoLoop`), porque `mapPresentationItemToLayer` no copia esos campos al layer.
- `LiveSyncedLayerVideo` no puede depender solo del comando `live-media-state`: el controlador lo emite antes de que la ventana live haya montado el video nuevo (el contenido viaja por `liveScreen-update`, cuyo efecto vive en el provider padre y corre después), así que ese `play` se puede perder. Por eso mantiene el estado deseado en `shouldBePlayingRef` y reintenta en `canplay`, `loadeddata` y `focus`; si el estado deseado pasó a pausa, `onPlay` vuelve a pausar para neutralizar el `autoPlay` del elemento.
- `LiveSyncedLayerVideo` usa `preload="auto"` y `poster` con el thumbnail del media, para que la diapositiva no muestre el fondo del tema en blanco mientras el video carga por primera vez.
- Tanto `LiveSyncedLayerVideo` como `MediaRender` ignoran el `seek` implícito de un `play(time=0)` repetido si el video ya avanzó algunos frames, evitando el “brinquito” visual por reinicio cuando llegan reintentos de `play`.
- `MediaRender` está memoizado con comparación por identidad de media (`id`, `filePath`, `thumbnail`, `format`, `customStyle`, `live`, `externalBuildMediaUrl`) para evitar re-renders que no cambian el asset y mejorar continuidad de reproducción en live/stage.
- `MediaRender` acepta `externalBuildMediaUrl` opcional desde `PresentationBody` (que a su vez lo recibe desde `PresentationView`) para que cuando el puerto del media server se resuelva en la ventana live, el cambio de referencia de `buildMediaUrl` se propague a través de los memo layers (`PresentationBody` → `MediaRender`) y el componente re-renderice con la URL válida. Sin este threading, `React.memo` bloqueaba el re-render porque las props directas (`currentItem`, `live`) no cambiaban.
- En `MediaRender` live, el `<video>` no auto-reproduce al montar; espera comandos por `live-media-state` y mantiene `playsInline`, mientras `loop` se controla con `currentItem.videoLoop` para respetar la configuración persistida de la slide.
- En `PresentationView/index.tsx`, el branch no-`PRESENTATION` separa `BIBLE` (con `BibleTextRender`) de `SONG/otros` (con `AnimatedText` genérico).
- `BibleTextRender` permite overrides tipográficos del indicador bíblico con claves `verse*` en `theme.textStyle` (por ejemplo `verseFontFamily`, `verseColor`, `verseFontSize`, `verseTextShadow*`), manteniendo fallback al estilo base cuando no existen.
- `BibleTextRender` evita renderizar `null` como nombre de libro en la referencia bíblica: si el schema aún no resolvió el `bookId` (o hay mismatch de tipo), muestra fallback limpio con `capítulo:verso` hasta resolver el nombre.
- En posiciones `upScreen`/`downScreen`, el indicador bíblico usa por defecto `width: 100%`, centrado y en una sola línea (`white-space: nowrap`) para evitar saltos de línea no deseados en referencias largas; si excede el ancho visible, se recorta con `ellipsis`.
- `BibleTextRender` puede auto-dividir texto bíblico largo de slides de presentación cuando llega en un solo bloque (sin `<br/>` ni `\n`), usando `splitLongBibleVerse` + `resolveBibleChunkMaxLength`; si el contenido ya viene dividido o contiene HTML, se respeta el texto original.
- En ThemeEditor, ese indicador también puede reducir su ancho horizontalmente y desplazarse en X con el mismo motor de bounds del texto; los valores se persisten en `theme.textStyle.verseWidthPercent` y `theme.textStyle.verseTranslateX`, y si no existen el render usa `100%` y `0`.
- Cuando el runtime cambia temporalmente la versión bíblica de una diapositiva live, `PresentationView` debe recibir tanto el texto actualizado como `item.verse.version` actualizado; de lo contrario la referencia inferior mostraría una versión distinta al contenido proyectado.
- El drag del indicador bíblico usa umbral de activación (micro-movimientos se ignoran) para evitar cambios accidentales de `positionStyle` al hacer clic o alternar selección en ThemeEditor.
- El drag del indicador también ignora `pointermove` cuando el botón primario no está presionado (`event.buttons`), evitando updates tardíos por listeners residuales al interactuar con otros controles de la UI.
- El indicador bíblico en `upScreen/downScreen` reutiliza `useTextBoundsInteraction` para que el hover, cursor y resize horizontal respondan con el mismo patrón que el cuadro de texto normal; la configuración del verso restringe ese hook a `move`, `resize-left` y `resize-right`.
- Cuando el indicador bíblico está seleccionado en ThemeEditor, también renderiza handles laterales visibles con el mismo lenguaje visual del cuadro de texto, conectados a `startInteraction('resize-left' | 'resize-right')` del hook compartido.
- Los handles laterales del indicador consumen `pointerDown` (`stopPropagation`) para no disparar también el `pointerDown` del contenedor y evitar reinicios de interacción durante re-renders del formulario.
- `useTextBoundsInteraction` ahora usa `setPointerCapture`/`releasePointerCapture` al iniciar/finalizar interacción para mantener el drag estable incluso si hay re-renders durante el movimiento.
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
- **`usePresentationBackground` deriva el fondo en el render (`useMemo`), no en un `useEffect`.** Resolviendolo por efecto, el primer frame de la capa salia con `backgroundType: 'color'` y sin URL; en una transicion de tema esa capa entra pintando el color del frame (`bg-background`, negro en modo oscuro) hasta que corre el efecto. `videoLoaded`/`videoError` se atan a la URL (`loadedVideoUrl === backgroundUrl`) en vez de resetearse por efecto, para que no quede ningun frame arrastrando el estado del fondo anterior.
- **`BackgroundImage` y `BackgroundVideoLive` no animan su propia opacidad.** El desvanecido lo hace la capa de tema que los envuelve. Con fades propios anidados de 0.5 s las dos opacidades se multiplican: medido en el lab con un cross de 0.6 s, a 260 ms la capa iba al 0.43 pero su contenido solo al 0.52 (visibilidad efectiva 0.22), y ese 35 % restante era el fondo negro del frame. El fallback de video va debajo a opacidad plena desde el primer frame; el video lo tapa en cuanto carga.
- En `PresentationView`, `containerStyle.background` filtra el literal `'media'`: como valor CSS es invalido y el frame caia a su clase `bg-background`.
- La transición de tema en `PresentationView` usa `AnimatePresence` en `mode="sync"` con capas superpuestas (`absolute inset-0`) para evitar frames vacíos/negros entre salida y entrada.
- En live, la primera entrada de contenido también ejecuta la transición de tema configurada (no se suprime `initial` en la shell de tema), para evitar aparición brusca al pasar de vacío a item.
- La animación del tema entrante gobierna la transición completa (cross animation): el `exit` de la capa saliente se deriva de la configuración del tema que entra, no de la del que sale.
- **Las dos shells de transición live comparten la composición de variantes**: `utils/composeLiveTransitionVariants.ts`. Recibe `{ opaqueLayer }` porque la estrategia para cruzar sin pasar por negro depende de si la capa trae su propio fondo a sangre:
  - **`opaqueLayer: true`** (capa de tema; slide de MEDIA, que `MediaRender` envuelve en un `bg-black` a pantalla completa). Si la saliente baja de 1 a 0 mientras la entrante sube de 0 a 1, las dos quedan translúcidas a la vez y se ve el fondo de detrás — un fade-out/fade-in solapado, no un cross. El cross real se consigue **no desvaneciendo la saliente**: se queda quieta y opaca debajo mientras la entrante anima encima. El `exit` usa keyframes `opacity: [1, 1, 0]` con `times: [0, 0.995, 1]` y duración `delay + duration` de la entrada. Los keyframes no son cosmética: hace falta un valor que cambie de verdad, porque con `opacity: 1` fijo framer-motion daría el `exit` por terminado al instante y quedaría un frame en negro. Este `exit` **no hereda** la variante original (`...exit`): la capa que solo espera no gira, ni escala, ni se desenfoca.
  - **`opaqueLayer: false`** (texto de canciones/versículos/layers de presentación). El fondo del tema vive detrás de las dos capas, así que el desvanecido simultáneo ya es un cross dissolve correcto y mantener las dos opacas dejaría los dos textos visibles a la vez. Aquí solo se iguala la duración: `getAnimationVariants` da al `exit` `duration * 0.5`, con lo que el contenido saliente se esfumaba a mitad de camino; se estira a `delay + duration`.
- `type: 'none'` conserva el corte seco (sin keyframes) en ambos casos.
- Los tipos por transform (`slide*`, `zoom*`, `scale`) se mueven en bloque con `opacity: 1` fijo, así que nunca hubo hueco de opacidad — pero ahora la capa saliente comparte el `delay` de la entrante: con el `delay: 0` anterior, cualquier retardo configurado hacía que la saliente se fuera antes de que la entrante arrancara.
- Ambas shells pasan las variantes por el `custom` de `AnimatePresence` (variantes dinámicas), de modo que la animación configurada en el elemento **entrante** gobierna también el `exit` del saliente. Sin esto la saliente usaría su propia duración y, cuando difieren, el `hold` acabaría antes que la entrada.
- La clave de `AnimatePresence` de la shell de tema (`composedThemeTransitionKey`) combina el `themeTransitionKey` externo con la **firma visual** del `effectiveTheme` (`utils/themeTransitionSignature.ts`: id + `background` + `backgroundMedia`). El contador externo solo cambia cuando cambia el tema aplicado por IPC, así que sin la firma no había cross animation al pasar de un vídeo (tema neutro `id: -2`) a un tema, ni de una presentación a un tema: la capa saliente se sustituía en seco. La firma también evita re-montar la capa al navegar entre slides del mismo tema.
- En transiciones de tema tipo slide/zoom/scale en `live`, se fuerza `opacity: 1` durante `initial/animate/exit` para impedir que aparezca fondo negro entre capas animadas.
- `PresentationView` soporta `hideTextInLive` para ocultar solo capas textuales en modo `live` (SONG/BIBLE/TEXT y layers textuales de `PRESENTATION`) manteniendo capas de media y fondo.
- En `AnimatedText`, el modo `hideTextInLive` nunca debe retornar antes de completar hooks; la ocultación se resuelve después de declarar hooks para evitar errores de React por orden de hooks.
- `PresentationView` tiene dos paths de render: `live` (completo, con transiciones y video en reproducción) y `preview` (`!live`) estático, sin `AnimatePresence` ni wrappers `m.*` a nivel raíz/slide.
- Para slides con `resourceType: PRESENTATION`, `PresentationView` aplica `effectiveTheme`: usa `item.theme` si existe (override explícito por slide) y, si no existe, fuerza `BlankTheme` (fondo blanco) en lugar de heredar el tema global; esta regla aplica tanto en `live` como en `preview` (`!live`).
- El override `item.theme` de un slide puede provenir de un `backgroundColor` persistido en la diapositiva; cuando existe, el runtime trata ese slide como fondo sólido propio aunque el tema base original use imagen o video.
- En `preview` (`!live`), `PresentationView` muestra badge superior derecho de referencia bíblica con formato corto (`Mat 3:22-25` / `Mat 3:22`) tanto para slides `BIBLE` como para layers bíblicos de `PRESENTATION`; usa la utilidad compartida `app/lib/presentationBibleBadge.ts` para mantener consistencia con Items On Live.
- En cambios de verso interno (`presentationVerseBySlideKey`), `PresentationView` mantiene estable el key del slide live para evitar re-animar capas no bíblicas; solo el layer bíblico actualiza/animación su contenido.
- Cuando cambia el verso interno, el layer bíblico se remonta con key por verso para re-disparar su animación configurada sin afectar la animación de los demás layers del mismo slide.
- `usePresentationTextLayout` procesa campos personalizados de `theme.textStyle` (eliminándolos antes de pasarlos al DOM): sombra (`textShadowEnabled/Color/Blur/OffsetX/OffsetY`), contorno (`textStrokeEnabled/Color/Width` → CSS `-webkit-text-stroke` escalado) y fondo de bloque (`blockBgEnabled/Color/Blur/Radius` → retorna `blockBgStyle: CSSProperties | null`). El `blockBgStyle` se propaga por toda la cadena (`PresentationBody` → `ResourceContent` → `AnimatedText`, `BibleTextRender`, `PresentationRender`) y se aplica en el wrapper interno `<div style={{ width: '100%', ...blockBgStyle }}>` de `AnimatedText`.
- `ThemeToolbar` expone tres Popovers de efectos de texto: **Sombra** (`Blend`), **Contorno** (`PenLine`, controla `textStrokeEnabled/Color/Width`) y **Fondo** (`Layers`, controla `blockBgEnabled/Color/Blur/Radius`).
- `AutoComplete` admite `contentPlacement: 'top' | 'bottom'` para elegir si el listado se renderiza por encima o por debajo del input; default `bottom`.
- El listado de `AutoComplete` usa un `z-index` alto y `shadow` propio para mantenerse visible por encima de toolbars/paneles con stacking complejo (como `items-on-live`) y evitar que parezca que el tooltip no abre.
- `AutoComplete` admite `showAllOnFocus` para limpiar temporalmente el término de búsqueda cuando el input gana foco y estaba mostrando el label seleccionado; útil en selectores como fuentes para listar todas las opciones al abrir y filtrar solo cuando el usuario escribe.
- `AutoComplete` sincroniza el texto visible con `value` cuando las opciones cargan de forma asíncrona (por ejemplo fuentes del sistema), evitando que el input quede en placeholder aunque exista valor inicial seleccionado.
- En `preview`, los videos (fondo y capas de presentación) no se reproducen: se renderizan thumbnails estáticos para reducir CPU/GPU cuando hay muchas instancias simultáneas.
- En `live`, cuando el slide actual es `resourceType: 'MEDIA'` (imagen/video solo), `PresentationView` omite el tema seleccionado y usa un tema neutro negro (`buildLiveMediaNeutralTheme`) para evitar que fondos degradados del tema se superpongan al contenido multimedia. Ese tema neutro **hereda la `transitionSettings` del tema aplicado**: con `type: 'none'` fijo, entrar en un vídeo era un corte seco en lugar de cruzarse con la animación configurada.
- Las transiciones de tema/slide (`useMemo` + `AnimatePresence` + `m.div`) se encapsulan en shells solo de `live`, evitando cálculo/instanciación en `preview`.
- En `preview`, fondos de imagen y thumbnails de video usan `<img>` estático (`loading="lazy"`) en lugar de componentes animados, para minimizar costo de render masivo.
- `PresentationView` está memoizado (`React.memo`) con comparación explícita de props para evitar re-renders en cascada cuando se renderiza muchas veces en paralelo.
- El cálculo de variantes de animación se corta en `preview`: usa variantes vacías y tipo `none`, evitando parse/instanciación de animaciones cuando no se van a reproducir.
- La lógica interna de `PresentationView` está separada en hooks de dominio (`sizing`, `background`, `textLayout`) para reducir complejidad del componente principal y aislar cálculos que antes estaban mezclados.
- El JSX duplicado entre `preview` y `live` se consolidó en capas compartidas (`backgroundLayer`, `contentLayer`, `tagSongLayer`) y un `viewContent` único; la diferencia entre modos queda solo en el wrapper de transición.
- El render por tipo de recurso (`PRESENTATION`/`BIBLE`/`TIMER`/texto genérico) se extrae a `ResourceContent` dentro del módulo para acortar el flujo principal y hacer más visible la orquestación de capas.
- `TimerRender` (rama `resourceType: 'TIMER'` en `ResourceContent`) dibuja una cuenta atrás de servicio: `CountdownRing` SVG (dos `<circle>`, `strokeDasharray = 2πr`, `strokeDashoffset = C*(1 - remaining/total)`, rotado −90° con `stroke-linecap: round`) cuyo arco se vacía al acabar el tiempo, con el tiempo `MM:SS`/`HH:MM:SS` y el título en el centro. Fondo transparente: hereda el tema aplicado detrás. Usa `endsAt` absoluto de `item.timer` + `setInterval` local (`formatRemaining`/`resolveRemainingMs` de `lib/time.ts`); al llegar a 0 muestra `endMessage`. Config del timer en `app/lib/timerAccessData.ts`. El tamaño de fuente se escala proporcional a `presentationHeight` (altura real del contenedor que `PresentationView` pasa a `ResourceContent`), igual que `AnimatedText`/`BibleTextRender`, para auto-ajustarse en preview (pequeño) y live sin usar unidades de viewport. Colores configurables `textColor`/`ringColor` en `TimerConfig` (si son `null` heredan el color de texto del tema); el diálogo `ChurchCountdownDialog` los expone con un switch "Personalizar colores" + `ColorPicker`. El anillo es fino (`strokeWidth` 3 sobre viewBox 100).
- El frame visual e interacción base del contenedor (`role`, teclado, padding por tag y montaje de capas) está en `PresentationFrame`, dejando `index.tsx` centrado en composición/orquestación.
- La construcción de capas compartidas (`backgroundLayer`, `contentLayer`, `tagSongLayer`) se movió a `PresentationBody`, por lo que `index.tsx` solo coordina hooks, props y wrappers de modo.
- `PresentationBody` y `ResourceContent` están memoizados con comparadores explícitos para reducir re-renders en cascada cuando no cambian props efectivas.

### Logica de fondos

El campo `theme.background` determina el tipo:

- **Color/Gradient**: Se aplica directamente como `background` CSS.
- **`"media"`**: Usa `theme.backgroundMedia` para determinar si es imagen o video.
  - Imagen: `BackgroundImage` (fade in/out con `m.img`).
  - Video (preview): `BackgroundVideoThumbnail` (muestra thumbnail estatico).
  - Video (live): `BackgroundVideoLive` (reproduce video + fallback image mientras carga) y respeta `theme.backgroundVideoLoop` para decidir si repite.

### Desenfoque de fondo (`theme.backgroundBlur`)

- `PresentationBody` lee `theme.backgroundBlur` (Int px, `0` = sin blur) y lo propaga a `BackgroundImage` y `BackgroundVideoLive` (y a los `<img>` de preview) solo cuando el fondo es media; colores/gradientes no aplican blur.
- Cuando `blur > 0`, el componente aplica `filter: blur(Npx)` sobre el media y lo agranda con `transform: scale(1.06)` + `transformOrigin: center` para ocultar los bordes translúcidos del desenfoque sin desplazar visualmente la imagen (evita la ilusión óptica de texto descentrado que causaba el enfoque anterior con `top/left: -3%`); los contenedores ya son `overflow-hidden`.

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
- En animación `split`, el tokenizado de HTML se hace con `splitHtmlForWordAnimation` para no romper etiquetas/atributos inline (ej. `style="..."`) al dividir por espacios en textos bíblicos o rich text.
- Los estilos estáticos de handles se hoistean fuera del componente para evitar recreación de objetos en cada render.
- La lógica de interacción del cuadro de texto (detectar bordes, drag, resize y cursores) se extrajo a `useTextBoundsInteraction`, dejando `AnimatedText` enfocado en render y composición.
- `useTextBoundsInteraction` incluye snap-to-center magnético: durante el drag (`move`), si `translateX` o `translateY` caen dentro del umbral de snap, se snappean a 0. El umbral es `resolveSnapCenterThreshold(margin)` = `max(8, margin × 0.75)` px lógicos, usando el `paddingInline`/`paddingBlock` del tema como margen disponible; así la zona muerta entre el snap y el clamp (±padding) se reduce sin forzar el centrado y la caja conserva su posición exacta cuando se suelta fuera de la zona de snap. Se expone `snapGuides: { centerX, centerY }` para que `AnimatedText` renderice líneas guía (teal, 1px) sobre el frame cuando el snap está activo.

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
- El trigger y el contenido del Popover previenen `autoFocus` por defecto para no colapsar la selección activa del `contenteditable` al abrir/cerrar el picker desde toolbars de edición.
- Soporta cuentagotas nativo del navegador (`EyeDropper`) en contexto seguro (`window.isSecureContext`): muestra botón de icono integrado dentro del propio `ChromePicker` (lado derecho del bloque inferior de inputs) y aplica el color seleccionado (`sRGBHex`) al `onChange`.
- Si el usuario cancela el cuentagotas o el permiso falla, se silencia el error para mantener UX fluida.

### FontFamilySelector (`fontFamilySelector.tsx`)

- Selector de fuentes del sistema y personalizadas.
- Permite elegir fuentes del sistema detectadas automáticamente.
- Permite subir fuentes personalizadas (`.ttf`, `.otf`) mediante un diálogo visual moderno, que soporta carga múltiple y feedback de éxito/error.
- Agrupa variantes de peso/estilo de una misma familia personalizada (ej. `Poppins-Bold`, `Poppins-Light`) en una sola opción visual (`Poppins`) para simplificar el listado.
- La selección guarda/usa la familia (`Poppins`) y mantiene compatibilidad con valores antiguos por variante (`Poppins-Bold`, etc.) mediante normalización al valor de familia.
- Las variantes reales (`Bold`, `Italic`, `Light`, etc.) se resuelven desde `@font-face` por peso/estilo, por lo que `font-weight` y `font-style` del tema aprovechan los archivos correctos cuando existen.
- Al eliminar una familia agrupada, elimina todas sus variantes con confirmación.
- UI moderna, accesible y responsiva, con separación clara entre fuentes propias y del sistema.
- Usa el componente desacoplado `uploadFontDialog.tsx` para la carga de fuentes.

### UploadFontDialog (`uploadFontDialog.tsx`)

- Componente desacoplado para subir fuentes personalizadas.
- Permite seleccionar varios archivos a la vez.
- Detecta automáticamente la familia (ej. `Poppins`) desde el nombre de archivo para simplificar la gestión.
- Omite duplicados por `fileName` (existentes o repetidos en el mismo lote) para evitar entradas redundantes.
- Feedback visual de progreso, éxito y error.
- Diseño espacioso, botones grandes y claros, inputs accesibles.
- Se controla desde el selector de fuentes o cualquier otro componente que requiera subir fuentes.

### VirtualizedScrollArea (`virtualized-scroll-area.tsx`)

- Wrapper de `@tanstack/react-virtual`.
- Recibe `items`, `renderItem`, `estimateSize` y el opcional `renderStickyHeader`.
- Componente `VirtualRow` extraido para reconciliacion correcta.
- **Cabecera fija (`renderStickyHeader`)**: recibe el índice del primer item visible y se renderiza en un wrapper `sticky top-0 z-20 h-0` (alto cero para flotar sobre las filas sin desplazarlas). Debe vivir aquí y no en el consumidor: las filas están dentro de un contenedor con `transform`, que crea un bloque contenedor propio y rompe `position: sticky`.
- El índice se calcula con un `onScroll` propio que lee `scrollTop`, NO con `getVirtualItems()[0]`: ese incluye el overscan (la cabecera cambiaría antes de tiempo) y además el virtualizer solo re-renderiza cuando cambia el rango visible, no en cada scroll. El `setState` se hace solo si el índice cambió, así el scroll no re-renderiza la lista en cada frame.
- Para reiniciar scroll y cabecera al cambiar el dataset, remontar con `key` (el componente no expone `scrollToIndex`).

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

## Cambios recientes

- **Fix: Ilusión óptica de texto descentrado con blur de fondo** (2026-08-16): cuando el fondo tenía `backgroundBlur > 0`, la imagen/video se desplazaba con `top/left: -3%` y `width/height: 106%` para ocultar los bordes del desenfoque, pero ese desplazamiento creaba una ilusión óptica que hacía que el texto pareciera corrido a la derecha.
  - **Problema**: el `top: -3%` / `left: -3%` desplazaba visualmente el fondo, generando una percepción de descentrado del texto aunque matemáticamente estuviera centrado.
  - **Solución**: reemplazar el desplazamiento por `transform: scale(1.06)` + `transformOrigin: center`, que agranda la imagen desde el centro sin moverla visualmente. Aplica a `BackgroundImage`, `BackgroundVideoLive` y los `<img>` de preview en `PresentationBody`.
  - **Archivos**: `BackgroundImage.tsx`, `BackgroundVideoLive.tsx`, `PresentationBody.tsx`.

- **Fix: Zona muerta de snap al arrastrar la caja de texto en ThemeEditor** (2026-08-16): el snap-to-center de `useTextBoundsInteraction` usaba un umbral fijo de 8px lógicos, dejando una zona muerta `[8, ±paddingInline]` donde la caja podía quedar descentrada sin snap al soltar.
  - **Problema**: con el tema por defecto (`paddingInline: 16`), soltar la caja a 8-16px del centro dejaba el texto visiblemente corrido a la derecha, sin forma fácil de recentrarlo.
  - **Solución**: el umbral ahora es `resolveSnapCenterThreshold(margin) = max(8, margin × 0.75)` px lógicos, proporcional al `paddingInline`/`paddingBlock` del tema; la zona muerta se reduce a `(0.75·margin, margin]` y la caja conserva su posición exacta al soltar fuera de la zona de snap.
  - **Test**: `useTextBoundsInteraction.test.ts` cubre `resolveSnapCenterThreshold` (umbral base, escalado y zona muerta reducida).

- **Fix: Prefijo de verso duplicado en pasos internos (`chunk`)** (2026-03-30): al navegar textos bíblicos largos por partes dentro de una misma slide, `BibleTextRender` reinsertaba el número de verso en cada parte (ej. `23 ...`).
  - **Problema**: el texto base podía traer numeración incrustada (`23`, `23.`, `23...`) y además duplicarse al mostrar número de verso.
  - **Ajuste fino**: `PresentationRender` oculta prefijo solo desde la segunda parte (`chunk > 1`), conservando la opción de mostrar verso en la primera parte cuando está activa.
  - **Resultado**: primera parte respeta la configuración de verso; partes siguientes no repiten el número dentro del cuerpo.

- **Fix: Auto-split de texto bíblico no activado en PRESENTATION** (2026-03-30): aunque `BibleTextRender` ya soportaba `autoSplitVerseText`, `PresentationRender` no enviaba esa prop y la lógica quedaba desactivada (`false` por default).
  - **Problema**: textos largos en layers bíblicos y slides legacy de `PRESENTATION` no se partían aunque existiera la lógica de división.
  - **Solución**: `PresentationRender` ahora pasa `autoSplitVerseText` en ambas rutas bíblicas (layer y legacy).
  - **Test**: `PresentationRender.test.tsx` valida explícitamente que `autoSplitVerseText === true`.

- **Fix: Auto font size en capas bíblicas de PRESENTATION** (2026-03-29): el desajuste preview/live no venía de `TextCanvasItem`, sino del path de `PresentationRender` para layers `resourceType: 'BIBLE'`.
  - **Problema**: `PresentationRender` pasaba `presentationHeight={BASE_PRESENTATION_HEIGHT}` y `scaleFactor={1}` a `BibleTextRender`, ignorando el tamaño real del viewport.
  - **Síntoma**: mismo tamaño absoluto de verso en preview pequeño y live grande (en preview se veía enorme, en live pequeño).
  - **Solución**: propagar `presentationHeight` y `scaleFactor` reales desde `ResourceContent` hacia `PresentationRender`, y de ahí a `BibleTextRender` por layer bíblico.
  - **Archivos**:
    - `app/ui/PresentationView/components/ResourceContent.tsx`
    - `app/ui/PresentationView/components/PresentationRender.tsx`
    - `app/ui/PresentationView/components/PresentationRender.test.tsx`

- **Fix: Recorte de referencia bíblica en PRESENTATION** (2026-03-29): las capas bíblicas de presentaciones estaban heredando el recorte single-line (`ellipsis`) pensado para el flujo directo de Bible Library.
  - **Problema**: en slides de tipo PRESENTATION con layer bíblico, la referencia se truncaba igual que en Bible Library.
  - **Solución inicial**: `BibleTextRender` soporta `constrainScreenVerseToSingleLine` (default `true`) para desacoplar Bible Library vs PRESENTATION.
  - **Archivos**:
    - `app/ui/PresentationView/components/BibleTextRender.tsx`
    - `app/ui/PresentationView/components/PresentationRender.tsx`
    - `app/ui/PresentationView/components/PresentationRender.test.tsx`

- **Mejora: Recorte dinámico por diapositiva (`auto`)** (2026-03-29): para slides antiguas con texto largo no fragmentado y para cambios de versión bíblica, el recorte se decide en runtime por contenido de la slide.
  - `constrainScreenVerseToSingleLine` ahora acepta `boolean | 'auto'`.
  - En modo `auto`: si el verso no tiene saltos manuales y supera el umbral dinámico (`resolveBibleChunkMaxLength('auto', fontSize)`), activa single-line + ellipsis; si ya está dividido, no recorta.
  - `PresentationRender` y el canvas del editor usan `constrainScreenVerseToSingleLine="auto"` para comportamiento consistente por diapositiva.

- **Fix: Slides legacy de PRESENTATION con `verse`** (2026-03-29): las diapositivas antiguas sin `presentationItems` quedaban fuera de `BibleTextRender` y no aplicaban ni el modo `auto` ni la resolución de verso activo por slide.
  - **Problema**: en slides antiguas, el render caía en `AnimatedText` directo y no respetaba la lógica bíblica dinámica.
  - **Solución**: `PresentationRender` ahora detecta `item.verse` en slides legacy y renderiza con `BibleTextRender`, incluyendo `constrainScreenVerseToSingleLine="auto"` y `presentationVerseBySlideKey` por `slideKey`.
  - **Test**: `PresentationRender.test.tsx` añade cobertura para la ruta legacy.

- **Fix: Auto font size para versos bíblicos desincronizado** (2025-03-29): El cálculo de `smallFontSize` en BibleTextRender recibía parámetros incorrectos desde TextCanvasItem.
  - **Problema**: El verso se veía enorme en el editor de presentaciones pero minúsculo en la pantalla live.
  - **Root cause**: `TextCanvasItem` pasaba `presentationHeight={style.height}` (altura del elemento ~200px) cuando debería ser `BASE_CANVAS_HEIGHT` (720). Esto causaba que la escala en BibleTextRender fuese completamente diferente entre editor y live.
  - **Fórmula afectada**: En BibleTextRender línea ~310: `verseFontSize = (safePresentationHeight * verseBaseFontSize) / BASE_PRESENTATION_HEIGHT`. Si `safePresentationHeight` = 200px, la proporción es incorrecta.
  - **Solución**: Cambiar TextCanvasItem para pasar `presentationHeight={BASE_CANVAS_HEIGHT}` consistentemente. Ahora `smallFontSize = style.fontSize * 0.85` produce el mismo resultado proporcional que en PresentationView.
  - **Archivos modificados**:
    - `app/screens/editors/presentationEditor/components/textCanvasItem.tsx` (línea ~510)
    - `app/screens/editors/presentationEditor/components/textCanvasItem.test.ts` (tests agregados)
  - **Validación**: Tests unitarios confirman cálculo consistente entre editor (720px base) y live screen (1080px real / 720px base = 1.5x escala).

- **Fix: F9 hideTextInLive crash en CopyrightTextRender** (2026-07-08): `CopyrightTextRender.tsx` tenía un early return en línea 73 que retornaba `null` cuando `hideTextInLive && !isPreview`, pero lo hacía DESPUÉS de `useMemo(copyrightText)` pero ANTES de `useMemo(copyrightOverrideStyle)`, `useRef(dragRef)` y `useRef(isDraggingRef)`. Esto violaba las reglas de hooks de React: al presionar F9 mientras un SONG con metadata de copyright estaba en vivo, el número de hooks cambiaba entre renders, causando "Rendered fewer hooks than expected" y rompiendo la app.
  - **Solución**: Mover `safePresentationHeight`, `themeTextStyle`, `useMemo(copyrightOverrideStyle)`, `useRef(dragRef)` y `useRef(isDraggingRef)` ANTES del early return, preservando el orden consistente de hooks.
  - **Por qué "a veces"**: El crash solo ocurría cuando había una canción con copyright/author en la pantalla en vivo al presionar F9.
  - **Archivo**: `app/ui/PresentationView/components/CopyrightTextRender.tsx`

## Laboratorio de transiciones (dev)

`pnpm --filter @ecclesia/desktop lab` levanta un Vite aparte (puerto 5199, `vite.lab.config.ts`) que sirve `app/transition-lab.html` sin arrancar Electron. Sirve para lo que los tests no pueden cubrir: framer-motion 12 anima por WAAPI y jsdom no lo implementa, asi que en test la opacidad de las capas se queda congelada en su valor `initial` y solo se puede verificar la **forma** de las variantes, nunca el resultado pintado.

- `?dur=25` alarga la transicion para poder congelarla (`document.getAnimations().forEach(a => a.pause())`) y capturarla a medio camino.
- El fondo de la pagina es magenta para separar diagnosticos: **magenta** = hueco de geometria, **negro** = algo lo esta pintando, **color apagado** = bajon de opacidad.
- La comprobacion clave es que `opacidad(saliente) + opacidad(entrante) === 1` en todo momento y que el contenido de la entrante este a opacidad plena desde el primer frame.
- No entra en produccion: `electron.vite.config.ts` solo declara `index.html` y `splash.html` como inputs del build.
