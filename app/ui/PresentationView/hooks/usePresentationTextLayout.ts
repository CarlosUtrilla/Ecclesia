import { useMemo } from 'react'
import { BASE_PRESENTATION_HEIGHT, BASE_PRESENTATION_WIDTH } from '@/lib/themeConstants'
import { ThemeWithMedia, TextBoundsValues } from '../types'

type ScreenSize = {
  width: number
  height: number
  aspectRatio: string
}

type UsePresentationTextLayoutParams = {
  theme: ThemeWithMedia
  screenSize: ScreenSize
}

export function usePresentationTextLayout({ theme, screenSize }: UsePresentationTextLayoutParams) {
  const calculatedFontSize = theme.textStyle?.fontSize
    ? `${(screenSize.height * Number(theme.textStyle.fontSize)) / BASE_PRESENTATION_HEIGHT}px`
    : 'inherit'

  const calculatedSmallFontSize = theme.textStyle?.fontSize
    ? `${(screenSize.height * (Number(theme.textStyle.fontSize) * 0.85)) / BASE_PRESENTATION_HEIGHT}px`
    : 'inherit'

  const scaleFactor = useMemo(() => {
    const factor = screenSize.height / BASE_PRESENTATION_HEIGHT
    return Number.isFinite(factor) && factor > 0 ? factor : 1
  }, [screenSize.height])

  const basePaddingInline = Number(theme.textStyle?.paddingInline ?? 16)
  const basePaddingBlock = Number(theme.textStyle?.paddingBlock ?? 16)

  const safePaddingInline = Number.isFinite(basePaddingInline) ? basePaddingInline : 16
  const safePaddingBlock = Number.isFinite(basePaddingBlock) ? basePaddingBlock : 16

  const textContainerPadding = useMemo(() => {
    const horizontal = Number.isFinite(safePaddingInline)
      ? (screenSize.width * safePaddingInline) / BASE_PRESENTATION_WIDTH
      : 16
    const vertical = Number.isFinite(safePaddingBlock)
      ? (screenSize.height * safePaddingBlock) / BASE_PRESENTATION_HEIGHT
      : 16

    return {
      horizontal,
      vertical
    }
  }, [safePaddingInline, safePaddingBlock, screenSize.height, screenSize.width])

  const textStyleConfig = (theme.textStyle || {}) as Record<string, unknown>
  const justifyContentRaw =
    typeof textStyleConfig.justifyContent === 'string' ? textStyleConfig.justifyContent : 'center'
  const verticalAlign: 'top' | 'center' | 'bottom' =
    justifyContentRaw === 'flex-start'
      ? 'top'
      : justifyContentRaw === 'flex-end'
        ? 'bottom'
        : 'center'

  const translateRaw = typeof textStyleConfig.translate === 'string' ? textStyleConfig.translate : ''
  const translateParts = translateRaw.trim().split(/\s+/)
  const translateXValue = Number.parseFloat(translateParts[0] || '0')
  const translateYValue = Number.parseFloat(translateParts[1] || translateParts[0] || '0')

  const textContainerOffset = useMemo(() => {
    const x = Number.isFinite(translateXValue)
      ? (screenSize.width * translateXValue) / BASE_PRESENTATION_WIDTH
      : 0
    const y = Number.isFinite(translateYValue)
      ? (screenSize.height * translateYValue) / BASE_PRESENTATION_HEIGHT
      : 0
    return { x, y }
  }, [screenSize.height, screenSize.width, translateXValue, translateYValue])

  const textBoundsScale = useMemo(
    () => ({
      x: screenSize.width / BASE_PRESENTATION_WIDTH,
      y: screenSize.height / BASE_PRESENTATION_HEIGHT
    }),
    [screenSize.width, screenSize.height]
  )

  const textBoundsBaseValues: TextBoundsValues = {
    paddingInline: safePaddingInline,
    paddingBlock: safePaddingBlock,
    translateX: Number.isFinite(translateXValue) ? translateXValue : 0,
    translateY: Number.isFinite(translateYValue) ? translateYValue : 0
  }

  const textStyle = useMemo(() => {
    const restTextStyle = { ...(theme.textStyle || {}) } as Record<string, unknown>
    delete restTextStyle.paddingInline
    delete restTextStyle.paddingBlock
    delete restTextStyle.translate
    delete restTextStyle.justifyContent

    return {
      ...restTextStyle,
      fontSize: calculatedFontSize
    }
  }, [theme.textStyle, calculatedFontSize])

  return {
    calculatedSmallFontSize,
    scaleFactor,
    verticalAlign,
    textStyle,
    textContainerPadding,
    textContainerOffset,
    textBoundsScale,
    textBoundsBaseValues
  }
}
