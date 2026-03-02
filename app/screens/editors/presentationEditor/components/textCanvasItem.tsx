import { useEffect, useRef } from 'react'
import { cn, sanitizeHTML } from '@/lib/utils'
import { CanvasItemStyle } from '../utils/slideUtils'
import CanvasItemShell from './canvasItemShell'

type Props = {
  itemId: string
  text: string
  layer: number
  style: CanvasItemStyle
  isSelected: boolean
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
  layer,
  style,
  isSelected,
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

  useEffect(() => {
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
      }

      wasEditingRef.current = true
      return
    }

    if (element.innerHTML !== safeText) {
      element.innerHTML = safeText
    }

    wasEditingRef.current = false
  }, [isEditing, text])

  return (
    <CanvasItemShell
      itemId={itemId}
      style={style}
      layer={layer}
      isSelected={isSelected}
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
      <div
        ref={editableRef}
        className={cn(
          'w-full h-full p-2 break-words overflow-hidden rounded-[inherit] outline-none',
          {
            'cursor-text': isSelected,
            'cursor-move select-none': !isEditing
          }
        )}
        style={{
          color: style.color,
          fontFamily: style.fontFamily,
          fontSize: `${style.fontSize}px`,
          lineHeight: style.lineHeight,
          letterSpacing: `${style.letterSpacing}px`,
          textAlign: style.textAlign,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          textDecoration: style.textDecoration
        }}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onPointerDown={(event) => {
          if (isEditing) {
            event.stopPropagation()
          }
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
          if (!isEditing) return
          onTextChange(event.currentTarget.innerHTML)
        }}
        onBlur={() => {
          if (isEditing) {
            onExitEdit()
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onExitEdit()
            ;(event.currentTarget as HTMLDivElement).blur()
          }
        }}
      />
    </CanvasItemShell>
  )
}
