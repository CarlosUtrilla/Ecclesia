import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Switch } from '@/ui/switch'
import { Radio } from 'lucide-react'
import LiveScreen from '@/screens/live-screen'
import StageScreen from '@/screens/stage-screen/index'
import {
  buildGlobalStageUpsertPayloads,
  getGlobalStageConfig
} from '@/screens/stage/shared/globalStageConfig'

type StageTimerState = {
  id?: string | number
  label?: string
  endsAt?: string | number
  endAt?: string | number
  remainingMs?: number
}

type StageState = {
  timers?: StageTimerState[]
  focusMode?: boolean
}

type StageConfigRecord = {
  selectedScreenId: number
  state: string
}

type StageScreenRecord = {
  id: number
}

function resolveRemainingMs(timer: StageTimerState, now: number): number {
  if (typeof timer.remainingMs === 'number') return timer.remainingMs

  const endAtCandidate = timer.endsAt ?? timer.endAt
  if (endAtCandidate == null) return 0

  const endsAtMs =
    typeof endAtCandidate === 'number' ? endAtCandidate : Date.parse(String(endAtCandidate))

  if (Number.isNaN(endsAtMs)) return 0

  return endsAtMs - now
}

function formatRemaining(remainingMs: number): string {
  const isNegative = remainingMs < 0
  const abs = Math.abs(remainingMs)
  const totalSeconds = Math.floor(abs / 1000)
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

function parseTimers(rawState: string | undefined): StageTimerState[] {
  if (!rawState) return []

  try {
    const parsed = JSON.parse(rawState) as StageState
    if (!Array.isArray(parsed.timers)) return []
    return parsed.timers
  } catch {
    return []
  }
}

function parseStageState(rawState: string | undefined): StageState {
  if (!rawState) return { timers: [], focusMode: false }

  try {
    const parsed = JSON.parse(rawState) as StageState
    return {
      timers: Array.isArray(parsed.timers) ? parsed.timers : [],
      focusMode: Boolean(parsed.focusMode)
    }
  } catch {
    return { timers: [], focusMode: false }
  }
}

export default function LiveScreens() {
  const queryClient = useQueryClient()
  const {
    showLiveScreen,
    setShowLiveScreen,
    liveScreens,
    stageScreens,
    contentScreen,
    hideTextOnLive,
    showLogoOnLive,
    blackScreenOnLive,
    setHideTextOnLive,
    setShowLogoOnLive,
    setBlackScreenOnLive
  } = useLive()

  const [nowMs, setNowMs] = useState(() => Date.now())

  const { data: stageScreensForConfig = [] } = useQuery<StageScreenRecord[]>({
    queryKey: ['selectedScreens', 'stage'],
    queryFn: () => window.api.selectedScreens.getSelectedScreensByRole('STAGE_SCREEN')
  })

  const { data: stageConfigs = [] } = useQuery<StageConfigRecord[]>({
    queryKey: ['stageScreenConfig'],
    queryFn: () => window.api.stageScreenConfig.getAllStageScreenConfigs(),
    staleTime: Infinity
  })

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('stageScreen-config-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['stageScreenConfig'] })
    })

    return () => {
      unsubscribe()
    }
  }, [queryClient])

  const globalStageConfig = useMemo(() => {
    return getGlobalStageConfig(stageScreensForConfig, stageConfigs)?.config ?? null
  }, [stageConfigs, stageScreensForConfig])

  const globalStageState = useMemo(() => {
    return parseStageState(globalStageConfig?.state)
  }, [globalStageConfig?.state])

  const { mutate: updateGlobalFocusMode, isPending: isUpdatingGlobalFocusMode } = useMutation({
    mutationFn: async (enabled: boolean) => {
      const currentState = parseStageState(globalStageConfig?.state)
      const updates = buildGlobalStageUpsertPayloads(stageScreensForConfig, {
        state: JSON.stringify({
          ...currentState,
          focusMode: enabled
        })
      })

      await Promise.all(
        updates.map((update) => window.api.stageScreenConfig.upsertStageScreenConfig(update))
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['stageScreenConfig'] })
      await Promise.all(
        stageScreensForConfig.map((screen) =>
          window.displayAPI.updateStageScreenConfig({
            selectedScreenId: screen.id
          })
        )
      )
    }
  })

  const activeStageTimers = useMemo(() => {
    const timers = parseTimers(globalStageConfig?.state).map((timer, index) => {
      const remainingMs = resolveRemainingMs(timer, nowMs)
      return {
        key: `${timer.id ?? index}`,
        label: timer.label?.trim() || `Timer ${index + 1}`,
        remainingMs
      }
    })

    if (timers.length === 0) return []
    return timers
  }, [globalStageConfig?.state, nowMs])

  return (
    <div className="h-full pannel-scrollable">
      <div className="panel-scroll-content flex flex-col h-full">
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
                <LiveScreen
                  key={`screen-${(screen as any)?.id ?? idx}`}
                  isPreview
                  liveControlsOverride={{
                    hideText: hideTextOnLive,
                    showLogo: showLogoOnLive,
                    blackScreen: blackScreenOnLive
                  }}
                />
              ))
            ) : (
              <div>No hay contenido para mostrar</div>
            )}
          </div>

          <div className="p-2 bg-muted/40 border-t flex items-center justify-between gap-2">
            <span>Pantallas stage</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Modo enfoque</span>
              <Switch
                checked={globalStageState.focusMode ?? false}
                onCheckedChange={(checked) => updateGlobalFocusMode(checked)}
                disabled={isUpdatingGlobalFocusMode || stageScreensForConfig.length === 0}
              />
            </div>
          </div>
          <div className="flex gap-2 p-2">
            {stageScreens.length > 0 ? (
              stageScreens.map((screen, idx) => (
                <div
                  key={`stage-screen-${(screen as any)?.id ?? idx}`}
                  className="w-full max-w-[360px] rounded-md border bg-background/70 overflow-hidden"
                >
                  <div className="px-2 py-1 text-xs text-muted-foreground border-b bg-muted/30">
                    {(screen as any)?.label || `Stage ${(screen as any)?.id ?? idx}`}
                  </div>
                  <div
                    className="bg-black"
                    style={{
                      aspectRatio: (screen as any)?.aspectRatioCss || '16 / 9'
                    }}
                  >
                    <StageScreen isPreview previewDisplayId={(screen as any)?.id} />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-muted-foreground">
                No hay pantallas stage configuradas
              </div>
            )}
          </div>
        </div>
        <div className="flex items-start justify-between gap-2 border-t bg-muted/30 px-2 py-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Timers stage activos
          </div>
          {activeStageTimers.length > 0 ? (
            <div className="flex max-w-[72%] flex-wrap justify-end gap-1.5">
              {activeStageTimers.map((timer) => (
                <div
                  key={timer.key}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                    timer.remainingMs < 0
                      ? 'border-rose-500/70 bg-rose-500/15 text-rose-700'
                      : 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700'
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      timer.remainingMs < 0
                        ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                        : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                    )}
                  />
                  <span className="max-w-[110px] truncate">{timer.label}</span>
                  <span>{formatRemaining(timer.remainingMs)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground">Sin timers activos</div>
          )}
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
    </div>
  )
}
