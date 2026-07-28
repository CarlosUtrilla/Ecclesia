import { useMemo, useRef, useState } from 'react'
import { MonitorPlay, CalendarPlus } from 'lucide-react'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { BlankTheme, useThemes } from '@/hooks/useThemes'
import { generateUniqueId } from '@/lib/utils'
import { ColorPicker } from '@/ui/colorPicker'
import { PresentationView } from '@/ui/PresentationView'
import type { PresentationViewItems, ThemeWithMedia } from '@/ui/PresentationView/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Switch } from '@/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import {
  computeClockEndsAt,
  DEFAULT_TIMER_CONFIG,
  encodeTimerAccessData,
  parseTimerAccessData,
  startTimer,
  type TimerConfig,
  type TimerMode
} from '@/lib/timerAccessData'
import type { ScheduleItem } from '@ecclesia/api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Si se provee, el diálogo funciona en modo edición de ese item del cronograma.
  editItem?: ScheduleItem | null
}

const CURRENT_THEME_VALUE = 'current'

function resolveThemeTextColor(theme: ThemeWithMedia | undefined): string {
  const textStyle = theme?.textStyle
  if (!textStyle) return '#ffffff'
  if (typeof textStyle === 'string') {
    try {
      return (JSON.parse(textStyle) as { color?: string }).color || '#ffffff'
    } catch {
      return '#ffffff'
    }
  }
  return (textStyle as { color?: string }).color || '#ffffff'
}

export default function ChurchCountdownDialog({ open, onOpenChange, editItem }: Props) {
  const { addItemToSchedule, updateItemAccessData } = useSchedule()
  const { showItemOnLiveScreen } = useLive()
  const { themes } = useThemes()
  const isEditing = !!editItem

  const [mode, setMode] = useState<TimerMode>('duration')
  const [minutes, setMinutes] = useState(15)
  const [seconds, setSeconds] = useState(0)
  const [startClock, setStartClock] = useState('11:00')
  const [title, setTitle] = useState(DEFAULT_TIMER_CONFIG.title)
  const [endMessage, setEndMessage] = useState(DEFAULT_TIMER_CONFIG.endMessage)
  const [themeId, setThemeId] = useState<number | null>(null)
  const [autoHide, setAutoHide] = useState(true)
  const [customizeColors, setCustomizeColors] = useState(false)
  const [textColor, setTextColor] = useState('#ffffff')
  const [ringColor, setRingColor] = useState('#ffffff')

  const themeFallbackColor = useMemo(
    () => resolveThemeTextColor(themes.find((theme) => theme.id === themeId) ?? themes[0]),
    [themes, themeId]
  )

  const applyConfig = (cfg: TimerConfig) => {
    setMode(cfg.mode)
    setMinutes(Math.floor(cfg.durationSec / 60))
    setSeconds(cfg.durationSec % 60)
    setStartClock(cfg.startClock ?? '11:00')
    setTitle(cfg.title)
    setEndMessage(cfg.endMessage)
    setThemeId(cfg.themeId)
    setAutoHide(cfg.autoHide)
    const hasCustomColors = cfg.textColor != null || cfg.ringColor != null
    setCustomizeColors(hasCustomColors)
    setTextColor(cfg.textColor ?? '#ffffff')
    setRingColor(cfg.ringColor ?? '#ffffff')
  }

  const handleToggleColors = (next: boolean) => {
    if (next) {
      setTextColor(themeFallbackColor)
      setRingColor(themeFallbackColor)
    }
    setCustomizeColors(next)
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
  }

  // Precarga la config al abrir (render-time reset): Radix no dispara onOpenChange
  // cuando `open` se controla por estado externo (menú / botón "Editar").
  const prevOpenRef = useRef(false)
  if (open && !prevOpenRef.current) {
    prevOpenRef.current = true
    applyConfig(editItem ? parseTimerAccessData(editItem.accessData) : DEFAULT_TIMER_CONFIG)
  } else if (!open && prevOpenRef.current) {
    prevOpenRef.current = false
  }

  const buildConfig = (): TimerConfig => ({
    ...DEFAULT_TIMER_CONFIG,
    mode,
    durationSec: Math.max(0, minutes) * 60 + Math.max(0, seconds),
    startClock: mode === 'clock' ? startClock : null,
    title,
    endMessage,
    themeId,
    textColor: customizeColors ? textColor : null,
    ringColor: customizeColors ? ringColor : null,
    autoHide,
    endsAt: null
  })

  const previewTheme = useMemo<ThemeWithMedia>(
    () => themes.find((theme) => theme.id === themeId) ?? themes[0] ?? BlankTheme,
    [themes, themeId]
  )

  // Preview estático: anillo lleno mostrando el tiempo configurado, sin contar
  // (endsAt = null → TimerRender renderiza el estado "sin iniciar").
  const previewItem = useMemo<PresentationViewItems>(() => {
    const durationSec =
      mode === 'clock' && startClock
        ? Math.max(0, Math.round((computeClockEndsAt(startClock, Date.now()) - Date.now()) / 1000))
        : Math.max(0, minutes) * 60 + Math.max(0, seconds)
    return {
      resourceType: 'TIMER',
      text: '',
      timer: { ...buildConfig(), durationSec, endsAt: null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, minutes, seconds, startClock, title, endMessage, customizeColors, textColor, ringColor, themeId, autoHide])

  const handleAddToSchedule = () => {
    addItemToSchedule({ type: 'TIMER', accessData: encodeTimerAccessData(buildConfig()) })
    onOpenChange(false)
  }

  const handleSaveEdit = () => {
    if (!editItem) return
    updateItemAccessData(editItem.id, encodeTimerAccessData(buildConfig()))
    onOpenChange(false)
  }

  const handlePresentLive = () => {
    const started = startTimer(buildConfig(), Date.now())
    const item: ScheduleItem = {
      id: generateUniqueId(),
      type: 'TIMER',
      accessData: encodeTimerAccessData(started),
      order: -1,
      scheduleId: -1,
      updatedAt: new Date(),
      deletedAt: null
    }
    showItemOnLiveScreen(item, 0)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar cuenta atrás' : 'Cuenta atrás de servicio'}</DialogTitle>
          <DialogDescription>
            Configura un temporizador para mostrar en la pantalla en vivo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0 overflow-y-auto md:overflow-visible py-1">
          {/* Preview: arriba en móvil, a la derecha en pantallas anchas */}
          <div className="md:order-2 md:flex-1 md:min-w-0 flex items-center justify-center">
            <div className="w-full max-h-[85vh] overflow-hidden rounded-md border">
              <PresentationView
                className="w-full"
                theme={previewTheme}
                items={[previewItem]}
                customAspectRatio="16 / 9"
              />
            </div>
          </div>

          {/* Formulario: ancho fijo con scroll interno en pantallas anchas */}
          <div className="md:order-1 md:w-80 md:shrink-0 flex flex-col gap-4 md:min-h-0 md:overflow-y-auto md:pr-1">
          <div className="flex flex-col gap-2">
            <Label>Modo</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === 'duration' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setMode('duration')}
              >
                Duración
              </Button>
              <Button
                type="button"
                variant={mode === 'clock' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setMode('clock')}
              >
                Hora fija
              </Button>
            </div>
          </div>

          {mode === 'duration' ? (
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-2 flex-1">
                <Label htmlFor="timer-minutes">Minutos</Label>
                <Input
                  id="timer-minutes"
                  type="number"
                  min={0}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <Label htmlFor="timer-seconds">Segundos</Label>
                <Input
                  id="timer-seconds"
                  type="number"
                  min={0}
                  max={59}
                  value={seconds}
                  onChange={(e) => setSeconds(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="timer-clock">Hora de inicio</Label>
              <Input
                id="timer-clock"
                type="time"
                value={startClock}
                onChange={(e) => setStartClock(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="timer-dialog-title">Título</Label>
            <Input
              id="timer-dialog-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="El servicio comienza en"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="timer-dialog-end">Mensaje final</Label>
            <Input
              id="timer-dialog-end"
              value={endMessage}
              onChange={(e) => setEndMessage(e.target.value)}
              placeholder="El servicio va a comenzar"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Tema</Label>
            <Select
              value={themeId != null ? String(themeId) : CURRENT_THEME_VALUE}
              onValueChange={(value) =>
                setThemeId(value === CURRENT_THEME_VALUE ? null : Number(value))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CURRENT_THEME_VALUE}>Usar tema actual</SelectItem>
                {themes.map((theme) => (
                  <SelectItem key={theme.id} value={String(theme.id)}>
                    {theme.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="timer-autohide">Auto-ocultar al finalizar</Label>
            <Switch id="timer-autohide" checked={autoHide} onCheckedChange={setAutoHide} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="timer-customize-colors">Personalizar colores</Label>
            <Switch
              id="timer-customize-colors"
              checked={customizeColors}
              onCheckedChange={handleToggleColors}
            />
          </div>

          {customizeColors ? (
            <div className="flex items-center gap-6 pl-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Texto</span>
                <ColorPicker value={textColor} onChange={setTextColor} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Círculo</span>
                <ColorPicker value={ringColor} onChange={setRingColor} />
              </div>
            </div>
          ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {isEditing ? (
            <Button variant="outline" onClick={handleSaveEdit}>
              <CalendarPlus className="h-4 w-4 mr-1" />
              Guardar cambios
            </Button>
          ) : (
            <Button variant="outline" onClick={handleAddToSchedule}>
              <CalendarPlus className="h-4 w-4 mr-1" />
              Añadir al cronograma
            </Button>
          )}
          <Button onClick={handlePresentLive}>
            <MonitorPlay className="h-4 w-4 mr-1" />
            Presentar en vivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
