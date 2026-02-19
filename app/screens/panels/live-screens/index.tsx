import { PresentationView } from '@/ui/PresentationView'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Radio } from 'lucide-react'

export default function LiveScreens() {
  const { selectedTheme } = useSchedule()
  const { showLiveScreen, setShowLiveScreen, liveScreens, contentScreen, itemIndex } = useLive()

  return (
    <div>
      <div className="bg-muted/50 border-b py-2 px-4 flex justify-between items-center">
        <span>Pantallas en vivo</span>
        <div>
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
        </div>
      </div>
      <div>
        <div className="p-2 bg-muted/40">Pantallas publicas</div>
        <div className="flex gap-2 p-2">
          {contentScreen ? (
            liveScreens.map((screen, idx) => (
              <PresentationView
                key={`screen-${(screen as any)?.id ?? idx}`}
                items={contentScreen.content}
                theme={selectedTheme}
                currentIndex={itemIndex}
                live
              />
            ))
          ) : (
            <div>No hay contenido para mostrar</div>
          )}
        </div>
      </div>
    </div>
  )
}
