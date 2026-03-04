import { useEffect, useRef } from 'react'
import { LazyMotion, domAnimation } from 'framer-motion'
import { cn, sanitizeHTML } from '@/lib/utils'
import { BlankTheme } from '@/hooks/useThemes'
import { AnimationType, getAnimationVariants } from '@/lib/animations'
import { AnimationSettings, defaultAnimationSettings } from '@/lib/animationSettings'
import { CanvasItemStyle } from '../utils/slideUtils'
import { parseBibleAccessData } from '../utils/bibleAccessData'
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
  highlightSnapTarget?: boolean
  isEditing: boolean
  onSelect: () => void
  onStartMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onRequestEdit: () => void
  onExitEdit: () => void
  onTextChange: (nextText: string) => void
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
  highlightSnapTarget,
  isEditing,
  onSelect,
  onStartMove,
  onRequestEdit,
  onExitEdit,
  onTextChange,
  handles
}: Props) {
  const editableRef = useRef<HTMLDivElement | null>(null)
  const wasEditingRef = useRef(false)
  const inputCommitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestInputHtmlRef = useRef<string>(text || '')
  const latestPropTextRef = useRef<string>(text || '')

  useEffect(() => {
    latestPropTextRef.current = text || ''
    latestInputHtmlRef.current = text || ''
  }, [text])

  useEffect(() => {
    if (!isEditing) {
      wasEditingRef.current = false
    }

    const element = editableRef.current
    if (!element) return

    const safeText = sanitizeHTML(text || '')

    if (isEditing) {
      const shouldFocus = !wasEditingRef.current
      if (element.innerHTML !== safeText) {
        element.innerHTML = safeText
      }

      if (shouldFocus) {
        requestAnimationFrame(() => {
          element.focus()
          setCaretToEnd(element)
        })
      }

      wasEditingRef.current = true
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
  const verse =
    bible && Number.isFinite(bible.bookId) && Number.isFinite(bible.chapter)
      ? {
          bookId: bible.bookId,
          chapter: bible.chapter,
          verse: bible.verseStart,
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
    textDecoration: style.textDecoration
  }

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
        onSelect()
      }}
      onDoubleClick={(event) => {
        event.stopPropagation()
        onSelect()
        onRequestEdit()
      }}
      onPointerDown={(event) => {
        if (isEditing) return
        onStartMove(event)
      }}
      handles={handles}
    >
      {isEditing ? (
        <div
          ref={editableRef}
          className={cn(
            'w-full h-full p-2 break-words overflow-hidden rounded-[inherit] outline-none',
            {
              'cursor-text': isSelected,
              'cursor-move select-none': !isEditing
            }
          )}
          style={textStyle}
          contentEditable
          suppressContentEditableWarning
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.stopPropagation()
            onSelect()
          }}
          onDoubleClick={(event) => {
            event.stopPropagation()
            onSelect()
            onRequestEdit()
          }}
          onInput={(event) => {
            scheduleTextChange(event.currentTarget.innerHTML)
          }}
          onBlur={() => {
            flushBufferedInput()
            onExitEdit()
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
          className="w-full h-full p-2 break-words overflow-hidden rounded-[inherit] pointer-events-none"
          style={{
            display: 'flex',
            alignItems: verticalAlignItems,
            justifyContent: 'center'
          }}
        >
          <div
            style={{ ...textStyle, width: '100%' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(text || '') }}
          />
        </div>
      ) : (
        <LazyMotion features={domAnimation}>
          <div
            className="w-full h-full p-2 break-words overflow-hidden rounded-[inherit]"
            onClick={(event) => {
              event.stopPropagation()
              onSelect()
            }}
            onDoubleClick={(event) => {
              event.stopPropagation()
              onSelect()
              onRequestEdit()
            }}
          >
            {type === 'BIBLE' ? (
              <BibleTextRender
                key={`${itemId}-bible-${animationPreviewKey}`}
                item={{
                  id: itemId,
                  text: text || '',
                  verse,
                  resourceType: 'BIBLE'
                }}
                animationType={animationType}
                variants={variants}
                textStyle={textStyle}
                isPreview={false}
                theme={BlankTheme}
                smallFontSize={`${Math.max(10, Math.round(style.fontSize * 0.85))}px`}
                textContainerPadding={{ horizontal: 0, vertical: 0 }}
                textContainerOffset={{ x: 0, y: 0 }}
                verticalAlign={verticalAlign}
                scaleFactor={1}
                presentationHeight={style.height}
                showTextBounds={false}
              />
            ) : (
              <AnimatedText
                key={`${itemId}-text-${animationPreviewKey}`}
                item={{
                  id: itemId,
                  text: text || '',
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
              />
            )}
          </div>
        </LazyMotion>
      )}
    </CanvasItemShell>
  )
}
