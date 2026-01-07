import { useState, useEffect } from 'react'
import { cn, sanitizeHTML } from '../../lib/utils'
import { PresentationViewProps, PresentationViewsItemsProps, ScreenSize } from './types'
import { useDisplays } from '@/hooks/useDisplays'

export function PresentationView({ maxHeight = 150, items, theme, live }: PresentationViewProps) {
  const [screenSize, setScreenSize] = useState<ScreenSize>({
    width: 0,
    height: 0,
    aspectRatio: '16 / 9'
  })
  const { displays } = useDisplays()
  useEffect(() => {
    const calculatePreviewSize = () => {
      const publicDisplay =
        displays.find((display) => display.usageType === 'public') || displays[0]

      if (!publicDisplay) {
        setScreenSize({ width: 0, height: 0, aspectRatio: '16 / 9' })
        return
      }

      const aspectRatio = publicDisplay.aspectRatioCss
      const maxHeightNum = maxHeight

      // Extraer el aspect ratio para calcular proporcionalmente
      const [arWidth, arHeight] = aspectRatio.split('/').map((n) => parseFloat(n.trim()))
      const width = Math.round(maxHeightNum * (arWidth / arHeight))

      setScreenSize({
        width,
        height: maxHeightNum,
        aspectRatio
      })
    }

    calculatePreviewSize()
    window.addEventListener('resize', calculatePreviewSize)

    return () => window.removeEventListener('resize', calculatePreviewSize)
  }, [maxHeight, displays])
  return (
    <>
      {items.map((item) => (
        <PresentationViewItem
          live={live}
          screenSize={screenSize}
          key={item.text}
          theme={theme}
          {...item}
        />
      ))}
    </>
  )
}

export function PresentationViewItem({
  text,
  screenSize,
  theme,
  live
}: PresentationViewsItemsProps) {
  const background = theme.background
  const calculatedFontSize = theme.textSize
    ? `${(screenSize.height * theme.textSize) / 320}px`
    : 'inherit'
  return (
    <div
      style={{
        width: `${screenSize.width}px`,
        maxWidth: '100%',
        aspectRatio: screenSize.aspectRatio,
        maxHeight: '100%',
        overflow: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background
      }}
      className={cn('rounded-md border bg-background', {
        'rounded-none': live
      })}
    >
      <div
        style={{
          color: theme.textColor,
          fontFamily: theme.fontFamily,
          fontStyle: theme.italic ? 'italic' : '',
          fontWeight: theme.bold ? 'bold' : '',
          textDecoration: theme.underline ? 'underline' : '',
          lineHeight: theme.lineHeight,
          letterSpacing: theme.letterSpacing,
          textAlign: theme.textAlign as 'left' | 'center' | 'right',
          fontSize: calculatedFontSize
        }}
        dangerouslySetInnerHTML={{ __html: sanitizeHTML(text) }}
      ></div>
    </div>
  )
}
