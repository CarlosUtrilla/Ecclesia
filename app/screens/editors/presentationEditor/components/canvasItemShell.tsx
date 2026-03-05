import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CanvasItemStyle } from '../utils/slideUtils'

type Props = {
  itemId?: string
  style: CanvasItemStyle
  layer: number
  isSelected: boolean
  rotationLabel?: string
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
  rotationLabel,
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
      className={cn('absolute bg-transparent overflow-visible cursor-move select-none', {
        'outline-2 outline-primary shadow-[0_0_0_1px_hsl(var(--primary))]': isSelected,
        'outline-2 outline-sky-400/90 shadow-[0_0_0_1px_rgba(56,189,248,0.9)]':
          !isSelected && highlightSnapTarget,
        'hover:outline-2 hover:outline-primary/60': !isSelected
      })}
      style={itemStyle}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
    >
      {rotationLabel ? (
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md border border-border/70 bg-background/95 text-[11px] leading-none font-medium text-foreground pointer-events-none shadow-sm">
          {rotationLabel}
        </div>
      ) : null}
      {children}
      {handles}
    </div>
  )
}
