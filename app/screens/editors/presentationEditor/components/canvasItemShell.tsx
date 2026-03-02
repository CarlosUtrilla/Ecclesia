import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CanvasItemStyle } from '../utils/slideUtils'

type Props = {
  itemId?: string
  style: CanvasItemStyle
  layer: number
  isSelected: boolean
  highlightSnapTarget?: boolean
  onSelect: (event: React.MouseEvent<HTMLDivElement>) => void
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void
  children: ReactNode
  handles?: ReactNode
}

export default function CanvasItemShell({
  itemId,
  style,
  layer,
  isSelected,
  highlightSnapTarget,
  onSelect,
  onDoubleClick,
  onPointerDown,
  children,
  handles
}: Props) {
  const itemStyle: React.CSSProperties = {
    left: style.x,
    top: style.y,
    width: style.width,
    height: style.height,
    transform: `rotate(${style.rotation}deg)`,
    zIndex: layer
  }

  return (
    <div
      key={itemId}
      className={cn(
        'absolute border-2 rounded-md bg-black/20 overflow-visible cursor-move select-none',
        {
          'border-primary shadow-[0_0_0_1px_hsl(var(--primary))]': isSelected,
          'border-sky-400/90 shadow-[0_0_0_1px_rgba(56,189,248,0.9)]':
            !isSelected && highlightSnapTarget,
          'border-transparent hover:border-primary/60': !isSelected
        }
      )}
      style={itemStyle}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
    >
      {children}
      {handles}
    </div>
  )
}
