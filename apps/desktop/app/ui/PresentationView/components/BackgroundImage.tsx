interface BackgroundImageProps {
  url: string
  blur?: number
}

/**
 * Fondo de imagen en `live`. Se pinta a opacidad plena desde el primer frame:
 * el desvanecido lo hace la capa de tema que envuelve a este componente
 * (`LiveThemeTransitionShell`). Con un fade propio anidado, la capa entrante
 * de un cross aparecia vacia durante medio segundo y se veia el fondo negro.
 */
export function BackgroundImage({ url, blur = 0 }: BackgroundImageProps) {
  const hasBlur = blur > 0

  return (
    <img
      key={`img-${url}`}
      src={url}
      alt="Background"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: 0,
        ...(hasBlur
          ? {
              filter: `blur(${blur}px)`,
              transform: 'scale(1.06)',
              transformOrigin: 'center'
            }
          : {})
      }}
    />
  )
}
