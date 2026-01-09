import { motion } from 'framer-motion'

interface BackgroundVideoThumbnailProps {
  thumbnailUrl: string
}

export function BackgroundVideoThumbnail({ thumbnailUrl }: BackgroundVideoThumbnailProps) {
  return (
    <motion.img
      key={`thumbnail-${thumbnailUrl}`}
      src={thumbnailUrl}
      alt="Video thumbnail"
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
  )
}
