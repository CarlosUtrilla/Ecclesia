import { PointerEvent } from 'react'
import type { Media } from '@prisma/client'
import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { PresentationSlideItem, CanvasItemStyle } from '../utils/slideUtils'
import CanvasItemContextMenu from './canvasItemContextMenu'
import CanvasTransformHandles, { ResizeHandle } from './canvasTransformHandles'
import MediaCanvasItem from './mediaCanvasItem'
import ShapeCanvasItem from './shapeCanvasItem'
import TextCanvasItem from './textCanvasItem'

type DragMode = 'move' | 'resize' | 'rotate'

type Props = {
  item: PresentationSlideItem
  style: CanvasItemStyle
  mediaById: Map<number, Media>
  isSelected: boolean
  isSnapTarget: boolean
  isEditingText: boolean
  isDragging: boolean
  isRotating: boolean
  animationPreviewKey?: number
  theme: ThemeWithMedia
  onSelectItem: (itemId: string) => void
  onSetEditingItemId: (itemId: string | null) => void
  onStartDrag: (
    event: PointerEvent<HTMLDivElement>,
    item: PresentationSlideItem,
    mode: DragMode,
    resizeCorner?: ResizeHandle
  ) => void
  onItemTextChange?: (itemId: string, nextText: string) => void
  onDuplicateItem?: (itemId: string) => void
  onDeleteItem?: (itemId: string) => void
  onLayerUpItem?: (itemId: string) => void
  onLayerDownItem?: (itemId: string) => void
  persistedVerse?: number
  onPersistVerse?: (nextVerse: number) => void
}

export default function CanvasItemNode({
  item,
  style,
  mediaById,
  isSelected,
  isSnapTarget,
  isEditingText,
  isDragging,
  isRotating,
  animationPreviewKey = 0,
  theme,
  onSelectItem,
  onSetEditingItemId,
  onStartDrag,
  onItemTextChange,
  onDuplicateItem,
  onDeleteItem,
  onLayerUpItem,
  onLayerDownItem,
  persistedVerse,
  onPersistVerse
}: Props) {
  const withSelection = (action?: (itemId: string) => void) => () => {
    onSelectItem(item.id)
    action?.(item.id)
  }

  const requestTextEdit = () => {
    onSelectItem(item.id)
    queueMicrotask(() => {
      onSetEditingItemId(item.id)
    })
  }

  if (item.type === 'MEDIA') {
    const mediaId = Number(item.accessData || 0)
    const mediaItem = mediaById.get(mediaId)

    return (
      <CanvasItemContextMenu
        onLayerUp={withSelection(onLayerUpItem)}
        onLayerDown={withSelection(onLayerDownItem)}
        onDuplicate={withSelection(onDuplicateItem)}
        onDelete={withSelection(onDeleteItem)}
      >
        <div>
          <MediaCanvasItem
            item={item}
            style={style}
            mediaItem={mediaItem}
            isSelected={isSelected}
            isRotating={isRotating}
            highlightSnapTarget={isSnapTarget}
            onSelectItem={onSelectItem}
            onStartMove={(event) => onStartDrag(event, item, 'move')}
            onStartRotate={(event) => onStartDrag(event, item, 'rotate')}
            onStartResize={(event, corner) => onStartDrag(event, item, 'resize', corner)}
          />
        </div>
      </CanvasItemContextMenu>
    )
  }

  if (item.type === 'SHAPE') {
    return (
      <CanvasItemContextMenu
        onLayerUp={withSelection(onLayerUpItem)}
        onLayerDown={withSelection(onLayerDownItem)}
        onDuplicate={withSelection(onDuplicateItem)}
        onDelete={withSelection(onDeleteItem)}
      >
        <div>
          <ShapeCanvasItem
            item={item}
            style={style}
            isSelected={isSelected}
            isRotating={isRotating}
            highlightSnapTarget={isSnapTarget}
            onSelectItem={onSelectItem}
            onStartMove={(event) => onStartDrag(event, item, 'move')}
            onStartRotate={(event) => onStartDrag(event, item, 'rotate')}
            onStartResize={(event, corner) => onStartDrag(event, item, 'resize', corner)}
          />
        </div>
      </CanvasItemContextMenu>
    )
  }

  return (
    <CanvasItemContextMenu
      onEditText={item.type === 'TEXT' ? requestTextEdit : undefined}
      onLayerUp={withSelection(onLayerUpItem)}
      onLayerDown={withSelection(onLayerDownItem)}
      onDuplicate={withSelection(onDuplicateItem)}
      onDelete={withSelection(onDeleteItem)}
    >
      <div>
        <TextCanvasItem
          itemId={item.id}
          text={item.text || ''}
          type={item.type}
          accessData={item.accessData}
          animationSettings={item.animationSettings}
          layer={Number(item.layer || 0)}
          style={style}
          isSelected={isSelected}
          isDragging={isDragging}
          isRotating={isRotating}
          animationPreviewKey={animationPreviewKey}
          theme={theme}
          isEditable={item.type === 'TEXT'}
          highlightSnapTarget={isSnapTarget}
          isEditing={isEditingText}
          onSelect={() => onSelectItem(item.id)}
          onStartMove={(event) => onStartDrag(event, item, 'move')}
          onRequestEdit={requestTextEdit}
          onExitEdit={() => onSetEditingItemId(null)}
          onTextChange={(nextText) => onItemTextChange?.(item.id, nextText)}
          persistedVerse={persistedVerse}
          onPersistVerse={onPersistVerse}
          handles={
            isSelected ? (
              <CanvasTransformHandles
                onStartRotate={(event) => onStartDrag(event, item, 'rotate')}
                onStartResize={(event, corner) => onStartDrag(event, item, 'resize', corner)}
              />
            ) : null
          }
        />
      </div>
    </CanvasItemContextMenu>
  )
}
