import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { sanitizeHTML } from '@/lib/utils'
import { wordVariants, AnimationType } from '@/lib/animations'
import { EditableBoundsTarget, PresentationViewItems, TextBoundsValues } from '../types'

/**
 * Props para el componente AnimatedText
 */
export interface AnimatedTextProps {
  item: PresentationViewItems // Elemento a mostrar (canción, versículo, etc.)
  animationType: AnimationType // Tipo de animación a aplicar
  variants: any // Variantes de animación de framer-motion
  textStyle: React.CSSProperties // Estilos CSS para el texto
  isPreview?: boolean // Modo preview (sin animaciones)
  textContainerPadding: {
    horizontal: number
    vertical: number
  }
  textContainerOffset: {
    x: number
    y: number
  }
  verticalAlign?: 'top' | 'center' | 'bottom'
  showTextBounds?: boolean
  textBoundsIsSelected?: boolean
  textBoundsBaseValues?: TextBoundsValues
  textBoundsScale?: {
    x: number
    y: number
  }
  onTextBoundsChange?: (next: TextBoundsValues) => void
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

export function AnimatedText({
  item,
  animationType,
  variants,
  textStyle,
  isPreview,
  textContainerPadding,
  textContainerOffset,
  verticalAlign = 'center',
  showTextBounds = false,
  textBoundsIsSelected = true,
  textBoundsBaseValues,
  textBoundsScale,
  onTextBoundsChange,
  onEditableTargetSelect
}: AnimatedTextProps) {
  const activeInteractionRef = useRef<ActiveBoundsInteraction | null>(null)
  const [boundsCursor, setBoundsCursor] = useState<React.CSSProperties['cursor']>('move')
  const { text: rawText } = item

  const shouldShowBounds = showTextBounds && textBoundsIsSelected

  const canEditBounds =
    shouldShowBounds &&
    onTextBoundsChange !== undefined &&
    textBoundsBaseValues !== undefined &&
    textBoundsScale !== undefined &&
    textBoundsScale.x > 0 &&
    textBoundsScale.y > 0

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

  const stopInteraction = useCallback(() => {
    activeInteractionRef.current = null
    setBoundsCursor('move')
    document.body.style.cursor = ''
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', stopInteraction)
  }, [handlePointerMove])

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopInteraction)
    }
  }, [handlePointerMove, stopInteraction])

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

  const text = useMemo(() => rawText || '', [rawText])

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

  const handleSelectTarget = useCallback(
    (target: EditableBoundsTarget) => {
      onEditableTargetSelect?.(target)
    },
    [onEditableTargetSelect]
  )

  const verticalAlignItems =
    verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center'

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
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: verticalAlignItems,
          justifyContent: 'center',
          boxSizing: 'border-box',
          padding: `${textContainerPadding.vertical}px ${textContainerPadding.horizontal}px`,
          transform: `translate(${textContainerOffset.x}px, ${textContainerOffset.y}px)`
        }}
        onPointerDown={() => {
          if (showTextBounds) {
            handleSelectTarget('text')
          }
        }}
      >
        <div style={{ width: '100%' }}>{content(text)}</div>
      </div>
    </>
  )
}
