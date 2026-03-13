import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FocusIcon, Plus, TimerReset, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Input } from '@/ui/input'
import { Textarea } from '@/ui/textarea'
import { Button } from '@/ui/button'
import { Switch } from '@/ui/switch'
import StageScreen from '@/screens/stage-screen'

type StageScreenRecord = {
  id: number
  screenId: number
  screenName: string
  rol: 'LIVE_SCREEN' | 'STAGE_SCREEN' | null
}

type StageTimerState = {
  id: string
  label: string
  endsAt: number
}

type StageState = {
  message?: string | null
  timers?: StageTimerState[]
  timerVisualMode?: 'compact' | 'broadcast'
  clock?: {
    hourFormat?: '12' | '24'
    showMeridiem?: boolean
  }
  focusMode?: boolean
}

type StageConfigRecord = {
  selectedScreenId: number
  state: string
}

const EMPTY_STAGE_STATE: StageState = {
  message: null,
  timers: [],
  timerVisualMode: 'broadcast',
  clock: {
    hourFormat: '24',
    showMeridiem: false
  },
  focusMode: false
}

const MAX_STAGE_TIMERS = 5
const TIMER_PRESET_MINUTES = [1, 2, 5, 10, 15, 20, 30, 45, 60]

function formatRemaining(remainingMs: number): string {
  const isNegative = remainingMs < 0
  const absRemainingMs = Math.abs(remainingMs)
  const totalSeconds = Math.floor(absRemainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const sign = isNegative ? '-' : ''

  if (hours > 0) {
    return `${sign}${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return `${sign}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function safeParseState(raw: string | undefined): StageState {
  if (!raw) return EMPTY_STAGE_STATE
  try {
    const parsed = JSON.parse(raw) as StageState
    return {
      message: parsed.message ?? null,
      timers: Array.isArray(parsed.timers) ? parsed.timers.slice(0, MAX_STAGE_TIMERS) : [],
      timerVisualMode: parsed.timerVisualMode === 'compact' ? 'compact' : 'broadcast',
      clock: {
        hourFormat: parsed.clock?.hourFormat === '12' ? '12' : '24',
        showMeridiem: Boolean(parsed.clock?.showMeridiem)
      },
      focusMode: Boolean(parsed.focusMode)
    }
  } catch {
    return EMPTY_STAGE_STATE
  }
}

export default function StageControlsPanel() {
  const queryClient = useQueryClient()

  const [selectedScreenId, setSelectedScreenId] = useState<number | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [timerLabelInput, setTimerLabelInput] = useState('')
  const [timerHoursInput, setTimerHoursInput] = useState('0')
  const [timerMinutesInput, setTimerMinutesInput] = useState('5')
  const [timerSecondsInput, setTimerSecondsInput] = useState('0')
  const [nowMs, setNowMs] = useState(() => Date.now())

  const { data: stageScreens = [] } = useQuery<StageScreenRecord[]>({
    queryKey: ['selectedScreens', 'stage'],
    queryFn: () => window.api.selectedScreens.getSelectedScreensByRole('STAGE_SCREEN')
  })

  const { data: stageConfigs = [] } = useQuery<StageConfigRecord[]>({
    queryKey: ['stageScreenConfig'],
    queryFn: () => window.api.stageScreenConfig.getAllStageScreenConfigs(),
    staleTime: Infinity
  })

  useEffect(() => {
    if (selectedScreenId !== null) return
    if (stageScreens.length === 0) return

    const firstScreenId = stageScreens[0].id
    setSelectedScreenId(firstScreenId)
    const firstState = safeParseState(
      stageConfigs.find((item) => item.selectedScreenId === firstScreenId)?.state
    )
    setMessageInput(firstState.message ?? '')
  }, [selectedScreenId, stageScreens, stageConfigs])

  const configByScreenId = useMemo(() => {
    return new Map(stageConfigs.map((config) => [config.selectedScreenId, config]))
  }, [stageConfigs])

  const selectedState = useMemo(() => {
    if (selectedScreenId === null) return EMPTY_STAGE_STATE
    const currentConfig = configByScreenId.get(selectedScreenId)
    return safeParseState(currentConfig?.state)
  }, [configByScreenId, selectedScreenId])

  const timers = selectedState.timers ?? []
  const selectedTimerVisualMode = selectedState.timerVisualMode ?? 'broadcast'
  const selectedClock = selectedState.clock ?? EMPTY_STAGE_STATE.clock!

  useEffect(() => {
    if (timers.length === 0) return

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [timers.length])

  const { mutate: persistState, isPending } = useMutation({
    mutationFn: (payload: { selectedScreenId: number; state: StageState }) =>
      window.api.stageScreenConfig.upsertStageScreenConfig({
        selectedScreenId: payload.selectedScreenId,
        state: JSON.stringify(payload.state)
      }),
    onSuccess: async (updatedConfig) => {
      await queryClient.invalidateQueries({ queryKey: ['stageScreenConfig'] })
      await window.displayAPI.updateStageScreenConfig({
        selectedScreenId: updatedConfig.selectedScreenId
      })
    }
  })

  const handleSaveMessage = () => {
    if (selectedScreenId === null) return

    persistState({
      selectedScreenId,
      state: {
        ...selectedState,
        message: messageInput.trim() || null
      }
    })
  }

  const handleClearMessage = () => {
    if (selectedScreenId === null) return

    setMessageInput('')
    persistState({
      selectedScreenId,
      state: {
        ...selectedState,
        message: null
      }
    })
  }

  const handleAddTimer = () => {
    if (selectedScreenId === null) return
    if (timers.length >= MAX_STAGE_TIMERS) return

    const hours = Number(timerHoursInput)
    const minutes = Number(timerMinutesInput)
    const seconds = Number(timerSecondsInput)

    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return
    }

    if (hours < 0 || minutes < 0 || seconds < 0) return

    const totalSeconds = Math.floor(hours) * 3600 + Math.floor(minutes) * 60 + Math.floor(seconds)
    if (totalSeconds <= 0) return

    const now = Date.now()
    const timer: StageTimerState = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      label: timerLabelInput.trim() || `Timer ${timers.length + 1}`,
      endsAt: now + totalSeconds * 1000
    }

    persistState({
      selectedScreenId,
      state: {
        ...selectedState,
        timers: [...timers, timer]
      }
    })

    setTimerLabelInput('')
    setTimerHoursInput('0')
    setTimerMinutesInput('5')
    setTimerSecondsInput('0')
  }

  const handleApplyTimerPreset = (totalMinutes: number) => {
    const normalizedMinutes = Math.max(1, Math.floor(totalMinutes))
    const hours = Math.floor(normalizedMinutes / 60)
    const minutes = normalizedMinutes % 60

    setTimerHoursInput(String(hours))
    setTimerMinutesInput(String(minutes))
    setTimerSecondsInput('0')
  }

  const handleFocusModeToggle = (enabled: boolean) => {
    if (selectedScreenId === null) return
    persistState({
      selectedScreenId,
      state: { ...selectedState, focusMode: enabled }
    })
  }

  const handleTimerVisualModeChange = (mode: 'compact' | 'broadcast') => {
    if (selectedScreenId === null) return

    persistState({
      selectedScreenId,
      state: {
        ...selectedState,
        timerVisualMode: mode
      }
    })
  }

  const handleClockConfigChange = (next: { hourFormat?: '12' | '24'; showMeridiem?: boolean }) => {
    if (selectedScreenId === null) return

    persistState({
      selectedScreenId,
      state: {
        ...selectedState,
        clock: {
          hourFormat: next.hourFormat ?? selectedClock.hourFormat ?? '24',
          showMeridiem: next.showMeridiem ?? selectedClock.showMeridiem ?? false
        }
      }
    })
  }

  const handleRemoveTimer = (timerId: string) => {
    if (selectedScreenId === null) return

    persistState({
      selectedScreenId,
      state: {
        ...selectedState,
        timers: timers.filter((timer) => timer.id !== timerId)
      }
    })
  }

  const handleClearTimers = () => {
    if (selectedScreenId === null) return

    persistState({
      selectedScreenId,
      state: {
        ...selectedState,
        timers: []
      }
    })
  }

  const selectedScreen =
    selectedScreenId !== null ? stageScreens.find((screen) => screen.id === selectedScreenId) : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Control Stage</CardTitle>
        <CardDescription>
          Mensajes persistentes y timers para pantallas de escenario en tiempo real.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {stageScreens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay pantallas stage configuradas.</p>
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2">
              <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Pantalla stage</label>
                  <Select
                    value={selectedScreenId !== null ? String(selectedScreenId) : undefined}
                    onValueChange={(value) => {
                      const nextId = Number(value)
                      setSelectedScreenId(nextId)
                      const state = safeParseState(configByScreenId.get(nextId)?.state)
                      setMessageInput(state.message ?? '')
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar pantalla stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {stageScreens.map((screen) => (
                        <SelectItem key={screen.id} value={String(screen.id)}>
                          {screen.screenName} ({screen.screenId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-sm font-medium">Mensaje de escenario</div>
                <p className="text-xs text-muted-foreground">
                  Pantalla seleccionada: {selectedScreen?.screenName ?? 'Ninguna'}
                </p>

                <Textarea
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  placeholder="Mensaje para escenario"
                  disabled={isPending}
                  rows={4}
                  className="resize-y"
                />

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveMessage}
                    disabled={isPending || !selectedScreenId}
                  >
                    Guardar mensaje
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearMessage}
                    disabled={isPending || !selectedScreenId}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border bg-muted/10 p-2">
                <div className="px-1">
                  <div className="text-sm font-medium">Preview Stage</div>
                  <p className="text-xs text-muted-foreground">Vista rápida de la salida stage.</p>
                </div>

                <div className="overflow-hidden rounded-md border bg-black">
                  <div className="aspect-video w-full">
                    {selectedScreen ? (
                      <StageScreen isPreview previewDisplayId={selectedScreen.screenId} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        Selecciona una pantalla stage para ver preview.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="text-sm font-medium">Cronómetros</div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Estilo visual</label>
                <Select
                  value={selectedTimerVisualMode}
                  onValueChange={(value: 'compact' | 'broadcast') =>
                    handleTimerVisualModeChange(value)
                  }
                  disabled={isPending || !selectedScreenId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estilo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="broadcast">Broadcast (grande)</SelectItem>
                    <SelectItem value="compact">Compacto (limpio)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Presets rápidos</label>
                <div className="flex flex-wrap gap-1.5">
                  {TIMER_PRESET_MINUTES.map((presetMinutes) => (
                    <Button
                      key={presetMinutes}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending || !selectedScreenId}
                      onClick={() => handleApplyTimerPreset(presetMinutes)}
                      className="h-7 px-2 text-xs"
                    >
                      {presetMinutes} min
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_90px_90px_90px_auto]">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Etiqueta</label>
                  <Input
                    value={timerLabelInput}
                    onChange={(event) => setTimerLabelInput(event.target.value)}
                    placeholder="Etiqueta (opcional)"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Horas</label>
                  <Input
                    value={timerHoursInput}
                    onChange={(event) => setTimerHoursInput(event.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Minutos</label>
                  <Input
                    value={timerMinutesInput}
                    onChange={(event) => setTimerMinutesInput(event.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Segundos</label>
                  <Input
                    value={timerSecondsInput}
                    onChange={(event) => setTimerSecondsInput(event.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    disabled={isPending}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAddTimer}
                  disabled={isPending || !selectedScreenId || timers.length >= MAX_STAGE_TIMERS}
                  className="self-end"
                >
                  <Plus className="size-4" />
                  Agregar
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Máximo {MAX_STAGE_TIMERS} timers visibles en stage. Activos: {timers.length}.
              </p>

              {timers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay timers activos.</p>
              ) : (
                <div className="space-y-2">
                  {timers.map((timer) => (
                    <div
                      key={timer.id}
                      className="flex items-center justify-between rounded-md border px-2 py-1.5"
                    >
                      <div className="min-w-0 text-sm">
                        <span className="font-medium">{timer.label}</span>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatRemaining(timer.endsAt - nowMs)}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => handleRemoveTimer(timer.id)}
                        disabled={isPending || !selectedScreenId}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearTimers}
                    disabled={isPending || !selectedScreenId}
                    className="w-full"
                  >
                    <TimerReset className="size-4" />
                    Limpiar timers
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <FocusIcon className="size-3.5 text-muted-foreground" />
                    Modo enfoque
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Muestra reloj y timers a pantalla completa en el escenario.
                  </p>
                </div>
                <Switch
                  id="focus-mode-switch"
                  checked={selectedState.focusMode ?? false}
                  onCheckedChange={handleFocusModeToggle}
                  disabled={isPending || !selectedScreenId}
                />
              </div>
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="text-sm font-medium">Formato de hora</div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Select
                  value={selectedClock.hourFormat ?? '24'}
                  onValueChange={(value: '12' | '24') => {
                    const forceMeridiem = value === '12' ? selectedClock.showMeridiem : false
                    handleClockConfigChange({
                      hourFormat: value,
                      showMeridiem: forceMeridiem
                    })
                  }}
                  disabled={isPending || !selectedScreenId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Formato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 horas</SelectItem>
                    <SelectItem value="12">12 horas</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={selectedClock.showMeridiem ? 'yes' : 'no'}
                  onValueChange={(value: 'yes' | 'no') => {
                    handleClockConfigChange({
                      showMeridiem: value === 'yes'
                    })
                  }}
                  disabled={
                    isPending || !selectedScreenId || (selectedClock.hourFormat ?? '24') === '24'
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="AM/PM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Mostrar AM/PM</SelectItem>
                    <SelectItem value="no">Ocultar AM/PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
