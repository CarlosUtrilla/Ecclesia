# Editors Agent

> **Agent router:** [`/agents.md`](../../../agents.md)

## Descripcion

Editores de la aplicacion. Se abren en ventanas separadas de Electron (excepto la configuracion de biblia que es un dialog). Cada editor gestiona la creacion y edicion de un tipo de recurso.

## Archivos

```text
app/screens/editors/
├── components/
│   └── textEffectsControls.tsx # Controles compartidos de Sombra/Contorno/Fondo para texto
├── songEditor/
│   ├── index.tsx                # SongEditor: editor completo de canciones
│   ├── songsSchemas.tsx         # Esquemas Zod de validacion
│   ├── themeSelector.tsx        # Selector de tema para preview
│   └── richEditor/
│       ├── richTextEditor.tsx   # Editor TipTap para contenido de estrofas
│       ├── SongGroup.tsx        # Componente de grupo/estrofa con tag selector
│       └── utils.ts             # Utilidades del editor
├── themesEditor/
│   ├── index.tsx                # ThemesEditor: editor de temas de presentacion
│   ├── schema.ts                # Esquema Zod de validacion
│   ├── animationEditor.tsx      # Dialog para configurar animaciones
│   ├── animationSelector.tsx    # Selector rapido de tipo de animacion
│   └── backgroundSelector.tsx   # Selector de tipo de fondo (color/imagen/video)
├── biblePresentationConfiguration/
│   ├── index.tsx                # BiblePresentationConfiguration: dialog de config
│   └── schema.ts                # Esquema Zod
├── presentationEditor/
│   ├── index.tsx                # PresentationEditor: orquestador del editor
│   ├── bibleTextPicker.tsx      # Dialog para seleccionar rango bíblico
│   ├── schema.ts                # Esquema Zod del editor de presentaciones
│   ├── agents.md                # Documentación específica del módulo
│   ├── components/
│   │   ├── editorCanvas.tsx     # Lienzo editable (drag visual de contenido)
│   │   ├── textCanvasItem.tsx   # Item de texto editable inline (focus/caret/edición)
│   │   ├── textTabContent.tsx   # Contenido desacoplado de la pestaña Texto del editor
│   │   ├── animationTabContent.tsx # Contenido desacoplado de la pestaña Animar
│   │   ├── insertTabContent.tsx # Contenido desacoplado de la pestaña Insertar
│   │   └── sortableSlideCard.tsx # Tarjeta sortable del carrusel de slides
│   ├── hooks/
│   │   ├── usePresentationEditorHistory.ts   # Hook dedicado de undo/redo con snapshots
│   │   ├── usePresentationEditorShortcuts.ts # Atajos globales del editor (Delete/Duplicate/Undo/Redo)
│   │   ├── usePresentationEditorActions.ts   # Lógica de acciones de slides/items
│   │   └── useCanvasSnapping.ts             # Snapping magnético y guías del canvas
│   └── utils/
│       ├── slideUtils.ts        # Factories y normalización slide -> items[]
│       └── bibleAccessData.ts   # Parse/build de accessData bíblico reutilizable
└── tagSongsEditor.tsx/
    └── index.tsx                # TagSongsEditor: editor de etiquetas de canciones
```

## Song Editor

**Ruta:** `/song/new` o `/song/:id`
**Ventana:** Se abre via `window.windowAPI.openSongWindow(songId?)`

### Layout Song Editor

```text
[Formulario de cancion]  |  [Preview de slides]  |  [Selector de tema]
     (col 2-3)           |      (col 8-9)        |      (sidebar)
```

### Funcionalidad Song Editor

- **Formulario**: titulo, autor, copyright (React Hook Form + Zod).
- **Editor de letras**: TipTap rich text editor con estrofas agrupadas por tags.
- **SongGroup**: Cada estrofa tiene un selector de tag (Verso, Coro, Puente) con color.
- **Preview**: Muestra slides de la cancion usando `PresentationView` con el tema seleccionado.
- **fullText**: Se genera automaticamente concatenando el contenido de todas las estrofas (sin HTML).

### Flujo de guardado

```text
1. Usuario edita -> React Hook Form trackea cambios
2. Click "Guardar" -> validacion Zod
3. window.api.songs.createSong() o updateSong()
4. ipcRenderer.send('song-saved') -> notifica a ventana principal
5. `window.googleDriveSyncAPI.notifyAutoSaveEvent()` -> dispara autosync si está habilitado
5. window.windowAPI.closeCurrentWindow()
```

### Esquema Zod (`songsSchemas.tsx`)

```typescript
{
  title: z.string().min(1),
  author: z.string().optional(),
  copyright: z.string().optional(),
  lyrics: z.array(z.object({
    content: z.string(),
    tagSongsId: z.number().optional()
  }))
}
```

## Themes Editor

**Ruta:** `/theme/new` o `/theme/:id`
**Ventana:** Se abre via `window.windowAPI.openThemeWindow(themeId?)`

### Layout Themes Editor

```text
[Formulario de tema]     |  [Preview grande]    |  [Miniaturas de slides]
  (sidebar izquierdo)    |   (centro)           |    (barra inferior)
```

### Funcionalidad Themes Editor

- **Nombre del tema**: Campo unico.
- **Fondo**: `BackgroundSelector` con 3 opciones:
  - Color solido (ColorPicker)
  - Imagen (MediaPicker dialog)
  - Video (MediaPicker dialog)
- **Estilos de texto**: fontSize, fontFamily, fontWeight, color, textAlign, letterSpacing, lineHeight.
- **Reutilización de efectos de texto**: ThemeToolbar y PresentationEditor comparten `app/screens/editors/components/textEffectsControls.tsx` para controles de sombra, contorno y fondo de bloque, reduciendo duplicación de UI/lógica.
- **Sombra de texto**: toggle `textShadowEnabled` + `textShadowColor`, `textShadowBlur`, `textShadowOffsetX`, `textShadowOffsetY`. Se configuran en un Popover "Sombra" en `ThemeToolbar`. Los valores se almacenan como campos custom en `textStyle` y se convierten a `textShadow` CSS (escalado al tamaño de pantalla) en `usePresentationTextLayout`.
- **Alineación vertical del bloque**: selector en toolbar (`Arriba`, `Centro`, `Abajo`) persistido en `textStyle.justifyContent` (default `Centro`).
- **Contenedor de texto**: `Margen X` y `Margen Y` (padding horizontal/vertical) configurables por tema para controlar cercanía al borde de pantalla.
- **Posición del contenedor**: `Posición X` y `Posición Y` para desplazar el bloque de texto a izquierda/derecha/arriba/abajo.
- En el preview del Theme Editor se muestra una guía visual con borde punteado del área efectiva del texto para ajustar tamaño/márgenes con precisión.
- La guía visual del preview es editable con mouse: se puede arrastrar el cuadro para moverlo y usar handles de borde para redimensionar, sincronizando los campos `Margen X/Y` y `Posición X/Y` en tiempo real.
- En Theme Editor, la guía se renderiza con estado seleccionado siempre activo para mostrarse en todo momento; en otros editores puede ocultarse y mostrarse por selección del usuario.
- El selector `Texto/Verso` permite elegir qué bloque está activo para edición en el preview; el verso bíblico (cuando está en `upScreen/downScreen`) se arrastra verticalmente con límite de borde para que no invada la zona central.
- El menú `Posición` no usa pestañas: carga automáticamente los controles del elemento actualmente seleccionado en el preview (texto principal o verso bíblico).
- Si el tema está usando configuración bíblica por defecto y el usuario arrastra el verso en el preview, el editor cambia automáticamente a configuración personalizada del tema para aplicar el ajuste de `positionStyle`.
- Al crear un tema nuevo, la separación inicial del verso bíblico desde el borde usa `10px` en lugar de `0px` para una posición de partida más útil.
- En la configuración de presentación bíblica, el valor inicial de separación del borde también parte en `10px` para mantener consistencia con el editor de temas.
- Para evitar saturación en la toolbar, los controles de `Margen X/Y` y `Posición X/Y` están agrupados en un dropdown `Posición`.
- Los valores de estos controles se muestran en una sola línea con ancho fijo para evitar saltos de línea en números grandes/negativos.
- Cada control admite edición precisa por teclado mediante input numérico (además del slider) para ajustar valores en px.
- Los inputs numéricos de estos controles son compactos e incluyen sufijo visual `px` al final.
- El dropdown incluye acción rápida `Centrar / Restablecer` para volver a valores por defecto (`Margen X/Y = 16`, `Posición X/Y = 0`).
- **Animacion**: `AnimationSelector` (selector rapido) + `AnimationEditor` (dialog detallado).
  - Tipos: fade, slide, scale, rotate, flip, bounce, blur, zoom, split, none.
  - Parametros: duracion, delay, easing.
- **Transición de tema**: selector reutilizado (`AnimationSelector`) para `transitionSettings`; se ejecuta cuando cambia de un tema a otro (no por cambio de slide).
- **Config de biblia**: Toggle "usar config global" o configuracion personalizada por tema.
- **Preview en vivo**: `PresentationView` con items de ejemplo.
- Las miniaturas del carrusel inferior usan ancho fijo (`w-72`) para preservar legibilidad del texto manteniendo el escalado relativo al tamaño del preview.
- **Guardado en edición**: al actualizar un tema existente se usa el `id` de la ruta (`/theme/:id`) para evitar depender de campos filtrados por validación del formulario.
- El guardado no depende del estado `isDirty`; el botón `Save` permanece disponible y se bloquea solo durante `isSubmitting`.
- En edición, si el `id` de ruta no está disponible, intenta fallback con el tema cargado y muestra error claro si no puede resolverlo.
- El guardado del formulario se ejecuta con `handleSubmit`.
- El desplazamiento del contenedor de texto usa `textStyle.translate` (string CSS, por ejemplo `"-40px 12px"`) en lugar de campos custom `translateX/translateY`.

### AnimationEditor (`animationEditor.tsx`)

- Dialog con controles para tipo, duracion, delay, easing.
- Preview en vivo de la animacion con `LazyMotion` + `m`.
- Reset `localSettings` al abrir el dialog (no useEffect, usa `onOpenChange`).

### BackgroundSelector (`backgroundSelector.tsx`)

- Dropdown para tipo de fondo.
- Renderiza control segun tipo: `ColorPicker`, boton para `MediaPicker`.
- Cuando el fondo es media, guarda `background: "media"` y `backgroundMediaId: media.id`.

### Esquema Zod (`schema.ts`)

```typescript
{
  name: z.string().min(1),
  background: z.string(),
  backgroundMediaId: z.number().nullable(),
  textStyle: z.object({ ... }),
  animationSettings: z.string(),  // JSON stringified
  useDefaultBibleSettings: z.boolean(),
  biblePresentationSettings: z.object({ ... }).optional()
}
```

## Presentation Editor

**Ruta:** `/presentation/new` o `/presentation/:id`
**Ventana:** Se abre via `window.windowAPI.openPresentationWindow(presentationId?)`

### Funcionalidad Presentation Editor

- El detalle técnico del módulo se documenta en [app/screens/editors/presentationEditor/agents.md](presentationEditor/agents.md).
- El módulo está organizado por `components/`, `hooks/` y `utils/` para mantener `index.tsx` como orquestador.
- Funcionalidades principales: edición visual canvas, snapping, historial undo/redo, atajos y guardado de slides mixtos (`items[]`).
- En PresentationEditor, el carrusel de slides permite inserción contextual por hover entre tarjetas (`Añadir diapositiva aquí`) para crear una diapositiva en una posición específica.
- En PresentationEditor, las miniaturas de slides soportan `click derecho` para duplicar/eliminar diapositiva; la duplicación no arrastra metadatos de Canva para evitar colisiones con reimportación.
- En PresentationEditor, cada miniatura de slide permite `Renombrar diapositiva` desde menú contextual; abre un diálogo del editor, guarda el nombre en `slideName` y lo muestra en el overlay de la miniatura.
- En PresentationEditor, la pestaña `Insertar` permite añadir formas (`Rectángulo`, `Círculo`, `Flecha`, `Flecha de línea`, `Triángulo`, `Línea`, `Cruz`) como layers `SHAPE` reordenables y editables visualmente; soportan texto interior, presets y resize proporcional con `Shift`. El resize proporcional también aplica a media y texto, recalculando `fontSize` en items textuales.
- PresentationEditor reutiliza el patrón de cierre seguro de ThemesEditor: al intentar cerrar la ventana con cambios sin guardar, Electron emite `presentation-close-requested`, el renderer muestra un diálogo de confirmación y solo destruye la ventana tras `window.windowAPI.confirmPresentationClose()`.
- Incluye transición por slide (`slide.transitionSettings`) editable con `AnimationSelector` reutilizado.
- Incluye importación directa de assets Canva desde la pestaña `Insertar` en formato MP4 y ZIP (con extracción automática de MP4), creando una carpeta en Media por ZIP con sufijo incremental cuando aplica y una diapositiva por cada video importado.
- La importación Canva en PresentationEditor persiste metadatos por slide (`canvaSourceKey`, `canvaSlideNumber`) para soportar reimportación idempotente: si el ZIP actualizado mantiene numeración (`1.mp4`, `2.mp4`, ...), se actualizan los slides existentes por número aunque el orden visual haya cambiado por inserciones manuales.
- La toolbar tipográfica del `Presentation Editor` permite alineación vertical del item (`Arriba`, `Centro`, `Abajo`), aplicada al render de canvas y persistida en `customStyle`.
- Los cambios de un control de estilo no sobrescriben otros campos no editados (por ejemplo, cambiar alineación conserva `fontFamily`).
- El editor filtra valores `undefined` en updates de item/estilo para evitar sobrescrituras accidentales en controles de texto, media y canvas.
- Preview en vivo por diapositiva usando `PresentationView`.
- Guardado emite evento IPC `presentation-saved` para refrescar biblioteca principal.

## Bible Presentation Configuration

**UI:** Dialog (no ventana separada), se abre desde el panel de biblia.

### Funcionalidad Bible Presentation Configuration

- Configura como se muestra la referencia biblica en presentaciones.
- Opciones:
  - Modo de descripcion: nombre corto o completo del libro.
  - Posicion: antes/despues/encima/debajo del texto, arriba/abajo de la pantalla.
  - Mostrar version, mostrar numero de versiculo.
  - Offset en px para posiciones de pantalla (`upScreen` / `downScreen`) con rango ampliado para ajustar mejor la cercanía al borde.
- Puede configurarse globalmente o por tema individual.

## Tag Songs Editor

**Ruta:** `/tagSongEditor`
**Ventana:** Se abre via `window.windowAPI.openTagsSongWindow()`

### Funcionalidad Tag Songs Editor

- CRUD de tags para categorizar estrofas de canciones.
- Campos: nombre, nombre corto (shortName), atajo de teclado (shortCut), color.
- Al guardar emite IPC `tags-saved` para refetch en ventana principal.

## Convenciones

- Cada editor se abre en ventana separada (excepto BiblePresentationConfiguration).
- Usan React Hook Form + Zod para validacion.
- Al guardar exitosamente:
  1. Llaman al API correspondiente
  2. Emiten evento IPC para notificar a ventana principal
  3. Cierran la ventana
- Los previews usan `PresentationView` para mostrar como se vera en vivo.
- Los selectores complejos (media, animacion) se abren como dialogs secundarios.
- Animaciones usan `LazyMotion` + `m` (no `motion` directamente).

## Agents relacionados

- Modelos Song, Themes, TagSongs, BiblePresentationSettings -> `/prisma/agents.md`
- Controllers/Services -> `/database/agents.md`
- PresentationView para previews -> `/app/ui/agents.md`
- Hooks de temas y tags -> `/app/contexts/agents.md`
- IPC de ventanas -> `/electron/agents.md`
