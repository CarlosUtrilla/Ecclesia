# Sistema de Chunks para Textos Bíblicos Largos

> **Documentación completa** de los cambios implementados en los últimos commits para división inteligente de textos bíblicos largos.

## Índice

1. [Objetivo](#objetivo)
2. [Arquitectura](#arquitectura)
3. [Flujo Completo](#flujo-completo)
4. [Archivos Modificados](#archivos-modificados)
5. [Problemas Resueltos](#problemas-resueltos)

---

## Objetivo

Dividir textos bíblicos largos en fragmentos (`chunks`) navegables para mostrarlos gradualmente en pantalla sin sobrecargar la vista. Cada chunk mantiene metadata del verso al que pertenece para navegación y badges correctos.

---

## Arquitectura

### Antes: Parallel Arrays (DEPRECADO)

```typescript
{
  chunkParts: string[]    // ['texto1', 'texto2', 'texto3']
  chunkVerses: number[]   // [1, 1, 2]  ← Fácil desincronizar
}
```

**Problema:** Dos arrays que deben mantenerse sincronizados manualmente.

### Ahora: Metadata Objects

```typescript
type BibleChunkWithMetadata = {
  book: number      // ID del libro bíblico
  chapter: number   // Número de capítulo
  verse: number     // Número de verso al que pertenece
  content: string   // Contenido del chunk
}

// Ejemplo:
chunks: BibleChunkWithMetadata[] = [
  { book: 16, chapter: 8, verse: 1, content: "y se juntó todo el pueblo..." },
  { book: 16, chapter: 8, verse: 1, content: "...como un solo hombre..." },
  { book: 16, chapter: 8, verse: 2, content: "Y trajeron el libro de la ley..." }
]
```

**Ventajas:**


- ✅ Metadata siempre disponible por chunk
- ✅ No hay riesgo de desincronización
- ✅ Más fácil de debuggear y mantener
- ✅ Verso del badge siempre correcto

---

## Flujo Completo

### 1. Hidratación desde Base de Datos

**Archivo:** `app/contexts/ScheduleContext/utils/indexDataItems.tsx`

Cuando se carga un item `BIBLE` o `PRESENTATION` con layers bíblicos:

```typescript
// Obtener versículos desde la BD
const result = await window.api.bible.getVerses({
  book: parsedBibleAccessData.bookId,    // Nehemías = 16
  chapter: parsedBibleAccessData.chapter, // 8
  verses: [1, 2, 3, 4, 5],               // Array de versículos
  version: 'RVR1960'
})

// Hidratar texto directamente desde la BD
const text = result.map((v) => v.text).join(' ')
```


**Formatos posibles del texto hidratado:**

- Con números de verso: `"1 y se juntó todo el pueblo... 2 Y trajeron el libro de la ley..."`
- Sin números: `"y se juntó todo el pueblo como un solo hombre en la plaza"`
- Con saltos de línea: `"1 texto<br/>con saltos\nde línea"`

**IMPORTANTE:** NO se agregan números de verso en código - vienen del DB o no vienen.

---

### 2. Configuración de Tamaño de Chunk

**Archivo:** `app/screens/settings/components/bibleLiveSection.tsx`

El usuario puede configurar el tamaño máximo de chunks:

```typescript
const BIBLE_LIVE_SPLIT_MODE_KEY = 'BIBLE_LIVE_CHUNK_MODE'

type BibleLiveSplitMode = 'auto' | '100' | '150' | '200' | '250'
```

**Cálculo de `maxChunkLength`:**

```typescript
// En indexDataItems.tsx y PresentationPreview.tsx
const splitSettings = await window.api.setttings.getSettings([
BIBLE_LIVE_CHUNK_MODE_KEY
])

const splitMode = splitSettings.find(s => s.key === BIBLE_LIVE_CHUNK_MODE_KEY)?.value

if (splitMode !== 'auto') {
  maxChunkLength = Number(splitMode)  // 100, 150, 200, 250
} else {
  // Escala según tamaño de fuente del tema
  const fontSize = theme.fontSize || 72
  const scaled = Math.round(180 * (72 / fontSize))
  maxChunkLength = Math.max(100, Math.min(250, scaled))
}
```

---

### 3. Limpieza y Validación de Texto

**Archivo:** `app/lib/presentationSlides.ts` → `resolveChunkParts()`

```typescript
// Limpiar saltos de línea y <br>
const cleanedText = sourceText
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/\n/g, ' ')

// Validar: rechazar HTML complejo (pero permitir <br>)
if (/<(?!br\s*\/?>)[^>]+>/i.test(sourceText)) {
  return undefined  // Tiene tags HTML → no chunkear
}
```

---

### 4. Detección de Versículos

**Archivo:** `app/lib/splitLongBibleVerse.ts` → `splitBibleRangeIntoVerses()`

```typescript
// Regex que detecta números de verso en múltiples formatos
const versePattern = /(\d+)\.?\)?\s+/g

// Soporta:
// "1 texto"     → match
// "1. texto"    → match
// "1.) texto"   → match
// "1texto"      → NO match (necesita espacio)
```

Extrae información de cada verso encontrado:

```typescript
const matches: Array<{ 
  verse: number;        // 1, 2, 3...
  start: number;        // Posición después del número
  matchLength: number   // Longitud del "1. "
}> = []

// Ejemplo de texto: "1 texto verso 1... 2 texto verso 2..."
// Resultado:
matches = [
  { verse: 1, start: 2, matchLength: 2 },   // después de "1 "
  { verse: 2, start: 23, matchLength: 2 }   // después de "2 "
]
```

---

### 5. División en Chunks (Split Inteligente)

**Archivo:** `app/lib/splitLongBibleVerse.ts` → `splitLongBibleVerse()`

El algoritmo respeta:

**Puntuación preferida:** `,` `.` `:` `;` `!` `?`
   - Busca dentro de ventana de ±24 caracteres del límite

2. **Límites de palabra:** espacios en blanco

3. **Ellipsis de continuidad:** `...` al inicio/final de chunks intermedios

```typescript
// Ejemplo de split:
const text = "y se juntó todo el pueblo como un solo hombre..."
const maxLength = 100

// Resultado:
chunks = [
  "y se juntó todo el pueblo como un solo hombre en la plaza...",
  "...que está delante de la puerta de las Aguas..."
]
```

---

### 6. Generación de Chunks con Metadata

**Archivo:** `app/lib/presentationSlides.ts` → `attachPresentationBibleChunkParts()`

```typescript
// Para cada slide con layers bíblicos
slides.forEach(slide => {
  slide.presentationItems?.forEach(layer => {
    if (layer.resourceType === 'BIBLE' && layer.text) {
      
      // Generar chunks
      const chunks = resolveChunkParts(
        layer.text,           // Texto hidratado
        maxChunkLength,       // 100, 150, 200, 250, auto
        layer.verse.bookId,
        layer.verse.chapter,
        layer.verse.verse,
        layer.verse.verseEnd
      )
      
      // Adjuntar al layer
      layer.chunks = chunks  // BibleChunkWithMetadata[]
    }
  })
})
```

**Función interna `resolveChunkParts`:**

```typescript
// Caso 1: Verso único (sin rango)
if (!verseEnd || verseEnd === verseStart) {
  const chunkTexts = splitLongBibleVerse(cleanedText, maxChunkLength)
  
  return chunkTexts.map(content => ({
    book: bookId,
    chapter,
    verse: verseStart,
    content
  }))
}

// Caso 2: Rango de versículos
const verses = splitBibleRangeIntoVerses(
  cleanedText,
  bookId,
  chapter,
  verseStart,
  verseEnd,
  maxChunkLength
)

return flattenVerseChunks(verses)
```

---

### 7. Navegación por Chunks

**Archivo:** `app/lib/presentationVerseController.ts`

```typescript
// Detectar si un slide tiene chunks
export const getSlideVerseRange = (slide?: PresentationViewItems) => {
  // Buscar layer con chunks
  const bibleLayer = slide.presentationItems?.find(
    layer => layer.resourceType === 'BIBLE' && layer.chunks
  )
  
  if (bibleLayer?.chunks) {
    return {
      mode: 'chunk',
      start: 1,
      end: bibleLayer.chunks.length,
      layerId: bibleLayer.id
    }
  }
  
  // Si no hay chunks, modo verse
  return null
}

// Resolver chunk actual
export const resolveSlideVerse = (
  slide,
  fallbackIndex,
  verseBySlideKey
) => {
  const range = getSlideVerseRange(slide)
  if (!range) return null
  
  const slideKey = getPresentationSlideKey(slide, fallbackIndex)
  const current = verseBySlideKey?.[slideKey] || range.start
  
  return { ...range, current, slideKey }
}
```

**slideStepController resultante:**

```typescript
{
  mode: 'chunk',             // Tipo de navegación
  current: 2,                // Chunk actual (1-indexed)
  start: 1,                  // Primer chunk
  end: 8,                    // Último chunk  
  slideKey: 'mnv9o00s-...',  // Key única del slide
  layerId: 'layer-abc123'    // ID del layer
}
```

---

### 8. Render de Chunks

**Archivo:** `app/ui/PresentationView/components/PresentationRender.tsx`

```typescript
// Calcular índice del chunk
const chunkIndex = (slideStepController?.current ?? 1) - 1

// Obtener chunk actual
const currentChunk = item.chunks?.[chunkIndex]

// Extraer datos
const chunkText = currentChunk?.content   // "...y se juntó todo el pueblo..."
const chunkVerse = currentChunk?.verse    // 1

// Usar en el render
<BibleTextRender
  text={chunkText}
  verse={{ ...item.verse, verse: chunkVerse }}
/>
```

**Badge de referencia:**

```typescript
// En PresentationView/index.tsx
const chunk = layer.chunks[currentChunkIndex - 1]
const actualVerse = chunk?.verse  // 1, 2, 3...

return buildPresentationBibleBadgeLabel({
  bookShortName: 'Neh',
  chapter: 8,
  rangeStart: 1,
  rangeEnd: 5,
  currentVerse: actualVerse  // ← Del chunk, no del item
})

// Resultado: "Neh 8:1" o "Neh 8:2" según el chunk actual
```

---

### 9. Navegación con Flechas

**Archivo:** `app/screens/panels/items-on-live/index.tsx`

```typescript
// Obtener controller del slide actual
const verseController = resolveSlideVerse(
  activeSlide,
  safeIndex,
  presentationVerseBySlideKey
)

// Flecha derecha →
if (verseController && verseController.current < verseController.end) {
  // Avanzar chunk
  setPresentationVerseBySlideKey(prev => ({
    ...prev,
    [verseController.slideKey]: verseController.current + 1
  }))
  return  // NO cambiar de slide
}

// Si llegaste al último chunk, avanzar slide
setItemIndex(itemIndex + 1)
```

---

### 10. Tooltips de Navegación

**Archivo:** `app/screens/panels/items-on-live/components/RenderPresentationLiveController/VerseRangeController.tsx`

```typescript
const loadAdjacentVersePreview = async (direction) => {
  if (verseController.mode === 'chunk') {
    const targetStep = direction === 'next' 
      ? verseController.current + 1 
      : verseController.current - 1
    
    // Obtener chunk adyacente
    const targetChunkIndex = targetStep - 1
    const chunk = activeSlide.presentationItems
      .find(layer => layer.resourceType === 'BIBLE')
      ?.chunks?.[targetChunkIndex]
    
    if (chunk) {
      // Construir tooltip con referencia + contenido
      const verseReference = `${bookShortName} ${chapter}:${chunk.verse}`
      const truncatedContent = trimPreviewText(chunk.content)
      const tooltipText = `${verseReference}\n${truncatedContent}`
      
      // Ejemplo:
      // "Neh 8:2
      //  Y trajeron el libro de la ley..."
      
      setNextVersePreviewText(tooltipText)
    }
  }
}
```

---

### 11. Preview de Presentaciones

**Archivo:** `app/screens/panels/library/presentations/components/PresentationPreview.tsx`

El preview de biblioteca ahora hidrata y genera chunks para mostrar **solo el primer chunk** (como se vería en live):

```typescript
// 1. Leer configuración de chunk size
const { data: splitSettings } = useQuery({
  queryKey: ['bible-chunk-mode-setting'],
  queryFn: () => window.api.setttings.getSettings(['BIBLE_LIVE_CHUNK_MODE'])
})

const maxChunkLength = useMemo(() => {
  const splitMode = isBibleLiveSplitMode(splitModeValue)
    ? splitModeValue 
    : 'auto'
  return resolveBibleChunkMaxLength(splitMode, theme.fontSize)
}, [splitSettings, themes])

// 2. Hidratar textos bíblicos
const { data: hydratedTexts } = useQuery({
  queryFn: async () => {
    return Promise.all(
      bibleReferences.map(async (ref) => {
        const result = await window.api.bible.getVerses({
          book: ref.bible.bookId,
          chapter: ref.bible.chapter,
          verses: [verseStart, ...],
          version: ref.bible.version
        })
        return { ...ref, text: result.map(v => v.text).join(' ') }
      })
    )
  }
})

// 3. Generar chunks
const viewItemsWithChunks = useMemo(() => {
  return presentation.slides.map((slide, slideIndex) => {
    let viewItem = presentationSlideToViewItem(slide, ...)
    
    // Hidratar layers bíblicos
    const hydratedLayers = viewItem.presentationItems.map(layer => {
      if (layer.resourceType === 'BIBLE') {
        const matchingText = hydratedTexts.find(...)
        return { ...layer, text: matchingText.text }
      }
      return layer
    })
    
    viewItem = { ...viewItem, presentationItems: hydratedLayers }
    
    // Generar chunks
    const itemsWithChunks = attachPresentationBibleChunkParts(
      [viewItem],
      maxChunkLength
    )
    return itemsWithChunks[0]
  })
}, [presentation.slides, hydratedTexts, maxChunkLength])

// 4. Forzar chunk 1 en todos los slides
const presentationVerseBySlideKey = useMemo(() => {
  const mapping = {}
  viewItemsWithChunks.forEach((viewItem, slideIndex) => {
    const slideKey = getPresentationSlideKey(viewItem, slideIndex)
    const range = getSlideVerseRange(viewItem)
    
    if (range?.mode === 'chunk') {
      mapping[slideKey] = 1  // Chunk 1
    }
  })
  return mapping
}, [viewItemsWithChunks])

// 5. Render
return viewItemsWithChunks.map((viewItem, slideIndex) => (
  <PresentationView
    items={[viewItem]}
    presentationVerseBySlideKey={presentationVerseBySlideKey}
    currentIndex={slideIndex}
  />
))
```

**Resultado:** Previews muestran exactamente cómo se verá en pantalla (solo chunk 1), no el texto completo.

---

## Archivos Modificados

### Core

| Archivo | Función | Cambios |
|---------|---------|---------|
| `app/lib/splitLongBibleVerse.ts` | Split inteligente | • Nuevo tipo `BibleChunkWithMetadata`<br>• Regex `/(\d+)\.?\)?\s+/g` soporta "1 ", "1. ", "1.) "<br>• `splitBibleRangeIntoVerses()` detecta versículos<br>• `flattenVerseChunks()` aplana a metadata objects |
| `app/lib/presentationSlides.ts` | Generación de chunks | • `resolveChunkParts()` limpia HTML y genera chunks<br>• `attachPresentationBibleChunkParts()` aplica chunks a slides<br>• Limpieza de `<br>` y `\n` en vez de rechazo |
| `app/lib/presentationVerseController.ts` | Navegación | • `getSlideVerseRange()` prioriza chunks sobre verses<br>• Retorna `mode: 'chunk'` cuando hay chunks |

### Context & Data

| Archivo | Función | Cambios |
|---------|---------|---------|
| `app/contexts/ScheduleContext/utils/indexDataItems.tsx` | Hidratación | • Obtiene texto desde BD con `window.api.bible.getVerses()`<br>• NO agrega números de verso (usa texto as-is)<br>• Calcula `maxChunkLength` según setting<br>• Aplica `attachPresentationBibleChunkParts()` |

### UI

| Archivo | Función | Cambios |
|---------|---------|---------|
| `app/ui/PresentationView/index.tsx` | Badge de referencia | • Lee `chunk.verse` en vez de `item.verse.verse`<br>• Badge muestra verso del chunk actual |
| `app/ui/PresentationView/components/PresentationRender.tsx` | Render de chunks | • Calcula `chunkIndex` desde `slideStepController.current`<br>• Lee `chunks[chunkIndex].content` y `.verse`<br>• Pasa al `BibleTextRender` |

### Controls

| Archivo | Función | Cambios |
|---------|---------|---------|
| `app/screens/panels/items-on-live/index.tsx` | Navegación con flechas | • Usa `resolveSlideVerse()` para detectar chunks<br>• Incrementa chunk si no llegó al final<br>• Avanza slide si llegó al último chunk |
| `app/screens/panels/items-on-live/components/RenderPresentationLiveController/VerseRangeController.tsx` | Tooltips | • Extrae chunk adyacente de `activeSlide.chunks`<br>• Construye tooltip con referencia + contenido |
| `app/screens/panels/items-on-live/components/RenderPresentationLiveController/index.tsx` | Controller principal | • Pasa `activeSlide` a `PresentationControllerFooter` |
| `app/screens/panels/items-on-live/components/RenderPresentationLiveController/PresentationControllerFooter.tsx` | Footer | • Recibe `activeSlide` y pasa a `VerseRangeController` |

### Preview

| Archivo | Función | Cambios |
|---------|---------|---------|
| `app/screens/panels/library/presentations/components/PresentationPreview.tsx` | Preview de biblioteca | • Lee setting de chunk size con `useQuery`<br>• Hidrata textos bíblicos desde BD<br>• Genera chunks con `attachPresentationBibleChunkParts`<br>• Fuerza chunk 1 en `presentationVerseBySlideKey` |

---

## Problemas Resueltos

| # | Problema | Causa | Solución |
|---|----------|-------|----------|
| 1 | Indicador siempre muestra verso 1 | Usaba `item.verse.verse` fijo | Lee `chunk.verse` del chunk actual |
| 2 | Texto no carga | Faltaba hidratación desde BD | Agregada en `indexDataItems.tsx` |
| 3 | Siempre renderiza chunk 0 | `slideStepController` no se pasaba | Ahora se propaga correctamente |
| 4 | Modo prioritario erróneo | `getSlideVerseRange` priorizaba verse | Ahora chunk primero |
| 5 | HTML rechazado (`<br>`) | Validación muy estricta | Limpia HTML en vez de rechazar |
| 6 | Formato "1." no detectado | Regex solo soportaba "1 " | Actualizado: `/(\d+)\.?\)?\s+/g` |
| 7 | Números duplicados | Se agregaban en hidratación | Ahora usa texto de BD as-is |
| 8 | maxChunkLength hardcoded | Preview usaba `150` fijo | Lee setting real del usuario |
| 9 | Preview muestra texto completo | No generaba chunks | Ahora hidrata + genera chunks |

---

## Testing

Para probar el sistema:

1. **Configurar chunk size:**
   - Ir a Settings → Bible Live
   - Cambiar entre 100/150/200/250/auto
   - Verificar que los chunks se recalculan

2. **Agregar texto largo al cronograma:**
   - Agregar Nehemías 8:1-8 a una presentación
   - Verificar que se divide en chunks
   - Navegar con flechas ← →

3. **Verificar badge:**
   - Debe mostrar "Neh 8:1" en chunk 1
   - "Neh 8:2" cuando navegas a chunk del verso 2
   - No debe quedar stuck en verso 1

4. **Tooltips:**
   - Hover sobre botón "siguiente"
   - Debe mostrar: `"Neh 8:2\nY trajeron el libro..."`

5. **Preview de biblioteca:**
   - Abrir panel Presentaciones
   - Verificar que slides con biblia muestran solo chunk 1
   - No debe mostrar texto completo

---

## Notas Importantes

- **Los chunks son 1-indexed:** `slideStepController.current` va de 1 a N, no de 0 a N-1
- **presentationVerseBySlideKey** usa el slideKey, no el slideIndex
- **maxChunkLength** se calcula **por item**, no globalmente
- **Hidratación debe hacerse antes de generar chunks**
- **Regex de versículos requiere espacio después del número**
- **HTML solo se rechaza si es complejo** (`<br>` se limpia, `<div>` se rechaza)

---

## Arquitectura Visual

```
┌─────────────────────────────────────────────────────┐
│ 1. Usuario configura chunk size en Settings        │
│    BIBLE_LIVE_CHUNK_MODE = '150'                    │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ 2. Item agregado al cronograma (PRESENTATION)       │
│    → indexDataItems.tsx                             │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ 3. Hidratación desde BD                             │
│    window.api.bible.getVerses(...)                  │
│    text = "1 texto verso 1... 2 texto verso 2..."   │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ 4. Limpieza de HTML                                 │
│    cleanedText = text.replace(/<br>/gi, ' ')        │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ 5. Detección de versículos                          │
│    matches = [{ verse: 1, start: 2 }, ...]          │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ 6. Split inteligente por verso                      │
│    splitLongBibleVerse(verseText, maxChunkLength)   │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ 7. Flatteado con metadata                           │
│    chunks: BibleChunkWithMetadata[] = [              │
│      { book: 16, chapter: 8, verse: 1, content },   │
│      { book: 16, chapter: 8, verse: 1, content },   │
│      { book: 16, chapter: 8, verse: 2, content }    │
│    ]                                                 │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ 8. Chunks adjuntados al layer                       │
│    layer.chunks = chunks                            │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ 9. Render inicial (chunk 1)                         │
│    chunkIndex = 0                                   │
│    currentChunk = chunks[0]                         │
│    badge = "Neh 8:1"                                │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ 10. Usuario presiona flecha →                       │
│     presentationVerseBySlideKey[slideKey] = 2       │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ 11. Re-render con chunk 2                           │
│     chunkIndex = 1                                  │
│     currentChunk = chunks[1]                        │
│     badge = "Neh 8:1" o "Neh 8:2" según el chunk    │
└─────────────────────────────────────────────────────┘
```

---

**Última actualización:** 12 de abril de 2026
