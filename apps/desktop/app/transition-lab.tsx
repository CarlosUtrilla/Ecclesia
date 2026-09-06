/**
 * Laboratorio de transiciones (solo dev, no entra en el bundle de la app).
 *
 * Sirve para ver y medir lo que los tests en jsdom no pueden: framer-motion 12
 * anima por WAAPI y jsdom no lo implementa, asi que la opacidad real de cada
 * capa solo se puede observar en un navegador de verdad.
 *
 *   http://localhost:5173/transition-lab.html
 *
 * El fondo de la pagina es magenta a proposito:
 *   - magenta visible -> hueco de geometria (una capa no cubre)
 *   - negro visible   -> algun elemento esta pintando negro
 *   - color apagado   -> bajon de opacidad (las dos capas translucidas a la vez)
 */
import './assets/globals.css'

import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LiveThemeTransitionShell } from './ui/PresentationView/components/LiveThemeTransitionShell'
import { BackgroundImage } from './ui/PresentationView/components/BackgroundImage'
import { BackgroundVideoLive } from './ui/PresentationView/components/BackgroundVideoLive'
import { usePresentationBackground } from './ui/PresentationView/hooks/usePresentationBackground'
import { ThemeWithMedia } from './ui/PresentationView/types'

document.documentElement.classList.add('dark')

// ?dur=5 para alargar la transicion y poder capturarla a medio camino.
const DURATION = Number(new URLSearchParams(location.search).get('dur') ?? 0.6)
const FADE = JSON.stringify({ type: 'fade', duration: DURATION, delay: 0, easing: 'linear' })

// SVG inline: carga instantanea, asi cualquier retardo que se mida viene de las
// animaciones del codigo, no de la red.
const IMAGE_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#0044ff"/></svg>'
  )

/** Tema con fondo de imagen, como los que usa el usuario. */
const IMAGE_THEME = {
  id: 7,
  name: 'Tema imagen',
  background: 'media',
  backgroundMedia: { id: 1, type: 'IMAGE', filePath: IMAGE_URL },
  transitionSettings: FADE
} as unknown as ThemeWithMedia

const NEUTRAL_THEME = {
  id: -2,
  name: 'Neutro',
  background: '#000000',
  transitionSettings: FADE
} as unknown as ThemeWithMedia

/** Replica de MediaRender: contenedor bg-black a sangre con el video/imagen. */
function MediaLayer() {
  return (
    <div
      data-lab-layer="media"
      className="bg-black w-full h-full flex items-center justify-center absolute inset-0"
    >
      <div style={{ width: '100%', height: '100%', background: '#00ff66' }} />
    </div>
  )
}

/** Replica de PresentationFrame + backgroundLayer de PresentationBody. */
function ThemeLayer({ theme }: { theme: ThemeWithMedia }) {
  const {
    background,
    backgroundType,
    backgroundUrl,
    fallbackUrl,
    videoLoaded,
    videoError,
    setVideoLoaded,
    setVideoError
  } = usePresentationBackground({ theme, buildMediaUrl: (path: string) => path })

  return (
    <div
      data-lab-layer="theme"
      className="bg-background relative select-none"
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background:
          (backgroundType === 'color' || backgroundType === 'gradient') && background !== 'media'
            ? background
            : 'transparent'
      }}
    >
      {backgroundType === 'image' && backgroundUrl ? (
        <BackgroundImage url={backgroundUrl} blur={0} />
      ) : null}

      {backgroundType === 'video' ? (
        <BackgroundVideoLive
          videoUrl={backgroundUrl}
          fallbackUrl={fallbackUrl}
          shouldLoop
          isVideoLoaded={videoLoaded}
          hasError={videoError}
          onVideoLoaded={() => setVideoLoaded(true)}
          onVideoError={() => setVideoError(true)}
          blur={0}
        />
      ) : null}

      <span style={{ color: 'white', fontSize: 48, position: 'relative', zIndex: 1 }}>TEMA</span>
    </div>
  )
}

function Lab() {
  const [showTheme, setShowTheme] = useState(false)

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div className="relative w-full h-full overflow-hidden">
        <LiveThemeTransitionShell
          themeTransitionRaw={FADE}
          themeTransitionKey={showTheme ? 'theme' : 'media'}
        >
          {showTheme ? <ThemeLayer theme={IMAGE_THEME} /> : <MediaLayer />}
        </LiveThemeTransitionShell>
      </div>

      <button
        id="lab-toggle"
        onClick={() => setShowTheme((prev) => !prev)}
        style={{ position: 'fixed', bottom: 8, left: 8, zIndex: 999 }}
      >
        toggle
      </button>
      <span id="lab-state" data-showing={showTheme ? 'theme' : 'media'} />
    </div>
  )
}

void NEUTRAL_THEME

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Lab />
  </StrictMode>
)
