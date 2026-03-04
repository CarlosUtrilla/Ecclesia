import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  onClick?: (e?: React.MouseEvent) => void
  hasTagSong: boolean
  containerStyle: React.CSSProperties
  backgroundLayer: ReactNode
  contentLayer: ReactNode
  tagSongLayer: ReactNode
}

export const PresentationFrame = forwardRef<HTMLDivElement, Props>(function PresentationFrame(
  { onClick, hasTagSong, containerStyle, backgroundLayer, contentLayer, tagSongLayer },
  ref
) {
  return (
    <div
      ref={ref}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      style={containerStyle}
      className={cn('bg-background relative select-none', {
        'pb-7': hasTagSong
      })}
    >
      {backgroundLayer}
      {contentLayer}
      {tagSongLayer}
    </div>
  )
})
