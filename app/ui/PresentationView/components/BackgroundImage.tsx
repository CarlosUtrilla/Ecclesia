import { m } from 'framer-motion'

interface BackgroundImageProps {
  url: string
}

export function BackgroundImage({ url }: BackgroundImageProps) {
  return (
    <m.img
      key={`img-${url}`}
      src={url}
      alt="Background"
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
