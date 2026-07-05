# Plan: Copyright Text en Presentaciones de Canciones

## Resumen

Mostrar el autor y/o copyright de una canción como overlay en la esquina inferior izquierda de cada slide cuando se proyecta en vivo. El estilo de letra se configura por tema (igual que el texto bíblico/indicador), con toggle global y por tema.

---

## Arquitectura actual (lo que ya existe)

### Song
- `Song` en Prisma tiene `author: String?` y `copyright: String?`
- `SongResponseDTO` incluye ambos campos
- `indexDataItems.tsx` convierte `song.lyrics` a `PresentationViewItems[]` pero **descarta** `author` y `copyright`

### Theme textStyle (el patrón a replicar)
- `EditableBoundsTarget = 'text' | 'verse'` en `types.d.ts`
- `textStyle` es un JSON string en `Themes` (Prisma), parseado a objeto en runtime
- Claves con prefijo `verse*` (ej: `verseFontFamily`, `verseColor`) para estilos específicos del indicador bíblico
- Herencia: si no hay `verseFontFamily`, usa `fontFamily` del texto base
- `usePresentationTextLayout.ts` elimina claves `verse*` del estilo base antes de pasarlo al DOM
- `textStyleTarget.ts` tiene `getTargetTypographyStyle()`, `getTargetTextStyleFieldPath()`, `getTargetTextEffectsValue()`, `mapTextEffectsUpdatesToTarget()`

### Theme Editor
- `PreviewsItems` tiene 2 slides: texto genérico + versículo bíblico
- `ThemeToolbar` tiene toggle "Texto" / "Indicador" para elegir target de edición
- `selectedBoundsTarget` controla qué prefijo se usa al escribir en `textStyle`

### Global Settings
- Modelo `Setting` con enum `SettingOptions` en Prisma
- Valores se almacenan como string, booleanos como `'true'` / `'false'`

---

## Plan de implementación

### Fase 1: Preparación del tipo PresentationViewItems

**Archivos:** `types.d.ts`, `indexDataItems.tsx`

1. Agregar `songMeta?: { author?: string | null; copyright?: string | null }` a `PresentationViewItems` en `types.d.ts`

2. En `indexDataItems.tsx`, al construir el content de `SONG`:
   - Fetch del song incluye `author` y `copyright`
   - Pasar `songMeta: { author: song.author, copyright: song.copyright }` en cada `PresentationViewItems`
   - Si no hay ni author ni copyright, pasar `songMeta: undefined` para no renderizar nada

---

### Fase 2: Agregar copyright al sistema de estilos del tema

**Archivos:** `types.d.ts`, `textStyleTarget.ts`, `usePresentationTextLayout.ts`, `BibleTextRender.tsx` (inspiración)

2.1. En `types.d.ts`:
  - Cambiar `EditableBoundsTarget = 'text' | 'verse'` → `'text' | 'verse' | 'copyright'`

2.2. En `textStyleTarget.ts`:
  - Agregar `const toCopyrightPrefixedKey = (key: string) => `copyright${key.charAt(0).toUpperCase()}${key.slice(1)}``
  - En `getTargetTextStyleFieldPath()`: si target es `'copyright'`, usar `copyright*` prefijo
  - En `getTargetTypographyStyle()`: agregar case `'copyright'` con fallback a base text
  - En `getTargetTextEffectsValue()`: agregar case `'copyright'` con prefijo `copyright*`
  - En `mapTextEffectsUpdatesToTarget()`: agregar case `'copyright'` con mapeo a `copyright*`

2.3. En `usePresentationTextLayout.ts`:
  - Stripear todas las claves `copyright*` del `restTextStyle` (igual que se hace con `verse*`)
  - Keys a eliminar: `copyrightFontFamily`, `copyrightFontSize`, `copyrightColor`, `copyrightFontWeight`, `copyrightFontStyle`, `copyrightTextDecoration`, `copyrightLineHeight`, `copyrightLetterSpacing`, `copyrightTextAlign`, `copyrightJustifyContent`, `copyrightTextShadowEnabled/Color/Blur/OffsetX/OffsetY`, `copyrightTextStrokeEnabled/Color/Width`, `copyrightBlockBgEnabled/Color/Blur/Radius/Opacity/Padding`

---

### Fase 3: Crear CopyrightTextRender

**Archivo nuevo:** `components/CopyrightTextRender.tsx` (junto a `BibleTextRender.tsx`)

3.1. Crear `CopyrightTextRender`:
  - Recibe: `theme.textStyle`, `songMeta`, `presentationHeight`, `scaleFactor`, `hideTextInLive`
  - Lee las claves `copyright*` de `theme.textStyle` con fallback al estilo base
  - Renderiza un `<div>` fijo en la **esquina inferior izquierda** con el texto formateado
  - Formato del texto: `"Author - Copyright"` si ambos existen, solo uno si solo uno existe
  - Soporta: fontFamily, fontSize, color, fontWeight, fontStyle, textDecoration, lineHeight, letterSpacing, textShadow, textStroke, blockBg (igual que el texto bíblico)
  - Respeta `hideTextInLive` (no renderiza si está oculto)
  - El componente debe ser memoizado con `React.memo` para no re-renderizar en cada cambio de slide

---

### Fase 4: Integrar CopyrightTextRender en PresentationView

**Archivos:** `PresentationView/index.tsx`, `components/ResourceContent.tsx`, `components/PresentationBody.tsx`

4.1. En `ResourceContent.tsx` o `PresentationBody.tsx`:
  - Para items con `songMeta` y al menos un campo definido (author o copyright), renderizar `CopyrightTextRender` como overlay
  - Posicionar absolutamente en la esquina inferior izquierda
  - Debe estar dentro del flujo de render pero **no interferir** con el layout del texto principal

4.2. Lógica de visibilidad (global + tema):
  - En `PresentationView` o donde se renderice, verificar:
    1. Global setting `SHOW_COPYRIGHT_ON_LIVE` (leer de settings o pasar como prop)
    2. Theme toggle `textStyle.showCopyright` (default: true en temas nuevos)
  - Regla: global=OFF → nunca mostrar; global=ON → mostrar solo si theme también tiene ON
  - Si no hay global setting guardado, default = OFF (no mostrar)
  - Si no hay `textStyle.showCopyright` en el tema, default = true

---

### Fase 5: Theme Editor UI

**Archivos:** `themesEditor/index.tsx`, `ThemeToolbar.tsx`

5.1. En `themesEditor/index.tsx`:
  - Agregar tercer ítem a `PreviewsItems`:
    ```ts
    {
      text: 'Juan Pérez - © 2024 Iglesia Vida',
      songMeta: { author: 'Juan Pérez', copyright: '© 2024 Iglesia Vida' },
      resourceType: 'SONG'
    }
    ```
  - Agregar a `defaultValues.textStyle` en el formulario las claves de copyright:
    ```ts
    copyrightFontFamily: undefined,  // hereda de fontFamily
    copyrightFontSize: 12,           // tamaño más pequeño por defecto
    copyrightColor: undefined,       // hereda de color
    showCopyright: true
    ```
  - Las defaults de copyright deben ser valores que claramente se distingan del texto principal (por ejemplo, 50% del fontSize base, opacidad reducida)

5.2. En `ThemeToolbar.tsx`:
  - Agregar tercer botón al toggle group: `'Copyright'`
  - Texto del botón: "Copyright"
  - Cuando está seleccionado, todos los cambios de fuente/color/tamaño/efectos se aplican con prefijo `copyright*`

---

### Fase 6: Global Setting

**Archivos:** `schema.prisma`, `settingKeys.ts`, settings screen UI

6.1. En `schema.prisma`:
  - Agregar al enum `SettingOptions`:
    ```prisma
    SHOW_COPYRIGHT_ON_LIVE @map("presentation.copyright.showOnLive")
    ```

6.2. Ejecutar `prisma migrate dev` para generar la migración

6.3. En `settingKeys.ts`:
  - Agregar entrada:
    ```ts
    SHOW_COPYRIGHT_ON_LIVE: 'presentation.copyright.showOnLive'
    ```

6.4. En settings screen:
  - Agregar sección "Copyright en canciones" con un Switch
  - Label: "Mostrar autor/copyright en canciones en vivo"
  - Default: desactivado (false)
  - Fetch con `Api.fetch.settings.getSettings({ body: { settings: ['SHOW_COPYRIGHT_ON_LIVE'] } })`
  - Save con `Api.mutation.settings.updateSettings`

6.5. En `PresentationView`:
  - Pasar global setting como prop o leerlo desde el contexto
  - La lógica combinada: `showCopyright === globalEnabled && themeShowCopyright`

---

### Fase 7: Datos de prueba y edge cases

7.1. **Sin autor ni copyright**: No mostrar el overlay (ya `songMeta` sería undefined)

7.2. **Solo autor**: Mostrar "Juan Pérez"

7.3. **Solo copyright**: Mostrar "© 2024 Iglesia Vida"

7.4. **Ambos**: Mostrar "Juan Pérez - © 2024 Iglesia Vida"

7.5. **hideTextInLive activo**: El copyright también debe ocultarse

7.6. **Tema nuevo**: `showCopyright` default true en `defaultValues`

7.7. **Tema existente sin `showCopyright`**: Tratar como true (default para compatibilidad)

7.8. **Global setting no existe en DB**: Tratar como false (default)

7.9. **Preview en song editor**: Actualizar el preview en `songEditor/index.tsx` para que use el nuevo mecanismo en lugar de concatenar manualmente

7.10. **Live screens**: Asegurar que el copyright se renderiza correctamente en las ventanas live (no solo en preview del panel items-on-live)

---

## Archivos a modificar/crear

### Modificaciones existentes
| Archivo | Cambio |
|---------|--------|
| `app/ui/PresentationView/types.d.ts` | Agregar `songMeta` a `PresentationViewItems`; extender `EditableBoundsTarget` |
| `app/screens/editors/themesEditor/textStyleTarget.ts` | Agregar case `copyright` en las 4 funciones |
| `app/ui/PresentationView/hooks/usePresentationTextLayout.ts` | Stripear claves `copyright*` |
| `app/screens/editors/themesEditor/index.tsx` | Agregar tercer preview slide + defaults |
| `app/screens/editors/themesEditor/ThemeToolbar.tsx` | Agregar botón "Copyright" al toggle |
| `app/contexts/ScheduleContext/utils/indexDataItems.tsx` | Incluir `songMeta` en items SONG |
| `apps/api/src/controllers/settings/settingKeys.ts` | Agregar key del global setting |
| `apps/api/prisma/schema.prisma` | Agregar `SHOW_COPYRIGHT_ON_LIVE` al enum |
| `app/screens/settings/index.tsx` | Agregar sección de copyright toggle |
| `app/screens/editors/songEditor/index.tsx` | Actualizar preview para usar songMeta |
| `app/ui/PresentationView/components/ResourceContent.tsx` | Integrar `CopyrightTextRender` |
| `app/ui/PresentationView/index.tsx` | Conectar global setting + theme toggle lógica |

### Archivos nuevos
| Archivo | Propósito |
|---------|-----------|
| `app/ui/PresentationView/components/CopyrightTextRender.tsx` | Componente de render de copyright |

### Migración de base de datos
- `apps/api/prisma/migrations/` — Nueva migración para `SHOW_COPYRIGHT_ON_LIVE`

---

## Orden de implementación sugerido

```
Fase 1: PresentationViewItems.songMeta + indexDataItems (preparar datos)
Fase 2: textStyleTarget + usePresentationTextLayout (preparar sistema de estilos)
Fase 3: CopyrightTextRender (componente de render)
Fase 4: Integrar en PresentationView (ResourceContent)
Fase 5: Theme Editor UI (tercer slide + toolbar)
Fase 6: Global Setting (Prisma + migration + UI)
Fase 7: Edge cases + song editor preview
```

Cada fase debe verificarse con `pnpm vitest run` antes de pasar a la siguiente.

---

## Estado

| Fase | Estado | Notas |
|------|--------|-------|
| 1 | ⬜ Pendiente | |
| 2 | ⬜ Pendiente | |
| 3 | ⬜ Pendiente | |
| 4 | ⬜ Pendiente | |
| 5 | ⬜ Pendiente | |
| 6 | ⬜ Pendiente | |
| 7 | ⬜ Pendiente | |
| Tests | ⬜ Pendiente | |
