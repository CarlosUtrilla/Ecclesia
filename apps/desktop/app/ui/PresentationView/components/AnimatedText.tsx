import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { m, type Variants } from 'framer-motion'
import { sanitizeHTML } from '@/lib/utils'
import { AnimationType, getWordVariants } from '@/lib/animations'
import { EditableBoundsTarget, PresentationViewItems, TextBoundsValues } from '../types'
import { useTextBoundsInteraction } from '../hooks/useTextBoundsInteraction'
import { splitHtmlForWordAnimation } from '../utils/splitHtmlForWordAnimation'

/**
 * Props para el componente AnimatedText
 */
export interface AnimatedTextProps {
  item: PresentationViewItems // Elemento a mostrar (canción, versículo, etc.)
  animationType: AnimationType // Tipo de animación a aplicar
  variants: Variants // Variantes de animación de framer-motion
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
  hideTextInLive?: boolean
  blockBgStyle?: React.CSSProperties | null
  blockBgPadding?: number | null
  animationDuration?: number
  /** Reduce el tamaño de letra si el texto no cabe en su caja (alto disponible). */
  autoFit?: boolean
  /**
   * Espacio (px desde el borde de la caja) que el auto-ajuste debe dejar libre,
   * p. ej. para la referencia bíblica superpuesta arriba o abajo.
   */
  autoFitReserve?: { top: number; bottom: number }
}

/** Límite inferior del auto-ajuste: por debajo el texto deja de ser legible en pantalla. */
const MIN_AUTO_FIT_SCALE = 0.5

const CORNER_HANDLE_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 11,
  height: 11,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.75)',
  background: 'rgba(20,184,166,0.9)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
  zIndex: 3
}

function AnimatedTextComponent({
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
  onEditableTargetSelect,
  hideTextInLive = false,
  blockBgStyle,
  blockBgPadding,
  animationDuration = 0.4,
  autoFit = false,
  autoFitReserve
}: AnimatedTextProps) {
  const { text: rawText } = item
  const text = rawText || ''

  const boxRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  // boxSize y fontsVersion solo existen para provocar un re-render (y por tanto
  // una nueva medida) cuando cambia la caja o termina de cargar una fuente web.
  const [, setBoxSize] = useState({ width: 0, height: 0 })
  const [, setFontsVersion] = useState(0)
  const [fitScale, setFitScale] = useState(1)
  const reserveTop = autoFitReserve?.top ?? 0
  const reserveBottom = autoFitReserve?.bottom ?? 0
  const appliedFitScale = autoFit ? fitScale : 1

  useEffect(() => {
    if (!autoFit || !boxRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBoxSize((prev) =>
        Math.round(prev.width) === Math.round(width) &&
        Math.round(prev.height) === Math.round(height)
          ? prev
          : { width, height }
      )
    })
    observer.observe(boxRef.current)
    const onFontsLoaded = () => setFontsVersion((v) => v + 1)
    document.fonts?.addEventListener('loadingdone', onFontsLoaded)
    return () => {
      observer.disconnect()
      document.fonts?.removeEventListener('loadingdone', onFontsLoaded)
    }
  }, [autoFit])

  const baseFontSize =
    typeof textStyle.fontSize === 'number'
      ? textStyle.fontSize
      : typeof textStyle.fontSize === 'string'
        ? parseFloat(textStyle.fontSize)
        : NaN

  const fittedTextStyle = useMemo(
    () =>
      appliedFitScale < 1 && Number.isFinite(baseFontSize)
        ? { ...textStyle, fontSize: baseFontSize * appliedFitScale }
        : textStyle,
    [textStyle, appliedFitScale, baseFontSize]
  )

  // Se mide antes de pintar, así nunca se ve el texto desbordado. Cada medida
  // parte del tamaño original y busca (bisección) la mayor escala que cabe, de
  // modo que el resultado no depende de medidas anteriores ni de estados
  // transitorios. Las transformaciones de la animación no afectan a offsetTop/
  // offsetHeight, así que la medida es estable durante la entrada.
  useLayoutEffect(() => {
    if (!autoFit || !Number.isFinite(baseFontSize)) return
    const box = boxRef.current
    const textEl = contentRef.current?.firstElementChild as HTMLElement | null
    const content = contentRef.current
    if (!box || !content || !textEl) return

    const limitTop = Math.max(textContainerPadding.vertical, reserveTop)
    const limitBottom = box.clientHeight - Math.max(textContainerPadding.vertical, reserveBottom)
    if (limitBottom - limitTop <= 0) return

    // Con alineación centrada el texto puede pisar la reserva aunque su alto
    // quepa, así que se comparan bordes y no solo alturas.
    const fitsAt = (scale: number) => {
      textEl.style.fontSize = `${baseFontSize * scale}px`
      const top = content.offsetTop + textContainerOffset.y
      const bottom = top + content.offsetHeight
      return top >= limitTop - 1 && bottom <= limitBottom + 1
    }

    const renderedFontSize = textEl.style.fontSize
    let best = 1
    if (!fitsAt(1)) {
      let lo = MIN_AUTO_FIT_SCALE
      let hi = 1
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2
        if (fitsAt(mid)) lo = mid
        else hi = mid
      }
      best = lo
    }
    // React es dueño del estilo: se restaura y el valor final llega por estado.
    textEl.style.fontSize = renderedFontSize
    if (Math.abs(best - fitScale) > 0.005) setFitScale(best)
  })

  const shouldShowBounds = showTextBounds && textBoundsIsSelected

  const canEditBounds =
    shouldShowBounds &&
    onTextBoundsChange !== undefined &&
    textBoundsBaseValues !== undefined &&
    textBoundsScale !== undefined &&
    textBoundsScale.x > 0 &&
    textBoundsScale.y > 0

  const {
    boundsCursor,
    snapGuides,
    onBoundsPointerMove,
    onBoundsPointerLeave,
    onBoundsPointerDown,
    startInteraction
  } = useTextBoundsInteraction({
    canEditBounds,
    textBoundsBaseValues,
    textBoundsScale,
    onTextBoundsChange
  })

  const shouldHideInLive = hideTextInLive && !isPreview

  const sanitizedText = useMemo(() => sanitizeHTML(text), [text])

  const splitSanitizedLines = useMemo(() => splitHtmlForWordAnimation(text), [text])

  const content = useMemo(() => {
    if (shouldHideInLive) {
      return null
    }

    const scaledFontSize =
      typeof fittedTextStyle.fontSize === 'string'
        ? parseFloat(fittedTextStyle.fontSize)
        : typeof fittedTextStyle.fontSize === 'number'
          ? fittedTextStyle.fontSize
          : 24
    const bgPadX = blockBgStyle
      ? blockBgPadding != null
        ? blockBgPadding
        : Math.max(8, Math.round(scaledFontSize * 0.45))
      : 0
    const bgPadY = blockBgStyle
      ? blockBgPadding != null
        ? Math.round(blockBgPadding * 0.55)
        : Math.max(4, Math.round(scaledFontSize * 0.25))
      : 0
    const bgPadding = blockBgStyle ? { padding: `${bgPadY}px ${bgPadX}px` } : undefined

    const bgLayer = blockBgStyle ? (
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, ...blockBgStyle }} />
    ) : null

    if (isPreview) {
      return (
        <div style={{ position: 'relative', ...fittedTextStyle, ...bgPadding }}>
          {bgLayer}
          <div
            style={{ position: 'relative', zIndex: bgLayer ? 1 : undefined }}
            dangerouslySetInnerHTML={{ __html: sanitizedText }}
          />
        </div>
      )
    }

    if (animationType === 'split') {
      return (
        <m.div
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ position: 'relative', ...fittedTextStyle, ...bgPadding }}
          className="w-full"
        >
          {bgLayer}
          <div style={{ position: 'relative', zIndex: bgLayer ? 1 : undefined }}>
            {splitSanitizedLines.map((words, lineIndex) => (
              <div key={lineIndex}>
                {words.map((word, wordIndex) => (
                  <m.span
                    key={`${lineIndex}-${wordIndex}`}
                    variants={getWordVariants(animationDuration)}
                    style={{ display: 'inline-block', marginRight: '0.3em' }}
                    dangerouslySetInnerHTML={{ __html: word }}
                  />
                ))}
                {lineIndex < splitSanitizedLines.length - 1 && <br />}
              </div>
            ))}
          </div>
        </m.div>
      )
    }

    return (
      <m.div
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ position: 'relative', ...fittedTextStyle, ...bgPadding }}
      >
        {bgLayer}
        <div
          style={{ position: 'relative', zIndex: bgLayer ? 1 : undefined }}
          dangerouslySetInnerHTML={{ __html: sanitizedText }}
        />
      </m.div>
    )
  }, [
    shouldHideInLive,
    isPreview,
    fittedTextStyle,
    sanitizedText,
    animationType,
    variants,
    splitSanitizedLines,
    blockBgStyle,
    animationDuration
  ])

  const handleSelectTarget = useCallback(
    (target: EditableBoundsTarget) => {
      onEditableTargetSelect?.(target)
    },
    [onEditableTargetSelect]
  )

  const verticalAlignItems =
    verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center'

  if (shouldHideInLive) {
    return null
  }

  return (
    <>
      {canEditBounds && snapGuides.centerX ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: 1,
            background: 'rgba(20,184,166,0.85)',
            transform: 'translateX(-0.5px)',
            pointerEvents: 'none',
            zIndex: 10
          }}
        />
      ) : null}
      {canEditBounds && snapGuides.centerY ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 1,
            background: 'rgba(20,184,166,0.85)',
            transform: 'translateY(-0.5px)',
            pointerEvents: 'none',
            zIndex: 10
          }}
        />
      ) : null}
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
            onBoundsPointerMove(event)
          }}
          onPointerLeave={() => {
            onBoundsPointerLeave()
          }}
          onPointerDown={(event) => {
            onBoundsPointerDown(event)
          }}
        >
          {canEditBounds ? (
            <>
              <button
                type="button"
                aria-label="Redimensionar esquina superior izquierda"
                style={{
                  ...CORNER_HANDLE_STYLE,
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
                  ...CORNER_HANDLE_STYLE,
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
                  ...CORNER_HANDLE_STYLE,
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
                  ...CORNER_HANDLE_STYLE,
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
        ref={boxRef}
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
        <div ref={contentRef} style={{ width: '100%' }}>
          {content}
        </div>
      </div>
    </>
  )
}

function areAnimatedTextPropsEqual(prevProps: AnimatedTextProps, nextProps: AnimatedTextProps) {
  return (
    prevProps.item === nextProps.item &&
    prevProps.animationType === nextProps.animationType &&
    prevProps.variants === nextProps.variants &&
    prevProps.textStyle === nextProps.textStyle &&
    prevProps.isPreview === nextProps.isPreview &&
    prevProps.textContainerPadding.horizontal === nextProps.textContainerPadding.horizontal &&
    prevProps.textContainerPadding.vertical === nextProps.textContainerPadding.vertical &&
    prevProps.textContainerOffset.x === nextProps.textContainerOffset.x &&
    prevProps.textContainerOffset.y === nextProps.textContainerOffset.y &&
    prevProps.verticalAlign === nextProps.verticalAlign &&
    prevProps.showTextBounds === nextProps.showTextBounds &&
    prevProps.textBoundsIsSelected === nextProps.textBoundsIsSelected &&
    prevProps.textBoundsBaseValues === nextProps.textBoundsBaseValues &&
    prevProps.textBoundsScale === nextProps.textBoundsScale &&
    prevProps.onTextBoundsChange === nextProps.onTextBoundsChange &&
    prevProps.onEditableTargetSelect === nextProps.onEditableTargetSelect &&
    prevProps.hideTextInLive === nextProps.hideTextInLive &&
    prevProps.blockBgStyle === nextProps.blockBgStyle &&
    prevProps.blockBgPadding === nextProps.blockBgPadding &&
    prevProps.animationDuration === nextProps.animationDuration &&
    prevProps.autoFit === nextProps.autoFit &&
    prevProps.autoFitReserve?.top === nextProps.autoFitReserve?.top &&
    prevProps.autoFitReserve?.bottom === nextProps.autoFitReserve?.bottom
  )
}

export const AnimatedText = memo(AnimatedTextComponent, areAnimatedTextPropsEqual)
