import { m } from 'framer-motion'

interface BackgroundImageProps {
  url: string
  blur?: number
}

export function BackgroundImage({ url, blur = 0 }: BackgroundImageProps) {
  const hasBlur = blur > 0

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
