import { scaleLivePx } from '@/lib/liveScale'
import { ContainerSize } from './types'

type StageTimerAlertOverlayProps = {
  active: boolean
  containerSize: ContainerSize
}

/**
 * Borde rojo a pantalla completa con animación de encendido/apagado que alerta
 * al presentador cuando el cronómetro del stage está por llegar a 0.
 *
 * Es puramente visual (`pointer-events-none`) y se dibuja por encima de todo
 * (incluido el modo enfoque). El umbral que lo activa es configurable desde el
 * panel de control (`StageState.timerAlertSeconds`).
 *
 * El grosor del glow se calcula de forma proporcional al tamaño real del
 * contenedor (ver `scaleLivePx`), para que se vea igual de intenso en el preview
 * pequeño y en una pantalla 1920×1080 (nunca px fijos).
 */
export function StageTimerAlertOverlay({ active, containerSize }: StageTimerAlertOverlayProps) {
  if (!active) return null

  const glowBlurPx = scaleLivePx(120, containerSize.height)
  const glowSpreadPx = scaleLivePx(4, containerSize.height)

  return (
    <div className="pointer-events-none absolute inset-0 z-[60]" aria-hidden>
      <style>{`
        @keyframes stageTimerAlertBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      <div
        className="absolute inset-0"
        style={{
          animation: 'stageTimerAlertBlink 1.5s ease-in-out infinite',
          // Un único glow rojo denso en el borde que se difumina de forma
          // continua hacia el centro (sin un borde sólido separado del shadow),
          // más una viñeta radial sutil para dar algo de profundidad. El blur y
          // el spread son proporcionales al contenedor; el gradiente radial ya
          // usa porcentajes, por lo que escala solo.
          boxShadow: `inset 0 0 ${glowBlurPx}px ${glowSpreadPx}px rgba(220,38,38,0.8)`,
          background:
            'radial-gradient(150% 150% at 50% 50%, rgba(220,38,38,0) 62%, rgba(220,38,38,0.2) 100%)'
        }}
      />
    </div>
  )
}
