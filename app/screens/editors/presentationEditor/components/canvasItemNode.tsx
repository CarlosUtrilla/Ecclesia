import { PointerEvent } from 'react'
import { Media } from '@prisma/client'
import { PresentationSlideItem, CanvasItemStyle } from '../utils/slideUtils'
import CanvasItemContextMenu from './canvasItemContextMenu'
import CanvasTransformHandles, { ResizeHandle } from './canvasTransformHandles'
import MediaCanvasItem from './mediaCanvasItem'
import TextCanvasItem from './textCanvasItem'

type DragMode = 'move' | 'resize' | 'rotate'

type Props = {
  item: PresentationSlideItem
  style: CanvasItemStyle
  mediaById: Map<number, Media>
  isSelected: boolean
  isSnapTarget: boolean
  isEditingText: boolean
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
}

export default function CanvasItemNode({
  item,
  style,
  mediaById,
  isSelected,
  isSnapTarget,
  isEditingText,
  onSelectItem,
  onSetEditingItemId,
  onStartDrag,
  onItemTextChange,
  onDuplicateItem,
  onDeleteItem,
  onLayerUpItem,
  onLayerDownItem
}: Props) {
  const withSelection = (action?: (itemId: string) => void) => () => {
    onSelectItem(item.id)
    action?.(item.id)
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
        <MediaCanvasItem
          item={item}
          style={style}
          mediaItem={mediaItem}
          isSelected={isSelected}
          highlightSnapTarget={isSnapTarget}
          onSelectItem={onSelectItem}
          onStartMove={(event) => onStartDrag(event, item, 'move')}
          onStartRotate={(event) => onStartDrag(event, item, 'rotate')}
          onStartResize={(event, corner) => onStartDrag(event, item, 'resize', corner)}
        />
      </CanvasItemContextMenu>
    )
  }

  return (
    <CanvasItemContextMenu
      onEditText={() => {
        onSelectItem(item.id)
        onSetEditingItemId(item.id)
      }}
      onLayerUp={withSelection(onLayerUpItem)}
      onLayerDown={withSelection(onLayerDownItem)}
      onDuplicate={withSelection(onDuplicateItem)}
      onDelete={withSelection(onDeleteItem)}
    >
      <div>
        <TextCanvasItem
          itemId={item.id}
          text={item.text || ''}
          layer={Number(item.layer || 0)}
          style={style}
          isSelected={isSelected}
          highlightSnapTarget={isSnapTarget}
          isEditing={isEditingText}
          onSelect={() => onSelectItem(item.id)}
          onStartMove={(event) => onStartDrag(event, item, 'move')}
          onRequestEdit={() => onSetEditingItemId(item.id)}
          onExitEdit={() => onSetEditingItemId(null)}
          onTextChange={(nextText) => onItemTextChange?.(item.id, nextText)}
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
