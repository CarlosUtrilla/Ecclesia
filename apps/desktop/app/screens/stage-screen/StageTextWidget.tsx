import { Variants } from 'framer-motion'
import { AnimatedText } from '@/ui/PresentationView/components/AnimatedText'

const EMPTY_VARIANTS: Variants = { initial: {}, animate: {}, exit: {} }

type Props = {
  text: string
  color: string
  fontFamily: string
  fontSize: number
  fontScale?: number
  fontWeight?: number
  textAlign?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'center' | 'bottom'
  paddingInline?: number
  paddingBlock?: number
}

export function StageTextWidget({
  text,
  color,
  fontFamily,
  fontSize,
  fontScale = 1,
  fontWeight = 700,
  textAlign = 'center',
  verticalAlign = 'center',
  paddingInline = 16,
  paddingBlock = 8
}: Props) {
  const resolvedFontSize = Math.max(10, fontSize * fontScale)
  const resolvedPaddingInline = Math.max(2, paddingInline * fontScale)
  const resolvedPaddingBlock = Math.max(1, paddingBlock * fontScale)

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AnimatedText
        item={{ text, resourceType: 'TEXT' }}
        animationType="none"
        variants={EMPTY_VARIANTS}
        textStyle={{
          color,
          fontFamily,
          fontWeight,
          fontSize: `${resolvedFontSize}px`,
          lineHeight: 1.05,
          textAlign,
          whiteSpace: 'pre-wrap'
        }}
        isPreview={false}
        textContainerPadding={{ horizontal: resolvedPaddingInline, vertical: resolvedPaddingBlock }}
        textContainerOffset={{ x: 0, y: 0 }}
        verticalAlign={verticalAlign}
        showTextBounds={false}
      />
    </div>
  )
}
