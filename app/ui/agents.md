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
│   │   ├── AnimatedText.tsx            # Texto con animaciones (LazyMotion m)
│   │   ├── BackgroundImage.tsx         # Fondo de imagen animado (m.img)
│   │   ├── BackgroundVideoLive.tsx     # Fondo de video en vivo (m.video + m.img fallback)
│   │   └── BackgroundVideoThumbnail.tsx # Thumbnail de video para preview (m.img)
│   └── hooks/
│       └── useBibleSetting.tsx         # Hook para config de presentacion de biblia
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
}

interface PresentationViewItems {
  text: string                       // Contenido HTML del slide
  verse?: {                          // Datos de versiculo (opcional)
    bookId: number
    chapter: number
    verse: string
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
        ├── AnimatePresence mode="wait"     <- Transicion de texto
        │     └── AnimatedText              <- Texto con animacion configurable
        │
        └── Tag bar (opcional)              <- Barra de color inferior con nombre del tag
```

### Logica de fondos

El campo `theme.background` determina el tipo:

- **Color/Gradient**: Se aplica directamente como `background` CSS.
- **`"media"`**: Usa `theme.backgroundMedia` para determinar si es imagen o video.
  - Imagen: `BackgroundImage` (fade in/out con `m.img`).
  - Video (preview): `BackgroundVideoThumbnail` (muestra thumbnail estatico).
  - Video (live): `BackgroundVideoLive` (reproduce video + fallback image mientras carga).

### AnimatedText (`components/AnimatedText.tsx`)

Renderiza el texto del slide con animaciones:

- El contenedor del texto aplica padding configurable por tema (`textStyle.paddingInline` y `textStyle.paddingBlock`), permitiendo ajustar márgenes desde el editor de temas.
- El contenedor también admite desplazamiento configurable mediante `textStyle.translate` (string CSS) para mover el bloque de texto en ambos ejes.
- Márgenes y desplazamiento se escalan por eje para mantener consistencia visual entre previews pequeños y pantallas grandes: valores horizontales (`paddingInline`, `translateX`) en función del ancho, y verticales (`paddingBlock`, `translateY`) en función del alto.
- El recálculo de estos valores depende explícitamente de cambios en ancho y alto del viewport renderizado para evitar desalineaciones al redimensionar o cambiar de display.
- El `positionStyle` de referencia bíblica en modos `upScreen/downScreen` también se escala proporcionalmente.
- Soporta guía visual opcional del área de texto (`showTextBounds`) para mostrar el contenedor efectivo con borde punteado en modos de edición/preview.

- **Preview mode** (`isPreview: true`): Sin animacion, solo `dangerouslySetInnerHTML` con `sanitizeHTML()`.
- **Animacion "split"**: Divide por palabras, cada una animada individualmente con `m.span`.
- **Otras animaciones**: Bloque completo animado con `m.div`.

Soporta referencia biblica con posicion configurable:

- Inline: beforeText, afterText, underText, overText.
- Pantalla: upScreen, downScreen (posicion absoluta con offset configurable).

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
