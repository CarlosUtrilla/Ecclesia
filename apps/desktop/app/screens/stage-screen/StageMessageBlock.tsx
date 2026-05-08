type Props = {
  message: string
  color: string
  fontFamily: string
  fontSizePx: number
  textAlign?: 'left' | 'center' | 'right'
  fontWeight?: number
  className?: string
}

export function StageMessageBlock({
  message,
  color,
  fontFamily,
  fontSizePx,
  textAlign = 'left',
  fontWeight = 600,
  className
}: Props) {
  return (
    <div
      className={className}
      style={{
        color,
        fontFamily,
        fontWeight,
        fontSize: `${fontSizePx}px`,
        lineHeight: 1.25,
        textAlign,
        whiteSpace: 'pre-wrap'
      }}
    >
      {message}
    </div>
  )
}
