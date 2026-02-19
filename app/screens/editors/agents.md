# Editors Agent

> **Agent router:** [`/agents.md`](../../../agents.md)

## Descripcion

Editores de la aplicacion. Se abren en ventanas separadas de Electron (excepto la configuracion de biblia que es un dialog). Cada editor gestiona la creacion y edicion de un tipo de recurso.

## Archivos

```
app/screens/editors/
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
└── tagSongsEditor.tsx/
    └── index.tsx                # TagSongsEditor: editor de etiquetas de canciones
```

## Song Editor

**Ruta:** `/song/new` o `/song/:id`
**Ventana:** Se abre via `window.windowAPI.openSongWindow(songId?)`

### Layout

```
[Formulario de cancion]  |  [Preview de slides]  |  [Selector de tema]
     (col 2-3)           |      (col 8-9)        |      (sidebar)
```

### Funcionalidad

- **Formulario**: titulo, autor, copyright (React Hook Form + Zod).
- **Editor de letras**: TipTap rich text editor con estrofas agrupadas por tags.
- **SongGroup**: Cada estrofa tiene un selector de tag (Verso, Coro, Puente) con color.
- **Preview**: Muestra slides de la cancion usando `PresentationView` con el tema seleccionado.
- **fullText**: Se genera automaticamente concatenando el contenido de todas las estrofas (sin HTML).

### Flujo de guardado

```
1. Usuario edita -> React Hook Form trackea cambios
2. Click "Guardar" -> validacion Zod
3. window.api.songs.createSong() o updateSong()
4. ipcRenderer.send('song-saved') -> notifica a ventana principal
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

### Layout

```
[Formulario de tema]     |  [Preview grande]    |  [Miniaturas de slides]
  (sidebar izquierdo)    |   (centro)           |    (barra inferior)
```

### Funcionalidad

- **Nombre del tema**: Campo unico.
- **Fondo**: `BackgroundSelector` con 3 opciones:
  - Color solido (ColorPicker)
  - Imagen (MediaPicker dialog)
  - Video (MediaPicker dialog)
- **Estilos de texto**: fontSize, fontFamily, fontWeight, color, textAlign, letterSpacing, lineHeight.
- **Animacion**: `AnimationSelector` (selector rapido) + `AnimationEditor` (dialog detallado).
  - Tipos: fade, slide, scale, rotate, flip, bounce, blur, zoom, split, none.
  - Parametros: duracion, delay, easing.
- **Config de biblia**: Toggle "usar config global" o configuracion personalizada por tema.
- **Preview en vivo**: `PresentationView` con items de ejemplo.

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

## Bible Presentation Configuration

**UI:** Dialog (no ventana separada), se abre desde el panel de biblia.

### Funcionalidad

- Configura como se muestra la referencia biblica en presentaciones.
- Opciones:
  - Modo de descripcion: nombre corto o completo del libro.
  - Posicion: antes/despues/encima/debajo del texto, arriba/abajo de la pantalla.
  - Mostrar version, mostrar numero de versiculo.
  - Offset en px para posiciones de pantalla.
- Puede configurarse globalmente o por tema individual.

## Tag Songs Editor

**Ruta:** `/tagSongEditor`
**Ventana:** Se abre via `window.windowAPI.openTagsSongWindow()`

### Funcionalidad

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
