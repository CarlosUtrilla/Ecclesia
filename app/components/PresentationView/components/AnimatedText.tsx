import { useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { sanitizeHTML } from '@/lib/utils'
import { wordVariants, AnimationType } from '@/lib/animations'
import { PresentationViewItems, ThemeWithMedia } from '../types'
import useBiblePresentationSetting from '../hooks/useBibleSetting'
import useBibleSchema from '@/hooks/useBibleSchema'

/**
 * Props para el componente AnimatedText
 */
interface AnimatedTextProps {
  item: PresentationViewItems // Elemento a mostrar (canción, versículo, etc.)
  animationType: AnimationType // Tipo de animación a aplicar
  variants: any // Variantes de animación de framer-motion
  textStyle: React.CSSProperties // Estilos CSS para el texto
  isPreview?: boolean // Modo preview (sin animaciones)
  theme: ThemeWithMedia // Tema con configuración de presentación
}

/**
 * Componente para renderizar texto con animaciones en la vista de presentación.
 * Soporta versículos bíblicos con diferentes configuraciones de visualización.
 */
export function AnimatedText({
  item,
  animationType,
  variants,
  textStyle,
  isPreview,
  theme
}: AnimatedTextProps) {
  const { text: rawText, verse } = item
  const { biblePresentationSettings } = useBiblePresentationSetting()
  const { getCompleteNameById, getShortNameById } = useBibleSchema()

  // Determina qué configuración de biblia usar (del tema o la predeterminada)
  const bibleShowSetting = useMemo(
    () =>
      theme.useDefaultBibleSettings ? biblePresentationSettings : theme.biblePresentationSettings!,
    [theme.useDefaultBibleSettings, theme.biblePresentationSettings, biblePresentationSettings]
  )

  // Verifica si el versículo debe mostrarse en la parte superior o inferior de la pantalla
  const isScreenModeVerse = useMemo(
    () =>
      verse &&
      (bibleShowSetting?.position === 'upScreen' || bibleShowSetting?.position === 'downScreen'),
    [verse, bibleShowSetting?.position]
  )

  // Construye el texto de la referencia bíblica (ej: "Juan 3:16 (RVR1960)")
  const verseText = useMemo(() => {
    if (!verse || !biblePresentationSettings) return ''
    const { showVersion, description } = biblePresentationSettings

    const bookName =
      description === 'complete'
        ? getCompleteNameById(verse.bookId)
        : getShortNameById(verse.bookId)

    const versionText = showVersion ? ` (${verse.version})` : ''

    return `${bookName} ${verse.chapter}:${verse.verse}${versionText}`
  }, [verse, biblePresentationSettings, getCompleteNameById, getShortNameById])

  // Construye el texto final combinando el contenido con la referencia bíblica según la configuración
  // Construye el texto final combinando el contenido con la referencia bíblica según la configuración
  const text = useMemo(() => {
    // Solo número de versículo antes del texto
    if (verse && biblePresentationSettings?.showVerseNumber) {
      return `${verse.verse} ${rawText}`
    }

    // Si es modo pantalla (arriba/abajo), no incluir referencia en el texto principal
    if (verse && !isScreenModeVerse && biblePresentationSettings) {
      const position = biblePresentationSettings.position

      // Referencia después del texto
      if (position === 'afterText') {
        return `${rawText} ${verseText}`
      }
      // Referencia antes del texto
      if (position === 'beforeText') {
        return `${verseText} ${rawText}`
      }
      // Referencia debajo del texto
      if (position === 'underText') {
        return `${rawText} <br/> ${verseText}`
      }
      // Referencia encima del texto
      if (position === 'overText') {
        return `${verseText} <br/> ${rawText}`
      }
    }

    return rawText
  }, [rawText, isScreenModeVerse, verse, verseText, biblePresentationSettings])

  /**
   * Renderiza el contenido del texto con o sin animaciones
   * @param textContext - El texto a renderizar
   */
  const content = useCallback(
    (textContext: string) => {
      // Modo preview: sin animaciones
      if (isPreview) {
        return (
          <div style={textStyle} dangerouslySetInnerHTML={{ __html: sanitizeHTML(textContext) }} />
        )
      }

      // Animación palabra por palabra
      if (animationType === 'split') {
        // Dividir por saltos de línea (soporta <br>, <br/>, <br />)
        const lines = textContext.split(/<br\s*\/?>/i)

        return (
          <motion.div
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={textStyle}
          >
            {lines.map((line, lineIndex) => {
              // Dividir cada línea en palabras, eliminando espacios vacíos
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
                  {/* Salto de línea entre líneas (excepto la última) */}
                  {lineIndex < lines.length - 1 && <br />}
                </div>
              )
            })}
          </motion.div>
        )
      }

      // Animación de bloque completo (otras animaciones)
      return (
        <motion.div
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={textStyle}
          dangerouslySetInnerHTML={{ __html: sanitizeHTML(textContext) }}
        />
      )
    },
    [animationType, variants, textStyle, isPreview]
  )

  return (
    <>
      {/* Contenido principal del texto */}
      <div key={text} style={{ position: 'relative', zIndex: 1, width: '100%', padding: '1rem' }}>
        {content(text)}
      </div>

      {/* Referencia bíblica posicionada en pantalla (arriba o abajo) */}
      {isScreenModeVerse && verseText && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: bibleShowSetting?.position === 'downScreen' ? '1rem' : 'auto',
            top: bibleShowSetting?.position === 'upScreen' ? '1rem' : 'auto'
          }}
        >
          {content(verseText)}
        </div>
      )}
    </>
  )
}
