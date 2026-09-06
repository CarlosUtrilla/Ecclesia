interface BackgroundVideoLiveProps {
  videoUrl: string
  fallbackUrl: string | null
  shouldLoop: boolean
  onVideoLoaded: () => void
  onVideoError: () => void
  isVideoLoaded: boolean
  hasError: boolean
  blur?: number
}

/**
 * Fondo de video en `live`. Ni el fallback ni el video se desvanecen por su
 * cuenta: el cross lo hace la capa de tema que los envuelve
 * (`LiveThemeTransitionShell`). Con fades propios anidados la capa entrante
 * tardaba medio segundo en pintar su fondo y, mientras, el cross mostraba el
 * negro del frame.
 *
 * El fallback va debajo a opacidad plena desde el primer frame para que nunca
 * haya un hueco mientras el video carga; el video lo tapa en cuanto esta listo.
 */
export function BackgroundVideoLive({
  videoUrl,
  fallbackUrl,
  shouldLoop,
  onVideoLoaded,
  onVideoError,
  isVideoLoaded,
  hasError,
  blur = 0
}: BackgroundVideoLiveProps) {
  const hasBlur = blur > 0
  const layerStyle: React.CSSProperties = {
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
  }

  return (
    <>
      {/* Imagen de fallback mientras carga el video */}
      {fallbackUrl && (
        <img key={`fallback-${fallbackUrl}`} src={fallbackUrl} alt="" style={layerStyle} />
      )}

      {/* Video */}
      {!hasError && (
        <video
          key={`video-${videoUrl}`}
          src={videoUrl}
          autoPlay
          loop={shouldLoop}
          muted
          playsInline
          onLoadedData={onVideoLoaded}
          onError={(e) => {
            console.error('Video error:', e.currentTarget.error)
            onVideoError()
          }}
          style={{ ...layerStyle, opacity: isVideoLoaded ? 1 : 0 }}
        />
      )}
    </>
  )
}
