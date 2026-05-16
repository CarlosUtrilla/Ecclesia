import { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  text: string
  color: string
  fontFamily: string
  fontSizePx: number
  textAlign?: 'left' | 'center' | 'right'
  fontWeight?: number
  lineHeight?: number
  className?: string
  style?: CSSProperties
}

export function StageClockWidget({
  text,
  color,
  fontFamily,
  fontSizePx,
  textAlign = 'right',
  fontWeight = 700,
  lineHeight = 1,
  className,
  style
}: Props) {
  return (
    <div
      className={cn('w-full overflow-hidden tabular-nums', className)}
      style={{
        color,
        fontFamily,
        fontWeight,
        fontSize: `${fontSizePx}px`,
        lineHeight,
        textAlign,
        whiteSpace: 'nowrap',
        ...style
      }}
    >
      {text}
    </div>
  )
}
