import { useEffect, useMemo, useRef, useState } from 'react'
import type { Media } from '@prisma/client'
import { cn } from '@/lib/utils'
import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { usePresentationBackground } from '@/ui/PresentationView/hooks/usePresentationBackground'
import { useMediaServer } from '@/contexts/MediaServerContext'
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
  theme: ThemeWithMedia
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
  theme,
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
  const moveActivationDistance = 4
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [activeDragItemId, setActiveDragItemId] = useState<string | null>(null)
  const [activeDragMode, setActiveDragMode] = useState<DragState['mode'] | null>(null)
  const versePreviewByItemRef = useRef<Map<string, number>>(new Map())
  const { buildMediaUrl } = useMediaServer()
  const {
    background,
    backgroundType,
    backgroundUrl,
    thumbnailUrl,
    fallbackUrl,
    videoError,
    setVideoError
  } = usePresentationBackground({ theme, buildMediaUrl })

  const resolvedBackground = background === 'media' ? '#ffffff' : background

  const handleSelectItem = (itemId?: string) => {
    if (!itemId || (editingItemId && editingItemId !== itemId)) {
      setEditingItemId(null)
    }
    onSelectItem(itemId)
  }

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

  const handlePointerMoveCanvas = (event: React.PointerEvent<HTMLDivElement>) => {
    const activeDrag = dragRef.current

    if (
      activeDrag &&
      activeDrag.mode === 'move' &&
      (activeDragItemId === null || activeDragMode !== 'move')
    ) {
      const deltaX = event.clientX - activeDrag.startX
      const deltaY = event.clientY - activeDrag.startY
      const distance = Math.hypot(deltaX, deltaY)

      if (distance < moveActivationDistance) {
        return
      }

      setActiveDragItemId(activeDrag.itemId)
      setActiveDragMode('move')
      onDragStateChange?.(true)
    }

    handlePointerMove(event)
  }

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
    handleSelectItem(undefined)
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
    if (mode !== 'move') {
      setActiveDragMode(mode)
      onDragStateChange?.(true)
    }
    handleSelectItem(item.id)
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
      className="w-full h-full relative rounded-lg overflow-visible border"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMoveCanvas}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            backgroundType === 'color' || backgroundType === 'gradient'
              ? resolvedBackground
              : 'transparent'
        }}
      />

      {backgroundType === 'image' && backgroundUrl ? (
        <img
          src={backgroundUrl}
          alt="Fondo del tema"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover pointer-events-none z-0"
        />
      ) : null}

      {backgroundType === 'video' ? (
        <img
          src={thumbnailUrl || fallbackUrl || ''}
          alt="Fondo de video del tema"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover pointer-events-none z-0"
          onError={() => {
            setVideoError(true)
          }}
          style={{ opacity: thumbnailUrl || fallbackUrl ? 1 : 0 }}
        />
      ) : null}

      {backgroundType === 'video' && videoError ? (
        <div className="absolute inset-0 pointer-events-none z-0 bg-black/15" />
      ) : null}

      <div
        className="absolute inset-0 pointer-events-none z-10"
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
        const isEditingText = isSelected && item.type === 'TEXT' && editingItemId === item.id
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
            theme={theme}
            onSelectItem={handleSelectItem}
            onSetEditingItemId={setEditingItemId}
            onStartDrag={startDrag}
            onItemTextChange={onItemTextChange}
            onDuplicateItem={onDuplicateItem}
            onDeleteItem={onDeleteItem}
            onLayerUpItem={onLayerUpItem}
            onLayerDownItem={onLayerDownItem}
            persistedVerse={versePreviewByItemRef.current.get(item.id)}
            onPersistVerse={(nextVerse) => {
              versePreviewByItemRef.current.set(item.id, nextVerse)
            }}
          />
        )
      })}
    </div>
  )
}
