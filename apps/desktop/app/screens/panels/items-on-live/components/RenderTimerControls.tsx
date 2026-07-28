import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useSchedule } from '@/contexts/ScheduleContext'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { formatRemaining, resolveRemainingMs } from '@/lib/time'
import {
  encodeTimerAccessData,
  parseTimerAccessData,
  startTimer,
  type TimerConfig
} from '@/lib/timerAccessData'

// Segundos de gracia tras llegar a 0 para leer el mensaje final antes de auto-ocultar.
const AUTO_HIDE_GRACE_MS = 6000

export const RenderTimerControls = () => {
  const { itemOnLive, setItemOnLive } = useSchedule()

  const cfg = useMemo<TimerConfig | null>(
    () => (itemOnLive?.type === 'TIMER' ? parseTimerAccessData(itemOnLive.accessData) : null),
    [itemOnLive]
  )

  const [now, setNow] = useState(() => Date.now())
  const [customSeconds, setCustomSeconds] = useState(60)

  const updateCfg = (patch: Partial<TimerConfig>) => {
    if (!itemOnLive || !cfg) return
    setItemOnLive({
      ...itemOnLive,
      accessData: encodeTimerAccessData({ ...cfg, ...patch })
    })
  }

  // Arranca el reloj si aún no tiene endsAt (p. ej. presentado desde el cronograma).
  useEffect(() => {
    if (!itemOnLive || itemOnLive.type !== 'TIMER') return
    const current = parseTimerAccessData(itemOnLive.accessData)
    if (current.endsAt == null) {
      setItemOnLive({
        ...itemOnLive,
        accessData: encodeTimerAccessData(startTimer(current, Date.now()))
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemOnLive?.id, itemOnLive?.accessData])

  // Tick local para mostrar el tiempo restante en vivo.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [])

  // Auto-ocultar: al pasar endsAt (+ gracia) limpia el item en vivo.
  useEffect(() => {
    if (!cfg?.autoHide || cfg.endsAt == null) return
    const delay = cfg.endsAt + AUTO_HIDE_GRACE_MS - Date.now()
    if (delay <= 0) {
      setItemOnLive(null)
      return
    }
    const timeout = setTimeout(() => setItemOnLive(null), delay)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.endsAt, cfg?.autoHide])

  if (!cfg) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No hay cuenta atrás en vivo.
      </div>
    )
  }

  const remainingMs = cfg.endsAt != null ? resolveRemainingMs({ endsAt: cfg.endsAt }, now) : cfg.durationSec * 1000
  const isFinished = cfg.endsAt != null && remainingMs <= 0

  const shiftEndsAt = (deltaSec: number) => {
    const base = cfg.endsAt ?? Date.now()
    updateCfg({ endsAt: base + deltaSec * 1000 })
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      <div className="flex flex-col items-center gap-1 rounded-lg border bg-muted/30 py-6">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {isFinished ? 'Finalizado' : 'Tiempo restante'}
        </span>
        <span className="text-5xl font-bold tabular-nums">
          {isFinished ? cfg.endMessage : formatRemaining(Math.max(0, remainingMs))}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" onClick={() => shiftEndsAt(-30)}>
          <Minus className="h-4 w-4 mr-1" />
          30s
        </Button>
        <Button variant="outline" onClick={() => shiftEndsAt(30)}>
          <Plus className="h-4 w-4 mr-1" />
          30s
        </Button>
        <div className="flex items-center gap-1 ml-2">
          <Input
            type="number"
            className="w-20 h-9"
            value={customSeconds}
            onChange={(e) => setCustomSeconds(Number(e.target.value) || 0)}
            aria-label="Segundos personalizados"
          />
          <span className="text-sm text-muted-foreground">s</span>
          <Button variant="outline" onClick={() => shiftEndsAt(customSeconds)}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => shiftEndsAt(-customSeconds)}>
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="timer-title">Texto del temporizador</Label>
        <Input
          id="timer-title"
          value={cfg.title}
          onChange={(e) => updateCfg({ title: e.target.value })}
          placeholder="El servicio comienza en"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="timer-end-message">Mensaje final</Label>
        <Input
          id="timer-end-message"
          value={cfg.endMessage}
          onChange={(e) => updateCfg({ endMessage: e.target.value })}
          placeholder="El servicio va a comenzar"
        />
      </div>
    </div>
  )
}
