import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { sanitizeHTML } from '@/lib/utils'
import { wordVariants, AnimationType } from '@/lib/animations'
import { BASE_PRESENTATION_HEIGHT } from '@/lib/themeConstants'
import {
  EditableBoundsTarget,
  PresentationViewItems,
  ThemeWithMedia,
  TextBoundsValues
} from '../types'
import useBiblePresentationSetting from '../hooks/useBibleSetting'
import useBibleSchema from '@/hooks/useBibleSchema'

/**
 * Props para el componente AnimatedText
 */
interface AnimatedTextProps {
  item: PresentationViewItems // Elemento a mostrar (canción, versículo, etc.)
  animationType: AnimationType // Tipo de animación a aplicar
  variants: any // Variantes de animación de framer-motion
  textStyle: React.CSSProperties // Estilos CSS para el texto
  isPreview?: boolean // Modo preview (sin animaciones)
  theme: ThemeWithMedia // Tema con configuración de presentación
  smallFontSize: string // Indica si se debe usar un tamaño de fuente más pequeño
  textContainerPadding: {
    horizontal: number
    vertical: number
  }
  textContainerOffset: {
    x: number
    y: number
  }
  scaleFactor: number
  presentationHeight: number
  showTextBounds?: boolean
  textBoundsIsSelected?: boolean
  bibleVerseIsSelected?: boolean
  textBoundsBaseValues?: TextBoundsValues
  textBoundsScale?: {
    x: number
    y: number
  }
  onTextBoundsChange?: (next: TextBoundsValues) => void
  onBibleVersePositionChange?: (next: number) => void
  onEditableTargetSelect?: (target: EditableBoundsTarget) => void
}

type BoundsInteractionMode =
  | 'move'
  | 'resize-left'
  | 'resize-right'
  | 'resize-top'
  | 'resize-bottom'
  | 'resize-top-left'
  | 'resize-top-right'
  | 'resize-bottom-left'
  | 'resize-bottom-right'

type ActiveBoundsInteraction = {
  mode: BoundsInteractionMode
  startX: number
  startY: number
  startValues: TextBoundsValues
}

type ActiveVerseInteraction = {
  startY: number
  startValue: number
  position: 'upScreen' | 'downScreen'
}

const MAX_BIBLE_EDGE_OFFSET_BASE = 72

/**
 * Componente para renderizar texto con animaciones en la vista de presentación.
 * Soporta versículos bíblicos con diferentes configuraciones de visualización.
 */
export function AnimatedText({
  item,
  animationType,
  variants,
  textStyle,
  isPreview,
  theme,
  smallFontSize,
  textContainerPadding,
  textContainerOffset,
  scaleFactor,
  presentationHeight,
  showTextBounds = false,
  textBoundsIsSelected = true,
  bibleVerseIsSelected = false,
  textBoundsBaseValues,
  textBoundsScale,
  onTextBoundsChange,
  onBibleVersePositionChange,
  onEditableTargetSelect
}: AnimatedTextProps) {
  const activeInteractionRef = useRef<ActiveBoundsInteraction | null>(null)
  const activeVerseInteractionRef = useRef<ActiveVerseInteraction | null>(null)
  const [boundsCursor, setBoundsCursor] = useState<React.CSSProperties['cursor']>('move')
  const [verseCursor, setVerseCursor] = useState<React.CSSProperties['cursor']>('move')
  const { text: rawText, verse } = item
  const { biblePresentationSettings } = useBiblePresentationSetting()
  const { getCompleteNameById, getShortNameById } = useBibleSchema()

  const selectedBiblePresentationSettings = useMemo(
    () =>
      theme.useDefaultBibleSettings ? biblePresentationSettings : theme.biblePresentationSettings!,
    [theme.useDefaultBibleSettings, theme.biblePresentationSettings, biblePresentationSettings]
  )

  const isScreenModeVerse = useMemo(
    () =>
      verse &&
      (selectedBiblePresentationSettings?.position === 'upScreen' ||
        selectedBiblePresentationSettings?.position === 'downScreen'),
    [verse, selectedBiblePresentationSettings?.position]
  )

  const shouldShowBounds = showTextBounds && textBoundsIsSelected

  const canEditBounds =
    shouldShowBounds &&
    onTextBoundsChange !== undefined &&
    textBoundsBaseValues !== undefined &&
    textBoundsScale !== undefined &&
    textBoundsScale.x > 0 &&
    textBoundsScale.y > 0

  const positionIsScreenMode =
    selectedBiblePresentationSettings?.position === 'upScreen' ||
    selectedBiblePresentationSettings?.position === 'downScreen'

  const rawVersePositionStyle = Number(selectedBiblePresentationSettings?.positionStyle || 0)
  const clampedVersePositionStyle = Math.min(
    Math.max(0, rawVersePositionStyle),
    MAX_BIBLE_EDGE_OFFSET_BASE
  )

  const shouldShowVerseBounds = showTextBounds && bibleVerseIsSelected && isScreenModeVerse
  const canEditVerseBounds =
    showTextBounds &&
    onBibleVersePositionChange !== undefined &&
    positionIsScreenMode &&
    scaleFactor > 0

  const applyBoundsChange = useCallback(
    (nextValues: TextBoundsValues) => {
      if (!onTextBoundsChange) return

      const paddingInline = Math.max(0, Math.round(nextValues.paddingInline))
      const paddingBlock = Math.max(0, Math.round(nextValues.paddingBlock))
      const translateX = Math.max(
        -paddingInline,
        Math.min(paddingInline, Math.round(nextValues.translateX))
      )
      const translateY = Math.max(
        -paddingBlock,
        Math.min(paddingBlock, Math.round(nextValues.translateY))
      )

      onTextBoundsChange({
        paddingInline,
        paddingBlock,
        translateX,
        translateY
      })
    },
    [onTextBoundsChange]
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!canEditBounds || !textBoundsScale) return

      const activeInteraction = activeInteractionRef.current
      if (!activeInteraction) return

      const deltaXInBase = (event.clientX - activeInteraction.startX) / textBoundsScale.x
      const deltaYInBase = (event.clientY - activeInteraction.startY) / textBoundsScale.y

      const start = activeInteraction.startValues
      let nextPaddingInline = start.paddingInline
      let nextPaddingBlock = start.paddingBlock
      let nextTranslateX = start.translateX
      let nextTranslateY = start.translateY
      const mode = activeInteraction.mode

      if (mode === 'move') {
        nextTranslateX = start.translateX + deltaXInBase
        nextTranslateY = start.translateY + deltaYInBase
      }

      if (mode === 'resize-left' || mode === 'resize-top-left' || mode === 'resize-bottom-left') {
        const nextLeftMargin = Math.max(0, start.paddingInline + start.translateX + deltaXInBase)
        const fixedRightMargin = Math.max(0, start.paddingInline - start.translateX)
        nextPaddingInline = (nextLeftMargin + fixedRightMargin) / 2
        nextTranslateX = (nextLeftMargin - fixedRightMargin) / 2
      }

      if (
        mode === 'resize-right' ||
        mode === 'resize-top-right' ||
        mode === 'resize-bottom-right'
      ) {
        const fixedLeftMargin = Math.max(0, start.paddingInline + start.translateX)
        const nextRightMargin = Math.max(0, start.paddingInline - start.translateX - deltaXInBase)
        nextPaddingInline = (fixedLeftMargin + nextRightMargin) / 2
        nextTranslateX = (fixedLeftMargin - nextRightMargin) / 2
      }

      if (mode === 'resize-top' || mode === 'resize-top-left' || mode === 'resize-top-right') {
        const nextTopMargin = Math.max(0, start.paddingBlock + start.translateY + deltaYInBase)
        const fixedBottomMargin = Math.max(0, start.paddingBlock - start.translateY)
        nextPaddingBlock = (nextTopMargin + fixedBottomMargin) / 2
        nextTranslateY = (nextTopMargin - fixedBottomMargin) / 2
      }

      if (
        mode === 'resize-bottom' ||
        mode === 'resize-bottom-left' ||
        mode === 'resize-bottom-right'
      ) {
        const fixedTopMargin = Math.max(0, start.paddingBlock + start.translateY)
        const nextBottomMargin = Math.max(0, start.paddingBlock - start.translateY - deltaYInBase)
        nextPaddingBlock = (fixedTopMargin + nextBottomMargin) / 2
        nextTranslateY = (fixedTopMargin - nextBottomMargin) / 2
      }

      applyBoundsChange({
        paddingInline: nextPaddingInline,
        paddingBlock: nextPaddingBlock,
        translateX: nextTranslateX,
        translateY: nextTranslateY
      })
    },
    [applyBoundsChange, canEditBounds, textBoundsScale]
  )

  const getCursorFromMode = useCallback((mode: BoundsInteractionMode) => {
    if (mode === 'resize-top-left' || mode === 'resize-bottom-right') return 'nwse-resize'
    if (mode === 'resize-top-right' || mode === 'resize-bottom-left') return 'nesw-resize'
    if (mode === 'resize-left' || mode === 'resize-right') return 'ew-resize'
    if (mode === 'resize-top' || mode === 'resize-bottom') return 'ns-resize'
    return 'move'
  }, [])

  const handleVersePointerMove = useCallback(
    (event: PointerEvent) => {
      const activeVerse = activeVerseInteractionRef.current
      if (!activeVerse || !scaleFactor || !onBibleVersePositionChange) return

      const deltaYBase = (event.clientY - activeVerse.startY) / scaleFactor
      const nextValueRaw =
        activeVerse.position === 'upScreen'
          ? activeVerse.startValue + deltaYBase
          : activeVerse.startValue - deltaYBase

      const nextValue = Math.round(Math.min(Math.max(0, nextValueRaw), MAX_BIBLE_EDGE_OFFSET_BASE))

      onBibleVersePositionChange(nextValue)
    },
    [onBibleVersePositionChange, scaleFactor]
  )

  const stopInteraction = useCallback(() => {
    activeInteractionRef.current = null
    activeVerseInteractionRef.current = null
    setBoundsCursor('move')
    setVerseCursor('move')
    document.body.style.cursor = ''
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointermove', handleVersePointerMove)
    window.removeEventListener('pointerup', stopInteraction)
  }, [handlePointerMove, handleVersePointerMove])

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointermove', handleVersePointerMove)
      window.removeEventListener('pointerup', stopInteraction)
    }
  }, [handlePointerMove, handleVersePointerMove, stopInteraction])

  const startInteraction = useCallback(
    (mode: BoundsInteractionMode, event: React.PointerEvent<HTMLElement>) => {
      if (!canEditBounds || !textBoundsBaseValues) return
      event.preventDefault()
      event.stopPropagation()

      activeInteractionRef.current = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startValues: {
          ...textBoundsBaseValues
        }
      }

      const cursor = getCursorFromMode(mode)
      setBoundsCursor(cursor)
      document.body.style.cursor = cursor

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', stopInteraction)
    },
    [canEditBounds, getCursorFromMode, handlePointerMove, stopInteraction, textBoundsBaseValues]
  )

  const detectInteractionMode = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): BoundsInteractionMode => {
      const target = event.currentTarget.getBoundingClientRect()
      const edgeThreshold = 10
      const offsetX = event.clientX - target.left
      const offsetY = event.clientY - target.top

      const nearLeft = offsetX <= edgeThreshold
      const nearRight = target.width - offsetX <= edgeThreshold
      const nearTop = offsetY <= edgeThreshold
      const nearBottom = target.height - offsetY <= edgeThreshold

      if (nearTop && nearLeft) return 'resize-top-left'
      if (nearTop && nearRight) return 'resize-top-right'
      if (nearBottom && nearLeft) return 'resize-bottom-left'
      if (nearBottom && nearRight) return 'resize-bottom-right'

      if (nearLeft && !nearTop && !nearBottom) return 'resize-left'
      if (nearRight && !nearTop && !nearBottom) return 'resize-right'
      if (nearTop) return 'resize-top'
      if (nearBottom) return 'resize-bottom'
      return 'move'
    },
    []
  )

  const startVerseInteraction = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!canEditVerseBounds) return
      event.preventDefault()
      event.stopPropagation()

      const currentPosition = selectedBiblePresentationSettings?.position
      if (currentPosition !== 'upScreen' && currentPosition !== 'downScreen') return

      activeVerseInteractionRef.current = {
        startY: event.clientY,
        startValue: clampedVersePositionStyle,
        position: currentPosition
      }

      setVerseCursor('ns-resize')
      document.body.style.cursor = 'ns-resize'
      window.addEventListener('pointermove', handleVersePointerMove)
      window.addEventListener('pointerup', stopInteraction)
    },
    [
      canEditVerseBounds,
      clampedVersePositionStyle,
      handleVersePointerMove,
      selectedBiblePresentationSettings?.position,
      stopInteraction
    ]
  )

  const cornerHandleStyle: React.CSSProperties = {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.75)',
    background: 'rgba(20,184,166,0.9)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
    zIndex: 3
  }

  // Construye el texto de la referencia bíblica (ej: "Juan 3:16 (RVR1960)")
  const verseText = useMemo(() => {
    if (!verse || !selectedBiblePresentationSettings) return ''
    const { showVersion, description } = selectedBiblePresentationSettings

    const bookName =
      description === 'complete'
        ? getCompleteNameById(verse.bookId)
        : getShortNameById(verse.bookId)

    const versionText = showVersion ? ` (${verse.version})` : ''

    return `${bookName} ${verse.chapter}:${verse.verse}${versionText}`
  }, [verse, selectedBiblePresentationSettings, getCompleteNameById, getShortNameById])

  // Envuelve el verseText en un span con el tamaño de fuente pequeño
  const formattedVerseText = useMemo(() => {
    if (!verseText) return ''
    return `<span style="font-size: ${smallFontSize}">${verseText}</span>`
  }, [verseText, smallFontSize])

  // Construye el texto final combinando el contenido con la referencia bíblica según la configuración
  const text = useMemo(() => {
    let finalText = rawText || ''
    // Solo número de versículo antes del texto
    if (verse && selectedBiblePresentationSettings?.showVerseNumber) {
      finalText = `${verse.verse} ${finalText}`
    }

    // Si es modo pantalla (arriba/abajo), no incluir referencia en el texto principal
    if (verse && !isScreenModeVerse && selectedBiblePresentationSettings) {
      const position = selectedBiblePresentationSettings.position

      // Referencia después del texto
      if (position === 'afterText') {
        finalText = `${finalText} ${formattedVerseText}`
      }
      // Referencia antes del texto
      if (position === 'beforeText') {
        finalText = `${formattedVerseText} ${finalText}`
      }
      // Referencia debajo del texto
      if (position === 'underText') {
        finalText = `${finalText} <br/> ${formattedVerseText}`
      }
      // Referencia encima del texto
      if (position === 'overText') {
        finalText = `${formattedVerseText} <br/> ${finalText}`
      }
    }

    return finalText
  }, [rawText, isScreenModeVerse, verse, formattedVerseText, selectedBiblePresentationSettings])

  /**
   * Renderiza el contenido del texto con o sin animaciones
   * @param textContext - El texto a renderizar
   */
  const content = useCallback(
    (textContext: string) => {
      if (isPreview) {
        return (
          <div style={textStyle} dangerouslySetInnerHTML={{ __html: sanitizeHTML(textContext) }} />
        )
      }

      // Animación palabra por palabra
      if (animationType === 'split') {
        // Dividir por saltos de línea (soporta <br>, <br/>, <br />)
        const lines = textContext.split(/<br\s*\/?>/i)

        return (
          <m.div
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={textStyle}
          >
            {lines.map((line, lineIndex) => {
              // Dividir cada línea en palabras, eliminando espacios vacíos
              const words = line
                .trim()
                .split(' ')
                .filter((word) => word.length > 0)

              return (
                <div key={lineIndex}>
                  {words.map((word, wordIndex) => (
                    <m.span
                      key={`${lineIndex}-${wordIndex}`}
                      variants={wordVariants}
                      style={{ display: 'inline-block', marginRight: '0.3em' }}
                      dangerouslySetInnerHTML={{ __html: sanitizeHTML(word) }}
                    />
                  ))}
                  {/* Salto de línea entre líneas (excepto la última) */}
                  {lineIndex < lines.length - 1 && <br />}
                </div>
              )
            })}
          </m.div>
        )
      }

      // Animación de bloque completo (otras animaciones)
      return (
        <m.div
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={textStyle}
          dangerouslySetInnerHTML={{ __html: sanitizeHTML(textContext) }}
        />
      )
    },
    [animationType, variants, textStyle, isPreview]
  )

  const safePresentationHeight =
    Number.isFinite(presentationHeight) && presentationHeight > 0
      ? presentationHeight
      : BASE_PRESENTATION_HEIGHT
  const verseEdgeOffsetPx = `${(safePresentationHeight * clampedVersePositionStyle) / BASE_PRESENTATION_HEIGHT}px`

  const handleSelectTarget = useCallback(
    (target: EditableBoundsTarget) => {
      onEditableTargetSelect?.(target)
    },
    [onEditableTargetSelect]
  )

  return (
    <>
      {shouldShowBounds ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: textContainerPadding.vertical,
            right: textContainerPadding.horizontal,
            bottom: textContainerPadding.vertical,
            left: textContainerPadding.horizontal,
            border: '2px dashed rgba(255,255,255,0.65)',
            borderRadius: 8,
            pointerEvents: canEditBounds ? 'auto' : 'none',
            zIndex: 2,
            cursor: canEditBounds ? boundsCursor : 'default',
            touchAction: 'none',
            transform: `translate(${textContainerOffset.x}px, ${textContainerOffset.y}px)`
          }}
          onPointerMove={(event) => {
            if (!canEditBounds || activeInteractionRef.current) return
            const mode = detectInteractionMode(event)
            setBoundsCursor(getCursorFromMode(mode))
          }}
          onPointerLeave={() => {
            if (!activeInteractionRef.current) {
              setBoundsCursor('move')
            }
          }}
          onPointerDown={(event) => {
            const mode = detectInteractionMode(event)
            startInteraction(mode, event)
          }}
        >
          {canEditBounds ? (
            <>
              <button
                type="button"
                aria-label="Redimensionar esquina superior izquierda"
                style={{
                  ...cornerHandleStyle,
                  left: -5.5,
                  top: -5.5,
                  cursor: 'nwse-resize'
                }}
                onPointerDown={(event) => startInteraction('resize-top-left', event)}
              />
              <button
                type="button"
                aria-label="Redimensionar esquina superior derecha"
                style={{
                  ...cornerHandleStyle,
                  right: -5.5,
                  top: -5.5,
                  cursor: 'nesw-resize'
                }}
                onPointerDown={(event) => startInteraction('resize-top-right', event)}
              />
              <button
                type="button"
                aria-label="Redimensionar esquina inferior izquierda"
                style={{
                  ...cornerHandleStyle,
                  left: -5.5,
                  bottom: -5.5,
                  cursor: 'nesw-resize'
                }}
                onPointerDown={(event) => startInteraction('resize-bottom-left', event)}
              />
              <button
                type="button"
                aria-label="Redimensionar esquina inferior derecha"
                style={{
                  ...cornerHandleStyle,
                  right: -5.5,
                  bottom: -5.5,
                  cursor: 'nwse-resize'
                }}
                onPointerDown={(event) => startInteraction('resize-bottom-right', event)}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {/* Contenido principal del texto */}
      <div
        key={text}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          padding: `${textContainerPadding.vertical}px ${textContainerPadding.horizontal}px`,
          transform: `translate(${textContainerOffset.x}px, ${textContainerOffset.y}px)`
        }}
        onPointerDown={() => {
          if (showTextBounds) {
            handleSelectTarget('text')
          }
        }}
      >
        {content(text)}
      </div>

      {/* Referencia bíblica posicionada en pantalla (arriba o abajo) */}
      {isScreenModeVerse && verseText && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: smallFontSize,
            cursor: canEditVerseBounds ? verseCursor : 'default',
            border: shouldShowVerseBounds ? '2px dashed rgba(255,255,255,0.65)' : 'none',
            borderRadius: shouldShowVerseBounds ? 8 : 0,
            padding: shouldShowVerseBounds ? '2px 6px' : 0,
            touchAction: canEditVerseBounds ? 'none' : 'auto',
            pointerEvents: 'auto',
            zIndex: shouldShowVerseBounds ? 2 : 1,
            bottom:
              selectedBiblePresentationSettings?.position === 'downScreen'
                ? verseEdgeOffsetPx
                : 'auto',
            top:
              selectedBiblePresentationSettings?.position === 'upScreen'
                ? verseEdgeOffsetPx
                : 'auto'
          }}
          onPointerDown={(event) => {
            if (showTextBounds) {
              handleSelectTarget('verse')
            }

            if (!canEditVerseBounds) {
              return
            }

            startVerseInteraction(event)
          }}
          onPointerMove={() => {
            if (canEditVerseBounds && !activeVerseInteractionRef.current) {
              setVerseCursor('ns-resize')
            }
          }}
          onPointerLeave={() => {
            if (!activeVerseInteractionRef.current) {
              setVerseCursor('move')
            }
          }}
        >
          {content(formattedVerseText)}
        </div>
      )}
    </>
  )
}
