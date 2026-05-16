import { m, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion'
import { Download, X, RefreshCw } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'
import { useUpdateNotification } from '@/hooks/useUpdateNotification'

export function UpdateNotification() {
  // Solo mostrar en la ventana principal
  const isMainWindow =
    window.location.hash === '#/' || window.location.hash === '' || window.location.hash === '#'

  if (!isMainWindow) return null

  return <UpdateNotificationInner />
}

function UpdateNotificationInner() {
  const { status, version, downloadPercent, dismissed, installNow, dismiss } =
    useUpdateNotification()

  const visible =
    !dismissed && (status === 'available' || status === 'downloading' || status === 'downloaded')

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {visible && (
          <m.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={cn(
              'fixed bottom-5 right-5 z-50',
              'w-80 rounded-xl border border-border/60 bg-card shadow-2xl shadow-black/30',
              'p-4 flex flex-col gap-3'
            )}
            role="status"
            aria-live="polite"
          >
            {/* Cabecera */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <RefreshCw className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">Nueva actualización</p>
                  {version && (
                    <p className="text-xs text-muted-foreground">Versión {version} disponible</p>
                  )}
                </div>
              </div>
              {status !== 'downloading' && (
                <button
                  type="button"
                  aria-label="Descartar notificación"
                  onClick={dismiss}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Progreso de descarga */}
            {status === 'downloading' && (
              <div className="space-y-1.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <m.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: '0%' }}
                    animate={{ width: `${downloadPercent}%` }}
                    transition={{ ease: 'linear', duration: 0.3 }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">{downloadPercent}%</p>
              </div>
            )}

            {/* Mensaje de estado */}
            {status === 'downloading' && (
              <p className="text-xs text-muted-foreground leading-snug">
                Descargando… La aplicación se cerrará para instalar cuando termine.
              </p>
            )}

            {/* Botones */}
            {status === 'available' && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs"
                  onClick={dismiss}
                >
                  Después
                </Button>
                <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={installNow}>
                  <Download className="h-3.5 w-3.5" />
                  Instalar ahora
                </Button>
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  )
}
