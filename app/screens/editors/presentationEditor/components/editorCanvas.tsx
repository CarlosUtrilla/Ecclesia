import { useEffect, useMemo, useRef, useState } from 'react'
import { Media } from '@prisma/client'
import { cn } from '@/lib/utils'
import { PresentationFormValues } from '../schema'
import { CanvasItemStyle, parseCanvasItemStyle, PresentationSlideItem } from '../utils/slideUtils'
import useCanvasSnapping from '../hooks/useCanvasSnapping'
import useCanvasTransform, { DragState } from '../hooks/useCanvasTransform'
import { ResizeHandle } from './canvasTransformHandles'
import CanvasItemNode from './canvasItemNode'

type Props = {
  slide: PresentationFormValues['slides'][number]
  mediaById: Map<number, Media>
  canvasScale?: number
  animationPreviewKey?: number
  selectedItemId?: string
  onSelectItem: (itemId?: string) => void
  onItemStyleChange: (itemId: string, next: Partial<CanvasItemStyle>) => void
  onItemTextChange?: (itemId: string, nextText: string) => void
  onDuplicateItem?: (itemId: string) => void
  onDeleteItem?: (itemId: string) => void
  onLayerUpItem?: (itemId: string) => void
  onLayerDownItem?: (itemId: string) => void
  onDragStateChange?: (isDragging: boolean) => void
}

export default function EditorCanvas({
  slide,
  mediaById,
  canvasScale = 1,
  animationPreviewKey = 0,
  selectedItemId,
  onSelectItem,
  onItemStyleChange,
  onItemTextChange,
  onDuplicateItem,
  onDeleteItem,
  onLayerUpItem,
  onLayerDownItem,
  onDragStateChange
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [activeDragItemId, setActiveDragItemId] = useState<string | null>(null)
  const [activeDragMode, setActiveDragMode] = useState<DragState['mode'] | null>(null)

  useEffect(() => {
    if (editingItemId && editingItemId !== selectedItemId) {
      setEditingItemId(null)
    }
  }, [editingItemId, selectedItemId])

  const sortedItems = useMemo(
    () => [...(slide.items || [])].sort((a, b) => Number(a.layer || 0) - Number(b.layer || 0)),
    [slide.items]
  )

  const parsedItems = useMemo(
    () =>
      sortedItems.map((item) => ({
        item,
        style: parseCanvasItemStyle(item.customStyle, item.type)
      })),
    [sortedItems]
  )

  const {
    snapGuides,
    clearSnapGuides,
    syncSnapGuides,
    getPointerPositionInCanvas,
    getSnappedMovePosition
  } = useCanvasSnapping({
    containerRef,
    parsedItems,
    canvasScale
  })
  const { handlePointerMove, flushPendingTransform, cancelPendingTransform } = useCanvasTransform({
    dragRef,
    canvasScale,
    onItemStyleChange,
    clearSnapGuides,
    syncSnapGuides,
    getPointerPositionInCanvas,
    getSnappedMovePosition
  })

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const activeDrag = dragRef.current
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return
    flushPendingTransform()
    dragRef.current = null
    setActiveDragItemId(null)
    setActiveDragMode(null)
    onDragStateChange?.(false)
    clearSnapGuides()
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    setEditingItemId(null)
    onSelectItem(undefined)
  }

  const startDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    item: PresentationSlideItem,
    mode: DragState['mode'],
    resizeCorner?: ResizeHandle
  ) => {
    if (event.button !== 0) return

    if (mode !== 'move') {
      clearSnapGuides()
    }

    const style = parseCanvasItemStyle(item.customStyle, item.type)
    dragRef.current = {
      pointerId: event.pointerId,
      itemId: item.id,
      mode,
      resizeCorner,
      startX: event.clientX,
      startY: event.clientY,
      initialStyle: style
    }
    setActiveDragItemId(item.id)
    setActiveDragMode(mode)
    onDragStateChange?.(true)
    onSelectItem(item.id)
    event.currentTarget.setPointerCapture(event.pointerId)
    event.stopPropagation()
  }

  useEffect(() => {
    return () => {
      cancelPendingTransform()
      setActiveDragItemId(null)
      setActiveDragMode(null)
      onDragStateChange?.(false)
    }
  }, [cancelPendingTransform, onDragStateChange])

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-white rounded-lg overflow-visible border"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.08) 1px, transparent 0)',
          backgroundSize: '20px 20px'
        }}
      />

      {snapGuides.x !== null ? (
        <div
          className={cn('absolute top-0 bottom-0 w-px pointer-events-none z-30', {
            'bg-primary/70': snapGuides.xSource === 'slide',
            'bg-sky-400/80': snapGuides.xSource === 'item'
          })}
          style={{ left: snapGuides.x }}
        />
      ) : null}

      {snapGuides.y !== null ? (
        <div
          className={cn('absolute left-0 right-0 h-px pointer-events-none z-30', {
            'bg-primary/70': snapGuides.ySource === 'slide',
            'bg-sky-400/80': snapGuides.ySource === 'item'
          })}
          style={{ top: snapGuides.y }}
        />
      ) : null}

      {parsedItems.map(({ item, style }) => {
        const isSelected = selectedItemId === item.id
        const isSnapTarget =
          snapGuides.xTargetItemId === item.id || snapGuides.yTargetItemId === item.id
        const isEditingText = isSelected && item.type !== 'MEDIA' && editingItemId === item.id
        const isRotating = activeDragItemId === item.id && activeDragMode === 'rotate'
        return (
          <CanvasItemNode
            key={item.id}
            item={item}
            style={style}
            mediaById={mediaById}
            isSelected={isSelected}
            isSnapTarget={isSnapTarget}
            isEditingText={isEditingText}
            isDragging={activeDragItemId === item.id}
            isRotating={isRotating}
            animationPreviewKey={animationPreviewKey}
            onSelectItem={onSelectItem}
            onSetEditingItemId={setEditingItemId}
            onStartDrag={startDrag}
            onItemTextChange={onItemTextChange}
            onDuplicateItem={onDuplicateItem}
            onDeleteItem={onDeleteItem}
            onLayerUpItem={onLayerUpItem}
            onLayerDownItem={onLayerDownItem}
          />
        )
      })}
    </div>
  )
}
