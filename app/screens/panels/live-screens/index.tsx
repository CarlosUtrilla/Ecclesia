import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Radio } from 'lucide-react'
import LiveScreen from '@/screens/live-screen'

export default function LiveScreens() {
  const {
    showLiveScreen,
    setShowLiveScreen,
    liveScreens,
    contentScreen,
    hideTextOnLive,
    showLogoOnLive,
    blackScreenOnLive,
    setHideTextOnLive,
    setShowLogoOnLive,
    setBlackScreenOnLive
  } = useLive()

  return (
    <div className="flex flex-col h-full">
      <div className="bg-muted/50 border-b py-2 px-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            onClick={() => setShowLiveScreen(!showLiveScreen)}
            variant={showLiveScreen ? 'default' : 'outline'}
            size="sm"
          >
            <Radio
              className={cn('size-5', {
                'animate-pulse': showLiveScreen
              })}
            />{' '}
            En Vivo (F7)
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => window.displayAPI.showNewDisplayConnected()}
          >
            Gestionar pantallas
          </Button>
        </div>
      </div>
      <div className="flex-1">
        <div className="p-2 bg-muted/40">Pantallas publicas</div>
        <div className="flex gap-2 p-2">
          {contentScreen ? (
            liveScreens.map((screen, idx) => (
              <LiveScreen key={`screen-${(screen as any)?.id ?? idx}`} isPreview />
            ))
          ) : (
            <div>No hay contenido para mostrar</div>
          )}
        </div>
      </div>
      <div className="p-1 grid grid-cols-3 gap-1 bg-muted/40 border-t">
        <button
          type="button"
          aria-pressed={hideTextOnLive}
          onClick={() => setHideTextOnLive(!hideTextOnLive)}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none transition-colors hover:brightness-95',
            hideTextOnLive
              ? 'border-amber-500/70 bg-amber-500/15 text-amber-700'
              : 'border-border/80 bg-background/80 text-muted-foreground'
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              hideTextOnLive
                ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                : 'bg-muted-foreground/40'
            )}
          />
          F9 Texto {hideTextOnLive ? 'OFF' : 'ON'}
        </button>
        <button
          type="button"
          aria-pressed={showLogoOnLive}
          onClick={() => {
            const next = !showLogoOnLive
            setShowLogoOnLive(next)
            if (next) {
              setBlackScreenOnLive(false)
            }
          }}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none transition-colors hover:brightness-95',
            showLogoOnLive
              ? 'border-sky-500/70 bg-sky-500/15 text-sky-700'
              : 'border-border/80 bg-background/80 text-muted-foreground'
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              showLogoOnLive
                ? 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)]'
                : 'bg-muted-foreground/40'
            )}
          />
          F10 Logo {showLogoOnLive ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          aria-pressed={blackScreenOnLive}
          onClick={() => {
            const next = !blackScreenOnLive
            setBlackScreenOnLive(next)
            if (next) {
              setShowLogoOnLive(false)
            }
          }}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none transition-colors hover:brightness-95',
            blackScreenOnLive
              ? 'border-rose-500/70 bg-rose-500/15 text-rose-700'
              : 'border-border/80 bg-background/80 text-muted-foreground'
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              blackScreenOnLive
                ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                : 'bg-muted-foreground/40'
            )}
          />
          F11 Negro {blackScreenOnLive ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  )
}
