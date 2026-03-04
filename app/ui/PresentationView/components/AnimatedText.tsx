import { memo, useCallback, useMemo } from 'react'
import { m, type Variants } from 'framer-motion'
import { sanitizeHTML } from '@/lib/utils'
import { wordVariants, AnimationType } from '@/lib/animations'
import { EditableBoundsTarget, PresentationViewItems, TextBoundsValues } from '../types'
import { useTextBoundsInteraction } from '../hooks/useTextBoundsInteraction'

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
}

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
  onEditableTargetSelect
}: AnimatedTextProps) {
  const { text: rawText } = item

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

  const text = rawText || ''
  const sanitizedText = useMemo(() => sanitizeHTML(text), [text])

  const splitSanitizedLines = useMemo(
    () =>
      text.split(/<br\s*\/?>/i).map((line) =>
        line
          .trim()
          .split(' ')
          .filter((word) => word.length > 0)
          .map((word) => sanitizeHTML(word))
      ),
    [text]
  )

  const content = useMemo(() => {
    if (isPreview) {
      return <div style={textStyle} dangerouslySetInnerHTML={{ __html: sanitizedText }} />
    }

    if (animationType === 'split') {
      return (
        <m.div
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={textStyle}
        >
          {splitSanitizedLines.map((words, lineIndex) => (
            <div key={lineIndex}>
              {words.map((word, wordIndex) => (
                <m.span
                  key={`${lineIndex}-${wordIndex}`}
                  variants={wordVariants}
                  style={{ display: 'inline-block', marginRight: '0.3em' }}
                  dangerouslySetInnerHTML={{ __html: word }}
                />
              ))}
              {lineIndex < splitSanitizedLines.length - 1 && <br />}
            </div>
          ))}
        </m.div>
      )
    }

    return (
      <m.div
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={textStyle}
        dangerouslySetInnerHTML={{ __html: sanitizedText }}
      />
    )
  }, [isPreview, textStyle, sanitizedText, animationType, variants, splitSanitizedLines])

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
        <div style={{ width: '100%' }}>{content}</div>
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
    prevProps.onEditableTargetSelect === nextProps.onEditableTargetSelect
  )
}

export const AnimatedText = memo(AnimatedTextComponent, areAnimatedTextPropsEqual)
