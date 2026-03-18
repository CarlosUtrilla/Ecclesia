import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Input } from '@/ui/input'
import { cn } from '@/lib/utils'
import FontFamilySelector from '@/ui/fontFamilySelector'
import { ColorPicker } from '@/ui/colorPicker'
import {
  DEFAULT_STAGE_LAYOUT,
  StageLayout,
  StageWidgetConfig,
  StageLayoutItem,
  StageWidgetType,
  parseStageLayout,
  stageLayoutToJson
} from '../stage/shared/layout'
import { ContentScreen } from '@/contexts/ScheduleContext/types'
import { BlankTheme } from '@/hooks/useThemes'
import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { PresentationView } from '@/ui/PresentationView'
import { ScreenContentUpdate } from 'electron/main/displayManager/displayType'
import { useCanvasWidgetTransform, WidgetResizeHandle } from '@/hooks/useCanvasWidgetTransform'
import { fontSizes } from '@/lib/themeConstants'

type StageScreenRecord = {
  id: number
  screenId: number
  screenName: string
  rol: 'LIVE_SCREEN' | 'STAGE_SCREEN' | null
}

type StageConfigRecord = {
  selectedScreenId: number
  layout: string
  themeId?: number | null
}

const WIDGET_LABELS: Record<StageWidgetType, string> = {
  liveScreen: 'Pantalla En Vivo',
  message: 'Mensaje',
  timers: 'Timers',
  clock: 'Reloj',
  liveTitle: 'Título En Vivo'
}

const DEFAULT_DIMENSIONS: Record<StageWidgetType, Pick<StageLayoutItem, 'w' | 'h'>> = {
  liveScreen: { w: 62, h: 56 },
  message: { w: 58, h: 18 },
  timers: { w: 26, h: 40 },
  clock: { w: 22, h: 10 },
  liveTitle: { w: 58, h: 10 }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const SNAP_STEP_PERCENT = 2
const snapToGrid = (value: number) => Math.round(value / SNAP_STEP_PERCENT) * SNAP_STEP_PERCENT
const STAGE_TEXT_FONT_SIZE_OPTIONS = [
  ...fontSizes,
  { label: '72px', value: 72 },
  { label: '80px', value: 80 },
  { label: '96px', value: 96 }
]

const STAGE_TIMER_FONT_SIZE_OPTIONS = [
  ...STAGE_TEXT_FONT_SIZE_OPTIONS,
  { label: '112px', value: 112 },
  { label: '128px', value: 128 },
  { label: '144px', value: 144 },
  { label: '160px', value: 160 },
  { label: '180px', value: 180 },
  { label: '200px', value: 200 },
  { label: '220px', value: 220 },
  { label: '240px', value: 240 }
]

const normalizeSize = (item: StageLayoutItem) => {
  const w = clamp(item.w, 8, 100)
  const h = clamp(item.h, 6, 100)
  return {
    ...item,
    x: clamp(item.x, 0, 100 - w),
    y: clamp(item.y, 0, 100 - h),
    w,
    h
  }
}

const createWidget = (type: StageWidgetType, index: number): StageLayoutItem => {
  const dimensions = DEFAULT_DIMENSIONS[type]
  const x = clamp(4 + ((index * 3) % 40), 0, 100 - dimensions.w)
  const y = clamp(4 + ((index * 2) % 40), 0, 100 - dimensions.h)

  return {
    id: `widget-${type}-${Date.now()}-${index}`,
    type,
    title: WIDGET_LABELS[type],
    x,
    y,
    w: dimensions.w,
    h: dimensions.h,
    z: index + 1,
    visible: true,
    config:
      type === 'timers'
        ? {
            fontFamily: 'monospace',
            timerOnTimeColor: '#22d3ee',
            timerWarningColor: '#f59e0b',
            timerOverdueColor: '#ef4444',
            timerWarningThresholdSeconds: 30
          }
        : type === 'clock'
          ? {
              textColor: '#ffffff',
              fontFamily: 'monospace',
              fontSize: 96
            }
          : type === 'message' || type === 'liveTitle'
            ? {
                textColor: '#ffffff',
                fontFamily: 'inherit',
                fontSize: type === 'message' ? 64 : 56
              }
            : {}
  }
}

export default function StageLayoutScreen() {
  const queryClient = useQueryClient()
  const [selectedScreenId, setSelectedScreenId] = useState<number | null>(null)
  const [layoutDraft, setLayoutDraft] = useState<StageLayout>(DEFAULT_STAGE_LAYOUT)
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null)
  const [showLivePreview, setShowLivePreview] = useState(false)
  const [itemIndex, setItemIndex] = useState(0)
  const [content, setContent] = useState<ContentScreen | null>(null)
  const [presentationVerseBySlideKey, setPresentationVerseBySlideKey] = useState<
    Record<string, number>
  >({})
  const [liveTheme, setLiveTheme] = useState<ThemeWithMedia>(BlankTheme)
  const [stageTheme, setStageTheme] = useState<ThemeWithMedia | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)

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

    const firstId = stageScreens[0].id
    setSelectedScreenId(firstId)
    const current = stageConfigs.find((config) => config.selectedScreenId === firstId)
    const parsed = parseStageLayout(current?.layout)
    setLayoutDraft(parsed)
    setSelectedWidgetId(parsed.items[0]?.id ?? null)
  }, [selectedScreenId, stageScreens, stageConfigs])

  const selectedScreen = useMemo(() => {
    if (selectedScreenId === null) return null
    return stageScreens.find((screen) => screen.id === selectedScreenId) ?? null
  }, [stageScreens, selectedScreenId])

  const sortedWidgets = useMemo(() => {
    return [...layoutDraft.items].sort((a, b) => a.z - b.z)
  }, [layoutDraft.items])

  const previewTheme = stageTheme ?? liveTheme

  const selectedWidget = useMemo(() => {
    if (!selectedWidgetId) return null
    return layoutDraft.items.find((item) => item.id === selectedWidgetId) ?? null
  }, [layoutDraft.items, selectedWidgetId])

  const { mutate: saveLayout, isPending } = useMutation({
    mutationFn: (payload: { selectedScreenId: number; layout: string }) =>
      window.api.stageScreenConfig.upsertStageScreenConfig(payload),
    onSuccess: async (updatedConfig) => {
      await queryClient.invalidateQueries({ queryKey: ['stageScreenConfig'] })
      await window.displayAPI.updateStageScreenConfig({
        selectedScreenId: updatedConfig.selectedScreenId
      })
    }
  })

  const updateWidget = useCallback(
    (widgetId: string, updater: (item: StageLayoutItem) => StageLayoutItem) => {
      setLayoutDraft((previous) => ({
        ...previous,
        items: previous.items.map((item) =>
          item.id === widgetId ? normalizeSize(updater(item)) : item
        )
      }))
    },
    []
  )

  const handleUpdateWidgetRect = useCallback(
    (widgetId: string, nextRect: { x: number; y: number; w: number; h: number }) => {
      updateWidget(widgetId, (item) => ({
        ...item,
        x: nextRect.x,
        y: nextRect.y,
        w: nextRect.w,
        h: nextRect.h
      }))
    },
    [updateWidget]
  )

  const { startMove, startResize } = useCanvasWidgetTransform({
    canvasRef,
    minWidth: 8,
    minHeight: 6,
    snap: snapToGrid,
    onUpdateWidgetRect: handleUpdateWidgetRect
  })

  const updateWidgetConfig = (
    widgetId: string,
    updater: (config: StageWidgetConfig) => StageWidgetConfig
  ) => {
    updateWidget(widgetId, (item) => ({
      ...item,
      config: updater(item.config ?? {})
    }))
  }

  const handleAddWidget = (type: StageWidgetType) => {
    setLayoutDraft((previous) => {
      const next = createWidget(type, previous.items.length + 1)
      return {
        ...previous,
        items: [...previous.items, next]
      }
    })
  }

  useEffect(() => {
    const unsubscribeItems = window.electron.ipcRenderer.on(
      'liveScreen-update',
      (_, data: ScreenContentUpdate) => {
        if (typeof data.itemIndex === 'number') {
          setItemIndex(data.itemIndex)
        }
        setContent(data.contentScreen)
        setPresentationVerseBySlideKey(data.presentationVerseBySlideKey || {})
      }
    )

    const unsubscribeTheme = window.electron.ipcRenderer.on(
      'liveScreen-update-theme',
      (_, theme: ThemeWithMedia) => {
        setLiveTheme(theme)
      }
    )

    return () => {
      unsubscribeItems()
      unsubscribeTheme()
    }
  }, [])

  useEffect(() => {
    if (selectedScreenId === null) {
      setStageTheme(null)
      return
    }

    const currentConfig = stageConfigs.find(
      (config) => config.selectedScreenId === selectedScreenId
    )
    if (!currentConfig?.themeId) {
      setStageTheme(null)
      return
    }

    const loadTheme = async () => {
      const theme = await window.api.themes.getThemeById(currentConfig.themeId!)
      setStageTheme(theme)
    }

    loadTheme()
  }, [selectedScreenId, stageConfigs])

  const handleSaveLayout = () => {
    if (selectedScreenId === null) return

    saveLayout({
      selectedScreenId,
      layout: stageLayoutToJson(layoutDraft)
    })
  }

  const handleResetBase = () => {
    setLayoutDraft(DEFAULT_STAGE_LAYOUT)
    setSelectedWidgetId(DEFAULT_STAGE_LAYOUT.items[0]?.id ?? null)
  }

  return (
    <div className="h-full w-full bg-background p-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h1 className="text-xl font-semibold">Editor Stage</h1>
            <p className="text-sm text-muted-foreground">
              Acomoda recursos de stage (mensaje, timers, reloj, título en vivo).
            </p>
          </div>
          <Button variant="outline" onClick={() => window.windowAPI.closeCurrentWindow()}>
            Cerrar
          </Button>
        </div>

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <CardTitle>Layout Visual</CardTitle>
            <CardDescription>
              Define posición y tamaño de los widgets en porcentaje del escenario. Snap activo cada{' '}
              {SNAP_STEP_PERCENT}% para mover y redimensionar.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_340px]">
            {stageScreens.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay pantallas stage configuradas.</p>
            ) : (
              <>
                <div className="flex min-h-0 flex-col gap-3">
                  <Select
                    value={selectedScreenId !== null ? String(selectedScreenId) : undefined}
                    onValueChange={(value) => {
                      const nextId = Number(value)
                      setSelectedScreenId(nextId)
                      const current = stageConfigs.find(
                        (config) => config.selectedScreenId === nextId
                      )
                      const parsed = parseStageLayout(current?.layout)
                      setLayoutDraft(parsed)
                      setSelectedWidgetId(parsed.items[0]?.id ?? null)
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

                  <div className="text-xs text-muted-foreground">
                    Editando: {selectedScreen?.screenName ?? 'Ninguna'}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={showLivePreview ? 'default' : 'outline'}
                      onClick={() => setShowLivePreview((prev) => !prev)}
                    >
                      {showLivePreview ? 'Ocultar Vista En Vivo' : 'Mostrar Vista En Vivo'}
                    </Button>
                  </div>

                  <div
                    ref={canvasRef}
                    className="relative aspect-video w-full overflow-hidden rounded-md border bg-black/95"
                  >
                    {showLivePreview ? (
                      <div className="absolute inset-0 z-0">
                        <PresentationView
                          items={content?.content || []}
                          theme={previewTheme}
                          currentIndex={itemIndex}
                          presentationVerseBySlideKey={presentationVerseBySlideKey}
                        />
                      </div>
                    ) : null}

                    {sortedWidgets.map((widget) => {
                      const isSelected = widget.id === selectedWidgetId

                      const resizeHandles: { handle: WidgetResizeHandle; className: string }[] = [
                        {
                          handle: 'top-left',
                          className:
                            'absolute -left-2 -top-2 z-20 h-4 w-4 rounded-sm bg-cyan-300 border border-background cursor-nwse-resize'
                        },
                        {
                          handle: 'top-right',
                          className:
                            'absolute -right-2 -top-2 z-20 h-4 w-4 rounded-sm bg-cyan-300 border border-background cursor-nesw-resize'
                        },
                        {
                          handle: 'bottom-left',
                          className:
                            'absolute -left-2 -bottom-2 z-20 h-4 w-4 rounded-sm bg-cyan-300 border border-background cursor-nesw-resize'
                        },
                        {
                          handle: 'bottom-right',
                          className:
                            'absolute -right-2 -bottom-2 z-20 h-4 w-4 rounded-sm bg-cyan-300 border border-background cursor-nwse-resize'
                        },
                        {
                          handle: 'top',
                          className:
                            'absolute -top-2 left-1/2 z-20 h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-300 border border-background cursor-ns-resize'
                        },
                        {
                          handle: 'bottom',
                          className:
                            'absolute -bottom-2 left-1/2 z-20 h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-300 border border-background cursor-ns-resize'
                        },
                        {
                          handle: 'left',
                          className:
                            'absolute -left-2 top-1/2 z-20 h-3 w-3 -translate-y-1/2 rounded-full bg-cyan-300 border border-background cursor-ew-resize'
                        },
                        {
                          handle: 'right',
                          className:
                            'absolute -right-2 top-1/2 z-20 h-3 w-3 -translate-y-1/2 rounded-full bg-cyan-300 border border-background cursor-ew-resize'
                        }
                      ]

                      return (
                        <button
                          key={widget.id}
                          type="button"
                          onClick={() => setSelectedWidgetId(widget.id)}
                          onPointerDown={(event) => {
                            setSelectedWidgetId(widget.id)
                            startMove(event, widget.id, {
                              x: widget.x,
                              y: widget.y,
                              w: widget.w,
                              h: widget.h
                            })
                          }}
                          style={{
                            left: `${widget.x}%`,
                            top: `${widget.y}%`,
                            width: `${widget.w}%`,
                            height: `${widget.h}%`,
                            zIndex: widget.z,
                            opacity: widget.visible ? 1 : 0.35
                          }}
                          className={cn(
                            'absolute cursor-move select-none overflow-visible rounded border border-dashed border-white/30 bg-white/10 p-1 text-left text-[10px] text-white',
                            isSelected ? 'border-cyan-300 bg-cyan-400/20' : 'hover:border-white/60'
                          )}
                        >
                          <div className="truncate font-semibold">{widget.title}</div>
                          <div className="truncate uppercase text-white/70">{widget.type}</div>

                          {isSelected
                            ? resizeHandles.map((resizeHandle) => (
                                <span
                                  key={resizeHandle.handle}
                                  onPointerDown={(event) => {
                                    setSelectedWidgetId(widget.id)
                                    startResize(
                                      event,
                                      widget.id,
                                      {
                                        x: widget.x,
                                        y: widget.y,
                                        w: widget.w,
                                        h: widget.h
                                      },
                                      resizeHandle.handle
                                    )
                                  }}
                                  className={resizeHandle.className}
                                />
                              ))
                            : null}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveLayout}
                      disabled={isPending || selectedScreenId === null}
                    >
                      Guardar layout
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleResetBase}
                      disabled={isPending || selectedScreenId === null}
                    >
                      Restablecer base
                    </Button>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col gap-3 overflow-auto rounded-md border p-3">
                  <div className="text-sm font-medium">Recursos</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      ['liveScreen', 'message', 'timers', 'clock', 'liveTitle'] as StageWidgetType[]
                    ).map((type) => (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddWidget(type)}
                        disabled={isPending}
                      >
                        + {WIDGET_LABELS[type]}
                      </Button>
                    ))}
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <div className="text-sm font-medium">Widgets en layout</div>
                    {sortedWidgets.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin widgets.</p>
                    ) : (
                      sortedWidgets.map((widget) => (
                        <button
                          key={widget.id}
                          type="button"
                          onClick={() => setSelectedWidgetId(widget.id)}
                          className={cn(
                            'flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-xs',
                            selectedWidgetId === widget.id
                              ? 'border-cyan-400 bg-cyan-500/10'
                              : 'hover:bg-muted/50'
                          )}
                        >
                          <span className="truncate font-medium">{widget.title}</span>
                          <span className="text-muted-foreground">{widget.type}</span>
                        </button>
                      ))
                    )}
                  </div>

                  {selectedWidget ? (
                    <div className="space-y-2 border-t pt-3">
                      <div className="text-sm font-medium">Propiedades</div>
                      <Input
                        value={selectedWidget.title}
                        onChange={(event) =>
                          updateWidget(selectedWidget.id, (item) => ({
                            ...item,
                            title: event.target.value
                          }))
                        }
                      />

                      {selectedWidget.type === 'timers' ? (
                        <div className="space-y-2 rounded border p-2">
                          <div className="text-xs font-medium text-muted-foreground">
                            Estilo de timer
                          </div>

                          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                            <span className="text-xs">Color normal</span>
                            <ColorPicker
                              className="h-9 w-14"
                              value={selectedWidget.config?.timerOnTimeColor ?? '#22d3ee'}
                              onChange={(color) =>
                                updateWidgetConfig(selectedWidget.id, (config) => ({
                                  ...config,
                                  timerOnTimeColor: color
                                }))
                              }
                            />
                          </div>

                          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                            <span className="text-xs">Umbral (segundos)</span>
                            <Input
                              type="number"
                              min="0"
                              max="3600"
                              step="1"
                              className="h-9 w-24"
                              value={selectedWidget.config?.timerWarningThresholdSeconds ?? 30}
                              onChange={(event) => {
                                const next = Number(event.target.value)
                                if (!Number.isFinite(next)) return
                                updateWidgetConfig(selectedWidget.id, (config) => ({
                                  ...config,
                                  timerWarningThresholdSeconds: clamp(next, 0, 3600)
                                }))
                              }}
                            />
                          </div>

                          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                            <span className="text-xs">Color cerca de 0</span>
                            <ColorPicker
                              className="h-9 w-14"
                              value={selectedWidget.config?.timerWarningColor ?? '#f59e0b'}
                              onChange={(color) =>
                                updateWidgetConfig(selectedWidget.id, (config) => ({
                                  ...config,
                                  timerWarningColor: color
                                }))
                              }
                            />
                          </div>

                          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                            <span className="text-xs">Color en negativo</span>
                            <ColorPicker
                              className="h-9 w-14"
                              value={selectedWidget.config?.timerOverdueColor ?? '#ef4444'}
                              onChange={(color) =>
                                updateWidgetConfig(selectedWidget.id, (config) => ({
                                  ...config,
                                  timerOverdueColor: color
                                }))
                              }
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-xs">Fuente</span>
                            <FontFamilySelector
                              className="h-9 w-full"
                              value={selectedWidget.config?.fontFamily ?? 'monospace'}
                              onChange={(value) =>
                                updateWidgetConfig(selectedWidget.id, (config) => ({
                                  ...config,
                                  fontFamily: value
                                }))
                              }
                            />
                          </div>

                          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                            <span className="text-xs">Tamaño etiqueta</span>
                            <Select
                              value={String(selectedWidget.config?.timerLabelFontSize ?? 36)}
                              onValueChange={(value) => {
                                updateWidgetConfig(selectedWidget.id, (config) => ({
                                  ...config,
                                  timerLabelFontSize: clamp(Number(value), 12, 180)
                                }))
                              }}
                            >
                              <SelectTrigger size="sm" className="h-9 w-24">
                                <SelectValue placeholder="36px" />
                              </SelectTrigger>
                              <SelectContent>
                                {STAGE_TIMER_FONT_SIZE_OPTIONS.filter(
                                  (size) => size.value <= 180
                                ).map((size) => (
                                  <SelectItem
                                    key={`timer-label-${size.value}`}
                                    value={String(size.value)}
                                  >
                                    {size.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                            <span className="text-xs">Tamaño valor</span>
                            <Select
                              value={String(selectedWidget.config?.timerValueFontSize ?? 96)}
                              onValueChange={(value) => {
                                updateWidgetConfig(selectedWidget.id, (config) => ({
                                  ...config,
                                  timerValueFontSize: clamp(Number(value), 16, 240)
                                }))
                              }}
                            >
                              <SelectTrigger size="sm" className="h-9 w-24">
                                <SelectValue placeholder="96px" />
                              </SelectTrigger>
                              <SelectContent>
                                {STAGE_TIMER_FONT_SIZE_OPTIONS.filter(
                                  (size) => size.value >= 16
                                ).map((size) => (
                                  <SelectItem
                                    key={`timer-value-${size.value}`}
                                    value={String(size.value)}
                                  >
                                    {size.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : null}

                      {selectedWidget.type === 'clock' ||
                      selectedWidget.type === 'message' ||
                      selectedWidget.type === 'liveTitle' ? (
                        <div className="space-y-2 rounded border p-2">
                          <div className="text-xs font-medium text-muted-foreground">
                            Estilo de texto
                          </div>

                          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                            <span className="text-xs">Color de texto</span>
                            <ColorPicker
                              className="h-9 w-14"
                              value={selectedWidget.config?.textColor ?? '#ffffff'}
                              onChange={(color) =>
                                updateWidgetConfig(selectedWidget.id, (config) => ({
                                  ...config,
                                  textColor: color
                                }))
                              }
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-xs">Fuente</span>
                            <FontFamilySelector
                              className="h-9 w-full"
                              value={selectedWidget.config?.fontFamily ?? 'inherit'}
                              onChange={(value) =>
                                updateWidgetConfig(selectedWidget.id, (config) => ({
                                  ...config,
                                  fontFamily: value
                                }))
                              }
                            />
                          </div>

                          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                            <span className="text-xs">Tamaño fuente</span>
                            <Select
                              value={String(selectedWidget.config?.fontSize ?? 64)}
                              onValueChange={(value) => {
                                updateWidgetConfig(selectedWidget.id, (config) => ({
                                  ...config,
                                  fontSize: clamp(Number(value), 16, 240)
                                }))
                              }}
                            >
                              <SelectTrigger size="sm" className="h-9 w-24">
                                <SelectValue placeholder="64px" />
                              </SelectTrigger>
                              <SelectContent>
                                {STAGE_TEXT_FONT_SIZE_OPTIONS.filter(
                                  (size) => size.value >= 16
                                ).map((size) => (
                                  <SelectItem
                                    key={`text-widget-${size.value}`}
                                    value={String(size.value)}
                                  >
                                    {size.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : null}

                      {selectedWidget.type === 'liveScreen' ? (
                        <p className="text-xs text-muted-foreground">
                          Este widget usa el contenido live. Ajusta su posición y tamaño arrastrando
                          en el canvas.
                        </p>
                      ) : null}

                      <Button
                        variant={selectedWidget.visible ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() =>
                          updateWidget(selectedWidget.id, (item) => ({
                            ...item,
                            visible: !item.visible
                          }))
                        }
                      >
                        {selectedWidget.visible ? 'Ocultar widget' : 'Mostrar widget'}
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setLayoutDraft((previous) => ({
                            ...previous,
                            items: previous.items.filter((item) => item.id !== selectedWidget.id)
                          }))
                          setSelectedWidgetId(null)
                        }}
                      >
                        Eliminar widget
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Selecciona un widget para editar.
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
