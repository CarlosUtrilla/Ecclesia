import { motion } from 'framer-motion'

interface BackgroundVideoLiveProps {
  videoUrl: string
  fallbackUrl: string | null
  onVideoLoaded: () => void
  onVideoError: () => void
  isVideoLoaded: boolean
  hasError: boolean
}

export function BackgroundVideoLive({
  videoUrl,
  fallbackUrl,
  onVideoLoaded,
  onVideoError,
  isVideoLoaded,
  hasError
}: BackgroundVideoLiveProps) {
  return (
    <>
      {/* Imagen de fallback mientras carga el video */}
      {fallbackUrl && !isVideoLoaded && !hasError && (
        <motion.img
          key={`fallback-${fallbackUrl}`}
          src={fallbackUrl}
          alt="Loading video..."
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
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

      {/* Video */}
      {!hasError && (
        <motion.video
          key={`video-${videoUrl}`}
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={onVideoLoaded}
          onError={(e) => {
            console.error('Video error:', e.currentTarget.error)
            onVideoError()
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isVideoLoaded ? 1 : 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
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
    </>
  )
}
