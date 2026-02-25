import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Radio } from 'lucide-react'
import LiveScreen from '@/screens/live-screen'

export default function LiveScreens() {
  const { showLiveScreen, setShowLiveScreen, liveScreens, contentScreen } = useLive()

  return (
    <div>
      <div className="bg-muted/50 border-b py-2 px-4 flex justify-between items-center">
        <span>Pantallas en vivo</span>
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
            Pantalla pública
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.displayAPI.showNewDisplayConnected()}
          >
            Gestionar pantallas
          </Button>
        </div>
      </div>
      <div>
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
    </div>
  )
}
