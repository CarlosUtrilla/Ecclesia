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
  const toFiniteNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value)
      return Number.isFinite(parsed) ? parsed : null
    }

    return null
  }

  const baseFontSize = toFiniteNumber(theme.textStyle?.fontSize)

  const calculatedFontSize =
    baseFontSize !== null
      ? `${(screenSize.height * baseFontSize) / BASE_PRESENTATION_HEIGHT}px`
      : 'inherit'

  const calculatedSmallFontSize =
    baseFontSize !== null
      ? `${(screenSize.height * (baseFontSize * 0.85)) / BASE_PRESENTATION_HEIGHT}px`
      : 'inherit'

  const scaleFactor = useMemo(() => {
    const factor = screenSize.height / BASE_PRESENTATION_HEIGHT
    return Number.isFinite(factor) && factor > 0 ? factor : 1
  }, [screenSize.height])

  const basePaddingInline = toFiniteNumber(theme.textStyle?.paddingInline)
  const basePaddingBlock = toFiniteNumber(theme.textStyle?.paddingBlock)

  const safePaddingInline = basePaddingInline ?? 16
  const safePaddingBlock = basePaddingBlock ?? 16

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

  const { textStyle, blockBgStyle, blockBgPadding } = useMemo(() => {
    const restTextStyle = { ...(theme.textStyle || {}) } as Record<string, unknown>
    delete restTextStyle.paddingInline
    delete restTextStyle.paddingBlock
    delete restTextStyle.translate
    delete restTextStyle.justifyContent
    delete restTextStyle.verseFontFamily
    delete restTextStyle.verseFontSize
    delete restTextStyle.verseColor
    delete restTextStyle.verseFontWeight
    delete restTextStyle.verseFontStyle
    delete restTextStyle.verseTextDecoration
    delete restTextStyle.verseLineHeight
    delete restTextStyle.verseLetterSpacing
    delete restTextStyle.verseTextAlign
    delete restTextStyle.verseJustifyContent
    delete restTextStyle.verseTextShadowEnabled
    delete restTextStyle.verseTextShadowColor
    delete restTextStyle.verseTextShadowBlur
    delete restTextStyle.verseTextShadowOffsetX
    delete restTextStyle.verseTextShadowOffsetY
    delete restTextStyle.verseTextStrokeEnabled
    delete restTextStyle.verseTextStrokeColor
    delete restTextStyle.verseTextStrokeWidth
    delete restTextStyle.verseBlockBgEnabled
    delete restTextStyle.verseBlockBgColor
    delete restTextStyle.verseBlockBgBlur
    delete restTextStyle.verseBlockBgRadius
    delete restTextStyle.verseBlockBgOpacity
    delete restTextStyle.verseBlockBgPadding

    // Componer text-shadow desde campos personalizados (escalados al tamaño de pantalla)
    const shadowEnabled = !!restTextStyle.textShadowEnabled
    delete restTextStyle.textShadowEnabled
    const shadowColor = (restTextStyle.textShadowColor as string | undefined) ?? 'rgba(0,0,0,0.5)'
    delete restTextStyle.textShadowColor
    const shadowBlur = Number.isFinite(restTextStyle.textShadowBlur as number)
      ? (restTextStyle.textShadowBlur as number)
      : 4
    delete restTextStyle.textShadowBlur
    const shadowOffsetX = Number.isFinite(restTextStyle.textShadowOffsetX as number)
      ? (restTextStyle.textShadowOffsetX as number)
      : 2
    delete restTextStyle.textShadowOffsetX
    const shadowOffsetY = Number.isFinite(restTextStyle.textShadowOffsetY as number)
      ? (restTextStyle.textShadowOffsetY as number)
      : 2
    delete restTextStyle.textShadowOffsetY

    // Componer text-stroke desde campos personalizados
    const strokeEnabled = !!restTextStyle.textStrokeEnabled
    delete restTextStyle.textStrokeEnabled
    const strokeColor = (restTextStyle.textStrokeColor as string | undefined) ?? '#000000'
    delete restTextStyle.textStrokeColor
    const strokeWidth = Number.isFinite(restTextStyle.textStrokeWidth as number)
      ? (restTextStyle.textStrokeWidth as number)
      : 1
    delete restTextStyle.textStrokeWidth

    // Extraer campos de fondo de bloque
    const blockBgEnabled = !!restTextStyle.blockBgEnabled
    delete restTextStyle.blockBgEnabled
    const blockBgColor = (restTextStyle.blockBgColor as string | undefined) ?? 'rgba(0,0,0,0.5)'
    delete restTextStyle.blockBgColor
    const blockBgBlur = Number.isFinite(restTextStyle.blockBgBlur as number)
      ? (restTextStyle.blockBgBlur as number)
      : 0
    delete restTextStyle.blockBgBlur
    const blockBgRadius = Number.isFinite(restTextStyle.blockBgRadius as number)
      ? (restTextStyle.blockBgRadius as number)
      : 0
    delete restTextStyle.blockBgRadius
    const blockBgOpacity = Number.isFinite(restTextStyle.blockBgOpacity as number)
      ? (restTextStyle.blockBgOpacity as number)
      : 1
    delete restTextStyle.blockBgOpacity
    const blockBgPadding = Number.isFinite(restTextStyle.blockBgPadding as number)
      ? (restTextStyle.blockBgPadding as number)
      : null
    delete restTextStyle.blockBgPadding

    const computedTextStyle = {
      ...restTextStyle,
      fontSize: calculatedFontSize,
      ...(shadowEnabled
        ? {
            textShadow: `${(shadowOffsetX * scaleFactor).toFixed(1)}px ${(shadowOffsetY * scaleFactor).toFixed(1)}px ${(shadowBlur * scaleFactor).toFixed(1)}px ${shadowColor}`
          }
        : {}),
      ...(strokeEnabled
        ? { WebkitTextStroke: `${(strokeWidth * scaleFactor).toFixed(2)}px ${strokeColor}` }
        : {})
    }

    const computedBlockBgStyle = blockBgEnabled
      ? {
          backgroundColor: blockBgColor,
          opacity: blockBgOpacity,
          ...(blockBgBlur > 0
            ? { backdropFilter: `blur(${(blockBgBlur * scaleFactor).toFixed(1)}px)` }
            : {}),
          ...(blockBgRadius > 0
            ? { borderRadius: `${(blockBgRadius * scaleFactor).toFixed(1)}px` }
            : {})
        }
      : null

    const computedBlockBgPadding =
      blockBgEnabled && blockBgPadding !== null
        ? Math.round(blockBgPadding * scaleFactor)
        : null

    return { textStyle: computedTextStyle, blockBgStyle: computedBlockBgStyle, blockBgPadding: computedBlockBgPadding }
  }, [theme.textStyle, calculatedFontSize, scaleFactor])

  return {
    calculatedSmallFontSize,
    scaleFactor,
    verticalAlign,
    textStyle,
    blockBgStyle,
    blockBgPadding,
    textContainerPadding,
    textContainerOffset,
    textBoundsScale,
    textBoundsBaseValues
  }
}
