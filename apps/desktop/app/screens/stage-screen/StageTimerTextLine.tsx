import { Variants } from 'framer-motion'
import { AnimatedText } from '@/ui/PresentationView/components/AnimatedText'
import { fitFontSizeToWidth } from './utils'

const EMPTY_VARIANTS: Variants = { initial: {}, animate: {}, exit: {} }

type Props = {
  color: string
  fontFamily: string
  label: string
  value: string
  labelFontSizePx: number
  valueFontSizePx: number
  valueFontSizeMaxPx: number
  valueContainerWidthPx: number
}

export function StageTimerTextLine({
  color,
  fontFamily,
  label,
  value,
  labelFontSizePx,
  valueFontSizePx,
  valueFontSizeMaxPx,
  valueContainerWidthPx
}: Props) {
  const fittedValueFontSize = fitFontSizeToWidth(
    value,
    valueFontSizePx,
    valueFontSizeMaxPx,
    valueContainerWidthPx
  )
  const valueContainerHeightPx = Math.max(20, fittedValueFontSize * 1.14)

  return (
    <div className="flex w-full flex-col justify-start overflow-hidden">
      <div
        className="w-full truncate text-left uppercase leading-none"
        style={{
          color,
          fontFamily,
          fontWeight: 600,
          fontSize: `${labelFontSizePx}px`,
          letterSpacing: '0.02em',
          opacity: 0.9
        }}
      >
        {label}
      </div>
      <div
        className="relative mt-[0.06em] w-full overflow-hidden"
        style={{ height: `${valueContainerHeightPx}px` }}
      >
        <AnimatedText
          item={{ text: value, resourceType: 'TEXT' }}
          animationType="none"
          variants={EMPTY_VARIANTS}
          textStyle={{
            color,
            fontFamily,
            fontWeight: 700,
            fontSize: `${fittedValueFontSize}px`,
            lineHeight: 0.92,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums'
          }}
          isPreview={false}
          textContainerPadding={{ horizontal: 0, vertical: 0 }}
          textContainerOffset={{ x: 0, y: 0 }}
          verticalAlign="center"
          showTextBounds={false}
        />
      </div>
    </div>
  )
}
