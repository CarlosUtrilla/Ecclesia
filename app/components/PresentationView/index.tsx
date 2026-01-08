import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, sanitizeHTML } from '../../lib/utils'
import { PresentationViewProps, PresentationViewsItemsProps, ScreenSize } from './types'
import { useDisplays } from '@/hooks/useDisplays'
import { getAnimationVariants, wordVariants, AnimationType } from '@/lib/animations'
import { AnimationSettings, defaultAnimationSettings } from '@/lib/animationSettings'

// Detectar tipo de medio basado en la extensión del archivo
type MediaType = 'image' | 'video' | 'color' | 'gradient'

function getMediaType(background: string): MediaType {
  if (!background) return 'color'

  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov']
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']

  const lowerBackground = background.toLowerCase()

  if (videoExtensions.some((ext) => lowerBackground.includes(ext))) return 'video'
  if (imageExtensions.some((ext) => lowerBackground.includes(ext))) return 'image'
  if (lowerBackground.includes('gradient')) return 'gradient'

  return 'color'
}

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
  const mediaType = useMemo(() => getMediaType(background), [background])
  const videoRef = useRef<HTMLVideoElement>(null)
  const calculatedFontSize = theme.textSize
    ? `${(screenSize.height * theme.textSize) / 320}px`
    : 'inherit'

  // Asegurar que el video se reproduzca cuando esté listo
  useEffect(() => {
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.play().catch((error) => {
        console.error('Error al reproducir video:', error)
      })
    }
  }, [mediaType, background])

  // Parse animation settings - memoizado
  const animationSettings = useMemo<AnimationSettings>(() => {
    try {
      return JSON.parse(theme.animationSettings || '{}')
    } catch {
      return defaultAnimationSettings
    }
  }, [theme.animationSettings])

  const animationType = (animationSettings.type || 'fade') as AnimationType

  // Memoizar variants para evitar recalcular en cada render
  const variants = useMemo(
    () =>
      getAnimationVariants(
        animationType,
        animationSettings.duration,
        animationSettings.delay,
        animationSettings.easing
      ),
    [animationType, animationSettings.duration, animationSettings.delay, animationSettings.easing]
  )

  // Memoizar estilos de texto
  const textStyle = useMemo(
    () => ({
      color: theme.textColor,
      fontFamily: theme.fontFamily,
      fontStyle: theme.italic ? 'italic' : 'normal',
      fontWeight: theme.bold ? 'bold' : 'normal',
      textDecoration: theme.underline ? 'underline' : 'none',
      lineHeight: theme.lineHeight,
      letterSpacing: theme.letterSpacing,
      textAlign: theme.textAlign as 'left' | 'center' | 'right',
      fontSize: calculatedFontSize
    }),
    [
      theme.textColor,
      theme.fontFamily,
      theme.italic,
      theme.bold,
      theme.underline,
      theme.lineHeight,
      theme.letterSpacing,
      theme.textAlign,
      calculatedFontSize
    ]
  )

  // Memoizar estilos de contenedor
  const containerStyle = useMemo(
    () => ({
      width: `${screenSize.width}px`,
      maxWidth: '100%',
      aspectRatio: screenSize.aspectRatio,
      maxHeight: '100%',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative' as const,
      background: mediaType === 'color' || mediaType === 'gradient' ? background : 'transparent'
    }),
    [screenSize.width, screenSize.aspectRatio, background, mediaType]
  )

  // Para la animación 'split', dividimos el texto en palabras
  const renderAnimatedText = useMemo(() => {
    if (animationType === 'split') {
      // Dividir el texto respetando los <br> y otros tags HTML
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
  }, [animationType, text, variants, textStyle])

  return (
    <div
      style={containerStyle}
      className={cn('rounded-md border bg-background', {
        'rounded-none': live
      })}
    >
      {/* Fondo de imagen - no cambia con el texto */}
      {mediaType === 'image' && (
        <img
          src={background}
          alt="Background"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0
          }}
        />
      )}

      {/* Fondo de video - no cambia con el texto, se reproduce en bucle */}
      {mediaType === 'video' && (
        <video
          ref={videoRef}
          key={background}
          src={background}
          autoPlay
          loop
          muted
          playsInline
          onError={(e) => console.error('Error cargando video:', e)}
          onLoadedData={() => {
            console.log('Video cargado correctamente')
            videoRef.current?.play()
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0
          }}
        />
      )}

      {/* Contenido de texto - cambia con animaciones */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', padding: '1rem' }}>
        <AnimatePresence mode="wait">
          <div key={text}>{renderAnimatedText}</div>
        </AnimatePresence>
      </div>
    </div>
  )
}
