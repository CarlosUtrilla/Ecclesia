import { useEffect, useMemo, useRef, useState } from 'react'
import { LazyMotion, domAnimation } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, sanitizeHTML } from '@/lib/utils'
import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { AnimationType, getAnimationVariants } from '@/lib/animations'
import { AnimationSettings, defaultAnimationSettings } from '@/lib/animationSettings'
import { CanvasItemStyle, BASE_CANVAS_HEIGHT } from '../utils/slideUtils'
import { parseBibleAccessData } from '../utils/bibleAccessData'
import { resolveChunkParts } from '@/lib/presentationSlides'
import { resolveBibleChunkMaxLength, isBibleLiveSplitMode } from '@/lib/splitLongBibleVerse'
import { useDefaultBiblePresentationSettings } from '@/hooks/useDefaultBiblePresentationSettings'
import { saveSelection, restoreSelection, registerActiveEditable } from '../utils/textSelection'
import CanvasItemShell from './canvasItemShell'
import { AnimatedText } from '@/ui/PresentationView/components/AnimatedText'
import { BibleTextRender } from '@/ui/PresentationView/components/BibleTextRender'

type Props = {
  itemId: string
  text: string
  type: 'TEXT' | 'BIBLE' | 'SONG' | 'GROUP'
  accessData?: string
  animationSettings?: string
  layer: number
  style: CanvasItemStyle
  isSelected: boolean
  isDragging: boolean
  isRotating?: boolean
  animationPreviewKey?: number
  theme: ThemeWithMedia
  isEditable: boolean
  highlightSnapTarget?: boolean
  isEditing: boolean
  onSelect: (event: React.MouseEvent<HTMLDivElement>) => void
  onStartMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onRequestEdit: () => void
  onExitEdit: () => void
  onTextChange: (nextText: string) => void
  persistedStepIndex?: number
  onPersistStepIndex?: (nextStepIndex: number) => void
  handles?: React.ReactNode
}

const setCaretToEnd = (element: HTMLDivElement) => {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

export default function TextCanvasItem({
  itemId,
  text,
  type,
  accessData,
  animationSettings,
  layer,
  style,
  isSelected,
  isDragging,
  isRotating = false,
  animationPreviewKey = 0,
  theme,
  isEditable,
  highlightSnapTarget,
  isEditing,
  onSelect,
  onStartMove,
  onRequestEdit,
  onExitEdit,
  onTextChange,
  persistedStepIndex,
  onPersistStepIndex,
  handles
}: Props) {
  const editableRef = useRef<HTMLDivElement | null>(null)
  const wasEditingRef = useRef(false)
  const inputCommitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestInputHtmlRef = useRef<string>(text || '')
  const latestPropTextRef = useRef<string>(text || '')
  const savedSelectionRef = useRef<Range | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const { defaultBiblePresentationSettings } = useDefaultBiblePresentationSettings()

  useEffect(() => {
    latestPropTextRef.current = text || ''
    latestInputHtmlRef.current = text || ''
  }, [text])

  useEffect(() => {
    if (isEditing && editableRef.current) {
      registerActiveEditable(editableRef.current)
    } else if (!isEditing) {
      registerActiveEditable(null)
    }
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) {
      wasEditingRef.current = false
    }

    const element = editableRef.current
    if (!element) return

    const safeText = sanitizeHTML(text || '')

    if (isEditing) {
      if (!wasEditingRef.current) {
        if (element.innerHTML !== safeText) {
          element.innerHTML = safeText
        }
        requestAnimationFrame(() => {
          element.focus()
          setCaretToEnd(element)
        })
        wasEditingRef.current = true
      }
      // Ya estamos editando: no sobreescribir el DOM desde props para no perder
      // selección y estilos inline aplicados al fragmento seleccionado.
      return
    }

    if (element.innerHTML !== safeText) {
      element.innerHTML = safeText
    }
  }, [isEditing, text])

  useEffect(() => {
    return () => {
      if (inputCommitTimeoutRef.current !== null) {
        clearTimeout(inputCommitTimeoutRef.current)
        inputCommitTimeoutRef.current = null
      }
    }
  }, [])

  const commitBufferedInput = () => {
    const nextValue = latestInputHtmlRef.current
    if (nextValue !== latestPropTextRef.current) {
      onTextChange(nextValue)
      latestPropTextRef.current = nextValue
    }
  }

  const flushBufferedInput = () => {
    if (inputCommitTimeoutRef.current !== null) {
      clearTimeout(inputCommitTimeoutRef.current)
      inputCommitTimeoutRef.current = null
    }

    commitBufferedInput()
  }

  const scheduleTextChange = (nextValue: string) => {
    latestInputHtmlRef.current = nextValue

    if (inputCommitTimeoutRef.current !== null) {
      clearTimeout(inputCommitTimeoutRef.current)
    }

    inputCommitTimeoutRef.current = setTimeout(() => {
      inputCommitTimeoutRef.current = null
      commitBufferedInput()
    }, 100)
  }

  const parsedAnimationSettings: AnimationSettings = (() => {
    if (!animationSettings) return defaultAnimationSettings

    try {
      return {
        ...defaultAnimationSettings,
        ...JSON.parse(animationSettings)
      }
    } catch {
      return defaultAnimationSettings
    }
  })()

  const animationType = (parsedAnimationSettings.type || 'fade') as AnimationType
  const variants = getAnimationVariants(
    animationType,
    parsedAnimationSettings.duration,
    parsedAnimationSettings.delay,
    parsedAnimationSettings.easing
  )

  const bible = type === 'BIBLE' ? parseBibleAccessData(accessData) : undefined

  // Divide el texto bíblico en los MISMOS fragmentos (chunks) que se usan en LIVE:
  // verso por verso + partición de versículos largos, reutilizando la lógica de
  // la biblioteca (`resolveChunkParts` -> `splitLongBibleVerse` / `splitBibleRangeIntoVerses`).
  const chunkSteps = useMemo(() => {
    if (type !== 'BIBLE' || !bible) return null

    const mode = defaultBiblePresentationSettings?.chunkMaxLength
    const splitMode = isBibleLiveSplitMode(mode) ? mode : 'auto'
    const maxChunkLength = resolveBibleChunkMaxLength(splitMode)

    const parts = resolveChunkParts(
      text || '',
      maxChunkLength,
      bible.bookId,
      bible.chapter,
      bible.verseStart,
      bible.verseEnd
    )

    return parts && parts.length > 0 ? parts : null
  }, [
    type,
    bible?.bookId,
    bible?.chapter,
    bible?.verseStart,
    bible?.verseEnd,
    text,
    defaultBiblePresentationSettings?.chunkMaxLength
  ])

  const totalSteps = chunkSteps?.length ?? 0

  useEffect(() => {
    if (totalSteps === 0) {
      setStepIndex(0)
      return
    }

    setStepIndex((current) => {
      const fromPersisted =
        persistedStepIndex !== undefined &&
        persistedStepIndex >= 0 &&
        persistedStepIndex < totalSteps
          ? persistedStepIndex
          : null

      if (fromPersisted !== null) return fromPersisted
      if (current < 0) return 0
      if (current > totalSteps - 1) return totalSteps - 1
      return current
    })
  }, [itemId, totalSteps, persistedStepIndex])

  const safeStepIndex = totalSteps > 0 ? Math.min(Math.max(0, stepIndex), totalSteps - 1) : 0
  const activeStep = chunkSteps && totalSteps > 0 ? chunkSteps[safeStepIndex] : null

  const verseProgress =
    totalSteps > 0
      ? {
          position: safeStepIndex + 1,
          total: totalSteps,
          currentVerse: activeStep?.verse ?? bible?.verseStart ?? 0
        }
      : null

  const displayedText = type === 'BIBLE' ? (activeStep ? activeStep.content : text) : text

  const verse =
    bible && Number.isFinite(bible.bookId) && Number.isFinite(bible.chapter)
      ? {
          bookId: bible.bookId,
          chapter: bible.chapter,
          verse: activeStep?.verse ?? bible.verseStart,
          version: bible.version
        }
      : undefined

  const textStyle: React.CSSProperties = {
    color: style.color,
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    lineHeight: style.lineHeight,
    letterSpacing: `${style.letterSpacing}px`,
    textAlign: style.textAlign,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    textDecoration: style.textDecoration,
    ...(style.textShadowEnabled
      ? {
          textShadow: `${style.textShadowOffsetX ?? 2}px ${style.textShadowOffsetY ?? 2}px ${style.textShadowBlur ?? 4}px ${style.textShadowColor || 'rgba(0,0,0,0.5)'}`
        }
      : {}),
    ...(style.textStrokeEnabled
      ? {
          WebkitTextStroke: `${style.textStrokeWidth ?? 1}px ${style.textStrokeColor || '#000000'}`
        }
      : {})
  }

  const blockBgStyle: React.CSSProperties | null = style.blockBgEnabled
    ? {
        backgroundColor: style.blockBgColor || 'rgba(0,0,0,0.5)',
        opacity: style.blockBgOpacity ?? 1,
        ...(style.blockBgBlur && style.blockBgBlur > 0
          ? { backdropFilter: `blur(${style.blockBgBlur}px)` }
          : {}),
        ...(style.blockBgRadius && style.blockBgRadius > 0
          ? { borderRadius: `${style.blockBgRadius}px` }
          : {})
      }
    : null

  const blockBgPadding = style.blockBgEnabled ? (style.blockBgPadding ?? null) : null

  const verticalAlign: 'top' | 'center' | 'bottom' = style.verticalAlign || 'center'
  const verticalAlignItems =
    verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center'

  return (
    <CanvasItemShell
      itemId={itemId}
      style={style}
      layer={layer}
      isSelected={isSelected}
      rotationLabel={isRotating ? `${Math.round(style.rotation)}°` : undefined}
      highlightSnapTarget={highlightSnapTarget}
      onSelect={(event) => {
        event.stopPropagation()
        onSelect(event)
        if (isEditable && event.detail >= 2) {
          onRequestEdit()
        }
      }}
      onPointerDown={(event) => {
        if (isEditing) return

        // If item is not editable, start move immediately.
        if (!isEditable) {
          onStartMove(event)
          return
        }

        // Editable items: delay starting move until the pointer has moved
        // beyond a small threshold. This allows single-click + drag to move
        // while keeping double-click for editing.
        const startX = event.clientX
        const startY = event.clientY
        const pointerId = (event as React.PointerEvent).pointerId
        let moved = false
        const threshold = 6

        try {
          ;(event.currentTarget as Element).setPointerCapture?.(pointerId as any)
        } catch (error) {
          console.error('Error setting pointer capture:', error)
        }

        const onPointerMove = (moveEvent: PointerEvent) => {
          const dx = moveEvent.clientX - startX
          const dy = moveEvent.clientY - startY
          if (!moved && Math.hypot(dx, dy) > threshold) {
            moved = true
            // Forward the original pointerdown event (not the global move
            // event) to the move handler so `currentTarget` is the
            // CanvasItemShell element. This allows the drag starter to
            // call `setPointerCapture` on the correct element.
            onStartMove(event as unknown as React.PointerEvent<HTMLDivElement>)
            cleanup()
          }
        }

        const onPointerUp = () => {
          cleanup()
        }

        const cleanup = () => {
          window.removeEventListener('pointermove', onPointerMove)
          window.removeEventListener('pointerup', onPointerUp)
          try {
            ;(event.currentTarget as Element).releasePointerCapture?.(pointerId as any)
          } catch (error) {
            console.error('Error releasing pointer capture:', error)
          }
        }

        window.addEventListener('pointermove', onPointerMove)
        window.addEventListener('pointerup', onPointerUp)
      }}
      handles={handles}
    >
      {isEditing && isEditable ? (
        <div
          ref={editableRef}
          className={cn(
            'w-full h-full p-2 break-words overflow-hidden rounded-[inherit] outline-none',
            { 'cursor-text': isSelected }
          )}
          style={textStyle}
          contentEditable
          suppressContentEditableWarning
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(event as unknown as React.MouseEvent<HTMLDivElement>)
          }}
          onDoubleClick={(event) => {
            event.stopPropagation()
            onSelect(event as unknown as React.MouseEvent<HTMLDivElement>)
            onRequestEdit()
          }}
          onInput={(event) => {
            scheduleTextChange(event.currentTarget.innerHTML)
          }}
          onMouseUp={() => {
            savedSelectionRef.current = saveSelection()
          }}
          onKeyUp={() => {
            savedSelectionRef.current = saveSelection()
          }}
          onBlur={() => {
            savedSelectionRef.current = saveSelection()
            flushBufferedInput()
          }}
          onFocus={() => {
            restoreSelection(savedSelectionRef.current)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              setTimeout(() => {
                flushBufferedInput()
              }, 0)
            }

            if (event.key === 'Escape') {
              event.preventDefault()
              flushBufferedInput()
              onExitEdit()
              ;(event.currentTarget as HTMLDivElement).blur()
            }
          }}
        />
      ) : isDragging ? (
        <div
          className="w-full h-full break-words overflow-hidden rounded-[inherit] pointer-events-none"
          style={{
            display: 'flex',
            alignItems: verticalAlignItems,
            justifyContent: 'center'
          }}
        >
          <div
            style={{ ...textStyle, width: '100%' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(displayedText || '') }}
          />
        </div>
      ) : (
        <LazyMotion features={domAnimation}>
          <div
            className="w-full h-full break-words overflow-hidden rounded-[inherit]"
            title={isEditable ? 'Doble click: editar. Click y arrastra para mover.' : undefined}
            onClick={(event) => {
              event.stopPropagation()
              onSelect(event as unknown as React.MouseEvent<HTMLDivElement>)
              if (isEditable && event.detail >= 2) {
                onRequestEdit()
              }
            }}
          >
            {isSelected && totalSteps > 1 && !isEditing ? (
              <div
                className="absolute top-1 right-1 z-20 flex items-center gap-1 rounded bg-background/90 border px-1 py-0.5"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="inline-flex items-center justify-center size-5 rounded hover:bg-muted disabled:opacity-40"
                  disabled={safeStepIndex <= 0}
                  onClick={() => {
                    setStepIndex((current) => {
                      const base = Math.min(Math.max(0, current), totalSteps - 1)
                      const next = Math.max(0, base - 1)
                      onPersistStepIndex?.(next)
                      return next
                    })
                  }}
                  aria-label="Fragmento anterior"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <span
                  className="text-[10px] tabular-nums text-muted-foreground min-w-12 text-center"
                  title={
                    verseProgress
                      ? `Verso ${verseProgress.currentVerse} (fragmento ${verseProgress.position} de ${verseProgress.total})`
                      : undefined
                  }
                >
                  {verseProgress ? `${verseProgress.position}/${verseProgress.total}` : '1/1'}
                </span>
                <button
                  type="button"
                  className="inline-flex items-center justify-center size-5 rounded hover:bg-muted disabled:opacity-40"
                  disabled={safeStepIndex >= totalSteps - 1}
                  onClick={() => {
                    setStepIndex((current) => {
                      const base = Math.min(Math.max(0, current), totalSteps - 1)
                      const next = Math.min(totalSteps - 1, base + 1)
                      onPersistStepIndex?.(next)
                      return next
                    })
                  }}
                  aria-label="Fragmento siguiente"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            ) : null}
            {type === 'BIBLE' ? (
              <BibleTextRender
                key={`${itemId}-bible-${animationPreviewKey}`}
                item={{
                  id: itemId,
                  text: displayedText || '',
                  verse,
                  resourceType: 'BIBLE'
                }}
                animationType={animationType}
                variants={variants}
                textStyle={textStyle}
                isPreview={false}
                theme={theme}
                smallFontSize={`${style.fontSize * 0.85}px`}
                textContainerPadding={{ horizontal: 0, vertical: 0 }}
                textContainerOffset={{ x: 0, y: 0 }}
                verticalAlign={verticalAlign}
                scaleFactor={1}
                presentationHeight={BASE_CANVAS_HEIGHT}
                constrainScreenVerseToSingleLine="auto"
                showTextBounds={false}
                blockBgStyle={blockBgStyle}
                blockBgPadding={blockBgPadding}
              />
            ) : (
              <AnimatedText
                key={`${itemId}-text-${animationPreviewKey}`}
                item={{
                  id: itemId,
                  text: displayedText || '',
                  resourceType: 'TEXT'
                }}
                animationType={animationType}
                variants={variants}
                textStyle={textStyle}
                isPreview={false}
                textContainerPadding={{ horizontal: 0, vertical: 0 }}
                textContainerOffset={{ x: 0, y: 0 }}
                verticalAlign={verticalAlign}
                showTextBounds={false}
                blockBgStyle={blockBgStyle}
                blockBgPadding={blockBgPadding}
              />
            )}
          </div>
        </LazyMotion>
      )}
    </CanvasItemShell>
  )
}
