import type { TextEffectsValue } from '../components/textEffectsControls'
import type { EditableBoundsTarget } from '@/ui/PresentationView/types'

export type TargetTypographyStyle = {
  fontFamily?: string
  fontSize?: number
  color?: string
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline'
  lineHeight?: number
  letterSpacing?: number
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  justifyContent?: 'flex-start' | 'center' | 'flex-end'
}

const toPrefixedKey = (key: string) => `verse${key.charAt(0).toUpperCase()}${key.slice(1)}`

export const getTargetTextStyleFieldPath = (
  target: EditableBoundsTarget,
  key: keyof TargetTypographyStyle
) => (target === 'verse' ? `textStyle.${toPrefixedKey(key)}` : `textStyle.${key}`)

export const getTargetTypographyStyle = (
  textStyle: Record<string, unknown> | undefined,
  target: EditableBoundsTarget
): TargetTypographyStyle => {
  const source = textStyle || {}

  if (target === 'text') {
    return {
      fontFamily: source.fontFamily as string | undefined,
      fontSize: source.fontSize as number | undefined,
      color: source.color as string | undefined,
      fontWeight: source.fontWeight as TargetTypographyStyle['fontWeight'],
      fontStyle: source.fontStyle as TargetTypographyStyle['fontStyle'],
      textDecoration: source.textDecoration as TargetTypographyStyle['textDecoration'],
      lineHeight: source.lineHeight as number | undefined,
      letterSpacing: source.letterSpacing as number | undefined,
      textAlign: source.textAlign as TargetTypographyStyle['textAlign'],
      justifyContent: source.justifyContent as TargetTypographyStyle['justifyContent']
    }
  }

  return {
    fontFamily: (source.verseFontFamily as string | undefined) || (source.fontFamily as string | undefined),
    fontSize:
      (source.verseFontSize as number | undefined) ||
      (typeof source.fontSize === 'number' ? Math.round(source.fontSize * 0.85) : undefined),
    color: (source.verseColor as string | undefined) || (source.color as string | undefined),
    fontWeight:
      (source.verseFontWeight as TargetTypographyStyle['fontWeight']) ||
      (source.fontWeight as TargetTypographyStyle['fontWeight']),
    fontStyle:
      (source.verseFontStyle as TargetTypographyStyle['fontStyle']) ||
      (source.fontStyle as TargetTypographyStyle['fontStyle']),
    textDecoration:
      (source.verseTextDecoration as TargetTypographyStyle['textDecoration']) ||
      (source.textDecoration as TargetTypographyStyle['textDecoration']),
    lineHeight:
      (source.verseLineHeight as number | undefined) || (source.lineHeight as number | undefined),
    letterSpacing:
      (source.verseLetterSpacing as number | undefined) ||
      (source.letterSpacing as number | undefined),
    textAlign:
      (source.verseTextAlign as TargetTypographyStyle['textAlign']) ||
      (source.textAlign as TargetTypographyStyle['textAlign']),
    justifyContent:
      (source.verseJustifyContent as TargetTypographyStyle['justifyContent']) ||
      (source.justifyContent as TargetTypographyStyle['justifyContent'])
  }
}

export const getTargetTextEffectsValue = (
  textStyle: Record<string, unknown> | undefined,
  target: EditableBoundsTarget
): TextEffectsValue => {
  const source = textStyle || {}

  if (target === 'text') {
    return source as TextEffectsValue
  }

  return {
    textShadowEnabled:
      (source.verseTextShadowEnabled as boolean | undefined) ??
      (source.textShadowEnabled as boolean | undefined),
    textShadowColor:
      (source.verseTextShadowColor as string | undefined) ||
      (source.textShadowColor as string | undefined),
    textShadowBlur:
      (source.verseTextShadowBlur as number | undefined) ||
      (source.textShadowBlur as number | undefined),
    textShadowOffsetX:
      (source.verseTextShadowOffsetX as number | undefined) ||
      (source.textShadowOffsetX as number | undefined),
    textShadowOffsetY:
      (source.verseTextShadowOffsetY as number | undefined) ||
      (source.textShadowOffsetY as number | undefined),
    textStrokeEnabled:
      (source.verseTextStrokeEnabled as boolean | undefined) ??
      (source.textStrokeEnabled as boolean | undefined),
    textStrokeColor:
      (source.verseTextStrokeColor as string | undefined) ||
      (source.textStrokeColor as string | undefined),
    textStrokeWidth:
      (source.verseTextStrokeWidth as number | undefined) ||
      (source.textStrokeWidth as number | undefined),
    blockBgEnabled:
      (source.verseBlockBgEnabled as boolean | undefined) ??
      (source.blockBgEnabled as boolean | undefined),
    blockBgColor:
      (source.verseBlockBgColor as string | undefined) ||
      (source.blockBgColor as string | undefined),
    blockBgBlur:
      (source.verseBlockBgBlur as number | undefined) ||
      (source.blockBgBlur as number | undefined),
    blockBgPadding:
      (source.verseBlockBgPadding as number | null | undefined) ??
      (source.blockBgPadding as number | null | undefined),
    blockBgOpacity:
      (source.verseBlockBgOpacity as number | undefined) ||
      (source.blockBgOpacity as number | undefined),
    blockBgRadius:
      (source.verseBlockBgRadius as number | undefined) ||
      (source.blockBgRadius as number | undefined)
  }
}

export const mapTextEffectsUpdatesToTarget = (
  updates: Partial<TextEffectsValue>,
  target: EditableBoundsTarget
) => {
  if (target === 'text') return updates

  return Object.fromEntries(
    Object.entries(updates).map(([key, value]) => [toPrefixedKey(key), value])
  ) as Record<string, unknown>
}
