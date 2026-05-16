import CanvasItemShell from './canvasItemShell'
import CanvasTransformHandles, { ResizeHandle } from './canvasTransformHandles'
import { sanitizeHTML } from '@/lib/utils'
import {
  CanvasItemStyle,
  getShapeTypeFromAccessData,
  PresentationSlideItem
} from '../utils/slideUtils'

type Props = {
  item: PresentationSlideItem
  style: CanvasItemStyle
  isSelected: boolean
  isRotating?: boolean
  highlightSnapTarget?: boolean
  onSelectItem: (itemId: string, options?: { toggle?: boolean }) => void
  onStartMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onStartRotate: (event: React.PointerEvent<HTMLDivElement>) => void
  onStartResize: (event: React.PointerEvent<HTMLDivElement>, corner: ResizeHandle) => void
}

export default function ShapeCanvasItem({
  item,
  style,
  isSelected,
  isRotating = false,
  highlightSnapTarget,
  onSelectItem,
  onStartMove,
  onStartRotate,
  onStartResize
}: Props) {
  const shapeType = getShapeTypeFromAccessData(item.accessData)
  const fill = style.shapeFill || 'rgba(59, 130, 246, 0.18)'
  const stroke = style.shapeStroke || '#2563eb'
  const strokeWidth = style.shapeStrokeWidth ?? 4
  const opacity = style.shapeOpacity ?? 1
  const label = item.text?.trim() || ''

  return (
    <CanvasItemShell
      itemId={item.id}
      style={style}
      layer={Number(item.layer || 0)}
      isSelected={isSelected}
      rotationLabel={isRotating ? `${Math.round(style.rotation)}°` : undefined}
      highlightSnapTarget={highlightSnapTarget}
      onSelect={(event) => {
        event.stopPropagation()
        onSelectItem(item.id, event.metaKey || event.ctrlKey ? { toggle: true } : undefined)
      }}
      onPointerDown={onStartMove}
      handles={
        isSelected ? (
          <CanvasTransformHandles onStartRotate={onStartRotate} onStartResize={onStartResize} />
        ) : null
      }
    >
      <div className="relative w-full h-full pointer-events-none" style={{ opacity }}>
        {shapeType === 'arrow' ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
            <polygon
              points="0,35 68,35 68,12 100,50 68,88 68,65 0,65"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </svg>
        ) : shapeType === 'line-arrow' ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
            <line
              x1="8"
              y1="50"
              x2="82"
              y2="50"
              stroke={stroke}
              strokeWidth={strokeWidth * 2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points="68,32 92,50 68,68"
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth * 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : shapeType === 'triangle' ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
            <polygon
              points="50,6 96,94 4,94"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </svg>
        ) : shapeType === 'line' ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
            <line
              x1="8"
              y1="50"
              x2="92"
              y2="50"
              stroke={stroke}
              strokeWidth={strokeWidth * 2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : shapeType === 'cross' ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
            <line
              x1="15"
              y1="15"
              x2="85"
              y2="85"
              stroke={stroke}
              strokeWidth={strokeWidth * 1.5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="85"
              y1="15"
              x2="15"
              y2="85"
              stroke={stroke}
              strokeWidth={strokeWidth * 1.5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <div
            className="w-full h-full"
            style={{
              backgroundColor: fill,
              border: `${strokeWidth}px solid ${stroke}`,
              borderRadius: shapeType === 'circle' ? '9999px' : '24px'
            }}
          />
        )}

        {label ? (
          <div
            className="absolute inset-0 flex items-center justify-center px-4 text-center break-words overflow-hidden"
            style={{
              color: style.color,
              fontFamily: style.fontFamily,
              fontSize: `${style.fontSize}px`,
              lineHeight: style.lineHeight,
              letterSpacing: `${style.letterSpacing}px`,
              fontWeight: style.fontWeight,
              fontStyle: style.fontStyle,
              textDecoration: style.textDecoration,
              textAlign: style.textAlign
            }}
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(label) }}
          />
        ) : null}
      </div>
    </CanvasItemShell>
  )
}