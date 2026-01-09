import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { sanitizeHTML } from '@/lib/utils'
import { wordVariants, AnimationType } from '@/lib/animations'

interface AnimatedTextProps {
  text: string
  animationType: AnimationType
  variants: any
  textStyle: React.CSSProperties
  isPreview?: boolean
}

export function AnimatedText({
  text,
  animationType,
  variants,
  textStyle,
  isPreview
}: AnimatedTextProps) {
  const content = useMemo(() => {
    if (isPreview) {
      return <div style={textStyle} dangerouslySetInnerHTML={{ __html: sanitizeHTML(text) }} />
    }
    if (animationType === 'split') {
      const lines = text.split(/<br\s*\/?>/i)

      return (
        <motion.div
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={textStyle}
        >
          {lines.map((line, lineIndex) => {
            const words = line
              .trim()
              .split(' ')
              .filter((word) => word.length > 0)
            return (
              <div key={lineIndex}>
                {words.map((word, wordIndex) => (
                  <motion.span
                    key={`${lineIndex}-${wordIndex}`}
                    variants={wordVariants}
                    style={{ display: 'inline-block', marginRight: '0.3em' }}
                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(word) }}
                  />
                ))}
                {lineIndex < lines.length - 1 && <br />}
              </div>
            )
          })}
        </motion.div>
      )
    }

    return (
      <motion.div
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={textStyle}
        dangerouslySetInnerHTML={{ __html: sanitizeHTML(text) }}
      />
    )
  }, [animationType, text, variants, textStyle, isPreview])

  return (
    <div key={text} style={{ position: 'relative', zIndex: 1, width: '100%', padding: '1rem' }}>
      {content}
    </div>
  )
}
