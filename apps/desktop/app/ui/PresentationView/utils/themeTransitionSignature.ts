import { ThemeWithMedia } from '../types'

/**
 * Firma visual de un tema: solo cambia cuando cambia algo que se ve en pantalla
 * (identidad del tema, color/gradiente de fondo o media de fondo). Se usa como
 * clave de `AnimatePresence` para disparar la transicion cruzada entre temas,
 * de modo que reenviar el mismo tema no reinicie la animacion.
 */
export const getThemeTransitionSignature = (theme?: ThemeWithMedia): string => {
  const backgroundMedia = theme?.backgroundMedia

  return [
    theme?.id ?? 'no-theme-id',
    theme?.background ?? 'no-background',
    backgroundMedia?.type ?? 'no-media-type',
    backgroundMedia?.filePath ?? 'no-media-file',
    backgroundMedia?.thumbnail ?? 'no-thumbnail',
    backgroundMedia?.fallback ?? 'no-fallback'
  ].join('|')
}
