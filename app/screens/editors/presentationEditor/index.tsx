import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams } from 'react-router-dom'
import {
  BookText,
  ChevronDown,
  Palette,
  Minus,
  FileImage,
  Paperclip,
  Plus as PlusIcon,
  Plus,
  Save,
  TextCursorInput,
  Zap
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Media } from '@prisma/client'
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/ui/dropdown-menu'
import { Card } from '@/ui/card'
import { Slider } from '@/ui/slider'
import { Label } from '@/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { AnimationSettings, defaultAnimationSettings } from '@/lib/animationSettings'
import { BlankTheme, useThemes } from '@/hooks/useThemes'
import { MediaPicker } from '@/screens/panels/library/media/exports'
import AnimationSelector from '../themesEditor/animationSelector'
import ThemePicker from './themePicker'
import { PresentationSchema, PresentationFormValues } from './schema'
import TextStyleToolbar from './components/textStyleToolbar'
import BibleTextPicker from './bibleTextPicker'
import EditorCanvas from './components/editorCanvas'
import SortableSlideCard from './components/sortableSlideCard'
import usePresentationEditorShortcuts from './hooks/usePresentationEditorShortcuts'
import usePresentationEditorActions from './hooks/usePresentationEditorActions'
import usePresentationEditorHistory, {
  PresentationEditorHistorySnapshot
} from './hooks/usePresentationEditorHistory'
import { buildBibleAccessData, parseBibleAccessData } from './utils/bibleAccessData'
import {
  buildPrimaryItemFromSlide,
  BASE_CANVAS_HEIGHT,
  BASE_CANVAS_WIDTH,
  createTextSlide,
  defaultTransitionSettingsString,
  ensureSlideItems,
  parseCanvasItemStyle,
  PresentationSlide
} from './utils/slideUtils'
import { BibleSlideControls, MediaSlideControls } from './components/slideControls'

const getUniformThemeId = (slides: PresentationFormValues['slides']): number | null => {
  if (slides.length === 0) return null

  const themeIds = new Set<number | null>(
    slides.map((slide) =>
      slide.themeId === undefined || slide.themeId === null ? null : slide.themeId
    )
  )

  return themeIds.size === 1 ? (Array.from(themeIds)[0] ?? null) : null
}

export default function PresentationEditor() {
  const { id } = useParams()
  const isCreating = !id || id === 'new'

  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0)
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(undefined)
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false)
  const [mediaPickerMode, setMediaPickerMode] = useState<'insert-current' | 'replace-current'>(
    'insert-current'
  )
  const [isBiblePickerOpen, setIsBiblePickerOpen] = useState(false)
  const [isCanvasDragging, setIsCanvasDragging] = useState(false)
  const [animationPreviewKey, setAnimationPreviewKey] = useState(0)
  const [canvasZoom, setCanvasZoom] = useState(100)
  const [globalThemeId, setGlobalThemeId] = useState<number | null>(null)
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false)
  const shouldSeedHistoryRef = useRef(false)
  const previewAreaRef = useRef<HTMLDivElement>(null)
  const { themes } = useThemes()

  const form = useForm<PresentationFormValues>({
    resolver: zodResolver(PresentationSchema),
    defaultValues: {
      title: '',
      slides: [createTextSlide()]
    }
  })

  const {
    register,
    watch,
    setValue,
    reset,
    handleSubmit,
    formState: { isSubmitting }
  } = form

  const title = watch('title')
  const slides = watch('slides')
  const themeById = useMemo(() => new Map(themes.map((theme) => [theme.id, theme])), [themes])
  const activePresentationTheme =
    globalThemeId === null ? BlankTheme : (themeById.get(globalThemeId) ?? BlankTheme)
  const selectedSlide = slides[selectedSlideIndex]
  const selectedSlideHasVideo = useMemo(() => {
    if (!selectedSlide) return false
    const items = ensureSlideItems(selectedSlide)
    return items.some((item) => item.type === 'MEDIA')
  }, [selectedSlide])
  const minCanvasZoom = 50
  const maxCanvasZoom = 200
  const zoomScale = canvasZoom / 100
  const zoomedCanvasWidth = BASE_CANVAS_WIDTH * zoomScale
  const zoomedCanvasHeight = BASE_CANVAS_HEIGHT * zoomScale

  const clampCanvasZoom = (value: number) =>
    Math.min(maxCanvasZoom, Math.max(minCanvasZoom, Math.round(value)))

  const handleCanvasZoomByWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return

    event.preventDefault()

    const direction = event.deltaY < 0 ? 1 : -1
    const step = event.shiftKey ? 20 : 10

    setCanvasZoom((current) => clampCanvasZoom(current + direction * step))
  }

  const { fields, append, move } = useFieldArray({
    control: form.control,
    name: 'slides'
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const { data: media = [] } = useQuery({
    queryKey: ['media', 'presentation-editor'],
    queryFn: async () => {
      const all = await window.api.media.findAll({})
      return all.items as Media[]
    }
  })

  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media])
  const slideSortableIndex = useMemo(() => slides.map((slide) => slide.id), [slides])

  useQuery({
    queryKey: ['presentation', id],
    queryFn: async () => {
      if (isCreating || !id) return null

      const presentation = await window.api.presentations.getPresentationById(Number(id))
      if (!presentation) return null

      const normalizedSlides = (presentation.slides as PresentationFormValues['slides']).map(
        (slide) => ({
          ...slide,
          videoLiveBehavior: slide.videoLiveBehavior || 'manual',
          transitionSettings: slide.transitionSettings || defaultTransitionSettingsString,
          items: ensureSlideItems(slide)
        })
      )

      reset({
        title: presentation.title,
        slides: normalizedSlides.length > 0 ? normalizedSlides : [createTextSlide()]
      })
      setGlobalThemeId(getUniformThemeId(normalizedSlides))
      shouldSeedHistoryRef.current = true

      return presentation
    },
    enabled: !isCreating
  })

  useEffect(() => {
    if (!selectedSlide) return

    const normalizedItems = ensureSlideItems(selectedSlide)
    if ((selectedSlide.items || []).length !== normalizedItems.length) {
      setValue(`slides.${selectedSlideIndex}.items`, normalizedItems, { shouldDirty: true })
      setSelectedItemId(normalizedItems[normalizedItems.length - 1]?.id)
      return
    }

    if (!selectedItemId || !normalizedItems.some((item) => item.id === selectedItemId)) {
      const topItem = [...normalizedItems]
        .sort((a, b) => Number(a.layer || 0) - Number(b.layer || 0))
        .at(-1)
      setSelectedItemId(topItem?.id)
    }
  }, [selectedSlide?.id, selectedSlideIndex])

  const selectedItem =
    selectedSlide?.items?.find((item) => item.id === selectedItemId) || selectedSlide?.items?.[0]

  const selectedItemStyle = selectedItem
    ? parseCanvasItemStyle(selectedItem.customStyle, selectedItem.type)
    : undefined

  const selectedSlideTransitionSettings = useMemo<AnimationSettings>(() => {
    if (!selectedSlide?.transitionSettings) return defaultAnimationSettings

    try {
      return {
        ...defaultAnimationSettings,
        ...JSON.parse(selectedSlide.transitionSettings)
      }
    } catch {
      return defaultAnimationSettings
    }
  }, [selectedSlide?.transitionSettings])

  const selectedItemAnimationSettings = useMemo<AnimationSettings>(() => {
    if (!selectedItem?.animationSettings) return defaultAnimationSettings

    try {
      return {
        ...defaultAnimationSettings,
        ...JSON.parse(selectedItem.animationSettings)
      }
    } catch {
      return defaultAnimationSettings
    }
  }, [selectedItem?.animationSettings])

  const selectedMediaId = useMemo(() => {
    if (!selectedItem || selectedItem.type !== 'MEDIA') return undefined
    const mediaId = Number(selectedItem.accessData || 0)
    return Number.isFinite(mediaId) && mediaId > 0 ? mediaId : undefined
  }, [selectedItem?.id, selectedItem?.type, selectedItem?.accessData])

  const historySnapshot = useMemo<PresentationEditorHistorySnapshot>(
    () => ({
      title,
      slides,
      selectedSlideIndex,
      selectedItemId
    }),
    [title, slides, selectedSlideIndex, selectedItemId]
  )

  const { undoHistory, redoHistory, seedHistory } = usePresentationEditorHistory({
    snapshot: historySnapshot,
    onApplySnapshot: (snapshot) => {
      reset({
        title: snapshot.title,
        slides: snapshot.slides as PresentationFormValues['slides']
      })
      setSelectedSlideIndex(snapshot.selectedSlideIndex)
      setSelectedItemId(snapshot.selectedItemId)
    },
    isCapturePaused: isCanvasDragging
  })

  useEffect(() => {
    if (!shouldSeedHistoryRef.current) return
    seedHistory(historySnapshot)
    shouldSeedHistoryRef.current = false
  }, [historySnapshot, seedHistory])

  const {
    updateSelectedSlideItems,
    updateSelectedItemStyle,
    updateSelectedItem,
    updateSelectedTextStyle,
    updateItemStyleById,
    loadBibleText,
    handleAddBibleToPresentation,
    insertMediaItem,
    replaceSelectedMedia,
    handleSelectMedia,
    insertTextInCurrentSlide,
    addEmptySlide,
    updateItemLayerById,
    duplicateItemById,
    duplicateSelectedItem,
    removeItemById,
    removeSelectedItem
  } = usePresentationEditorActions({
    selectedSlide,
    selectedSlideIndex,
    selectedItem,
    selectedItemStyle,
    mediaPickerMode,
    globalThemeId,
    slidesLength: slides.length,
    fieldsLength: fields.length,
    setValue,
    appendSlide: append,
    setSelectedSlideIndex,
    setSelectedItemId,
    setMediaPickerMode,
    setIsMediaPickerOpen
  })

  usePresentationEditorShortcuts({
    hasSelectedItem: Boolean(selectedItem),
    onDelete: removeSelectedItem,
    onDuplicate: duplicateSelectedItem,
    onUndo: undoHistory,
    onRedo: redoHistory
  })

  const handleSelectedItemAnimationChange = (settings: AnimationSettings) => {
    if (!selectedItem || selectedItem.type === 'MEDIA') return
    updateSelectedItem({ animationSettings: JSON.stringify(settings) })
    setAnimationPreviewKey((current) => current + 1)
  }

  const handleAnimationPreview = () => {
    setAnimationPreviewKey((current) => current + 1)
  }

  const handleSelectedSlideTransitionChange = (settings: AnimationSettings) => {
    if (!selectedSlide) return

    setValue(`slides.${selectedSlideIndex}.transitionSettings`, JSON.stringify(settings), {
      shouldDirty: true
    })
  }

  const handleSlidesDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = slides.findIndex((slide) => slide.id === String(active.id))
    const newIndex = slides.findIndex((slide) => slide.id === String(over.id))

    if (oldIndex === -1 || newIndex === -1) return

    move(oldIndex, newIndex)

    if (selectedSlideIndex === oldIndex) {
      setSelectedSlideIndex(newIndex)
      return
    }

    if (oldIndex < selectedSlideIndex && newIndex >= selectedSlideIndex) {
      setSelectedSlideIndex((current) => current - 1)
      return
    }

    if (oldIndex > selectedSlideIndex && newIndex <= selectedSlideIndex) {
      setSelectedSlideIndex((current) => current + 1)
    }
  }

  const onSave = handleSubmit(async (values) => {
    const normalizedValues = {
      ...values,
      slides: values.slides.map((slide) => {
        const items = ensureSlideItems(slide)
        const primary = items[0] || buildPrimaryItemFromSlide(slide)
        const bible =
          primary.type === 'BIBLE' ? parseBibleAccessData(primary.accessData) : undefined

        return {
          ...slide,
          videoLiveBehavior: slide.videoLiveBehavior || 'manual',
          transitionSettings: slide.transitionSettings || defaultTransitionSettingsString,
          items,
          type: (primary.type === 'MEDIA'
            ? 'MEDIA'
            : primary.type === 'BIBLE'
              ? 'BIBLE'
              : 'TEXT') as PresentationSlide['type'],
          text: primary.text || slide.text,
          mediaId:
            primary.type === 'MEDIA' ? Number(primary.accessData || 0) || undefined : undefined,
          bible
        }
      })
    }

    if (isCreating) {
      await window.api.presentations.createPresentation(normalizedValues)
    } else {
      await window.api.presentations.updatePresentation(Number(id), normalizedValues)
    }

    window.electron.ipcRenderer.send('presentation-saved')
    window.windowAPI.closeCurrentWindow()
  })

  const applyGlobalTheme = (nextThemeId: number | null) => {
    setGlobalThemeId(nextThemeId)
    setValue(
      'slides',
      slides.map((slide) => ({
        ...slide,
        themeId: nextThemeId
      })),
      { shouldDirty: true }
    )
  }

  return (
    <div className="min-h-screen max-h-screen flex flex-col overflow-hidden">
      <div className="flex-shrink-0">
        <title>Editor de presentaciones</title>
        <div className="p-2.5 flex items-center gap-2 border-b bg-background/70 flex-wrap">
          <div className="w-[240px] shrink-0">
            <Input
              placeholder="Título de la presentación"
              className="!bg-background h-8"
              {...register('title')}
            />
            <div className="ml-auto flex mt-1.5 gap-2 w-full">
              <Button onClick={onSave} disabled={isSubmitting} size="sm" className="flex-1">
                <Save />
                Guardar
              </Button>
              <Button
                onClick={() => window.windowAPI.closeCurrentWindow()}
                size="sm"
                className="flex-1"
                variant="destructive"
              >
                Cerrar
              </Button>
            </div>
          </div>

          {selectedItem && selectedItem.type !== 'MEDIA' && selectedItemStyle ? (
            <>
              <div className="h-16 w-px mx-1 bg-border" />
              <div className="min-w-0 overflow-x-auto">
                <TextStyleToolbar
                  value={{
                    fontFamily: selectedItemStyle.fontFamily,
                    fontSize: selectedItemStyle.fontSize,
                    color: selectedItemStyle.color,
                    fontWeight: selectedItemStyle.fontWeight,
                    fontStyle: selectedItemStyle.fontStyle,
                    textDecoration: selectedItemStyle.textDecoration,
                    lineHeight: selectedItemStyle.lineHeight,
                    letterSpacing: selectedItemStyle.letterSpacing,
                    textAlign: selectedItemStyle.textAlign,
                    verticalAlign: selectedItemStyle.verticalAlign,
                    offsetX: selectedItemStyle.x - 220,
                    offsetY: selectedItemStyle.y - 180
                  }}
                  onChange={(updates) => updateSelectedTextStyle(updates)}
                  containerClassName="p-0 border-0 flex-nowrap w-max"
                />
              </div>
              <div className="h-16 w-px mx-1 bg-border" />
              <AnimationSelector
                settings={selectedItemAnimationSettings}
                onChange={handleSelectedItemAnimationChange}
                onPreview={handleAnimationPreview}
                label="Animación texto:"
              />
            </>
          ) : null}

          {selectedSlide ? (
            <>
              <div className="w-52">
                <Label className="text-xs text-muted-foreground">Tema global:</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 mt-1"
                  onClick={() => setIsThemePickerOpen(true)}
                >
                  <Palette className="size-4" />
                  {globalThemeId === null
                    ? 'Sin tema'
                    : (themes.find((theme) => theme.id === globalThemeId)?.name ??
                      'Seleccionar tema')}
                </Button>
              </div>
              <div className="h-16 w-px mx-1 bg-border" />
              <AnimationSelector
                settings={selectedSlideTransitionSettings}
                onChange={handleSelectedSlideTransitionChange}
                label="Transición slide:"
              />
              <div className="w-44">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="size-3.5" />
                  Video en live:
                </Label>
                <Select
                  value={selectedSlide.videoLiveBehavior || 'manual'}
                  onValueChange={(value: 'auto' | 'manual') => {
                    setValue(`slides.${selectedSlideIndex}.videoLiveBehavior`, value, {
                      shouldDirty: true
                    })
                  }}
                >
                  <SelectTrigger className="h-8" disabled={!selectedSlideHasVideo}>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Inicio manual</SelectItem>
                    <SelectItem value="auto">Inicio automático</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          <div className="h-16 w-px mx-0.5 bg-border" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="gap-2">
                <Paperclip className="size-4" />
                Insertar medios
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={insertTextInCurrentSlide}>
                <TextCursorInput className="size-4" />
                Texto libre
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsBiblePickerOpen(true)}>
                <BookText className="size-4" />
                Texto bíblico
              </DropdownMenuItem>
              <DropdownMenuItem onClick={insertMediaItem}>
                <FileImage className="size-4" />
                Imagen o video
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {selectedItem?.type === 'MEDIA' && selectedItemStyle ? (
          <MediaSlideControls
            mediaId={selectedMediaId}
            width={selectedItemStyle.width}
            height={selectedItemStyle.height}
            rotation={selectedItemStyle.rotation}
            media={media}
            onOpenMediaPicker={replaceSelectedMedia}
            onMediaIdChange={(mediaId) => updateSelectedItem({ accessData: String(mediaId) })}
            onMediaWidthChange={(width) => updateSelectedItemStyle({ width })}
            onMediaHeightChange={(height) => updateSelectedItemStyle({ height })}
            onRotationChange={(rotation) => updateSelectedItemStyle({ rotation })}
          />
        ) : null}

        {selectedItem?.type === 'BIBLE' ? (
          <BibleSlideControls
            item={selectedItem}
            onBookChange={(value) => {
              const current = parseBibleAccessData(selectedItem.accessData)
              updateSelectedItem({
                accessData: buildBibleAccessData({ ...current, bookId: value })
              })
            }}
            onChapterChange={(value) => {
              const current = parseBibleAccessData(selectedItem.accessData)
              updateSelectedItem({
                accessData: buildBibleAccessData({ ...current, chapter: value })
              })
            }}
            onVerseStartChange={(value) => {
              const current = parseBibleAccessData(selectedItem.accessData)
              updateSelectedItem({
                accessData: buildBibleAccessData({ ...current, verseStart: value })
              })
            }}
            onVerseEndChange={(value) => {
              const current = parseBibleAccessData(selectedItem.accessData)
              updateSelectedItem({
                accessData: buildBibleAccessData({ ...current, verseEnd: value })
              })
            }}
            onVersionChange={(value) => {
              const current = parseBibleAccessData(selectedItem.accessData)
              updateSelectedItem({
                accessData: buildBibleAccessData({ ...current, version: value })
              })
            }}
            onLoadBibleText={loadBibleText}
          />
        ) : null}
      </div>

      <div
        ref={previewAreaRef as React.RefObject<HTMLDivElement>}
        className="flex-1 min-h-0 bg-muted flex items-center justify-center p-5 md:p-6 overflow-auto"
        onWheel={handleCanvasZoomByWheel}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            setSelectedItemId(undefined)
          }
        }}
      >
        <div className="relative shrink-0 rounded-xl border border-border/60 bg-background/40 p-2 shadow-sm">
          <div
            className="relative"
            style={{
              width: zoomedCanvasWidth,
              height: zoomedCanvasHeight
            }}
          >
            <div
              className="absolute left-0 top-0"
              style={{
                width: BASE_CANVAS_WIDTH,
                height: BASE_CANVAS_HEIGHT,
                transform: `scale(${zoomScale})`,
                transformOrigin: 'top left'
              }}
            >
              {selectedSlide ? (
                <EditorCanvas
                  slide={selectedSlide}
                  mediaById={mediaById}
                  theme={activePresentationTheme}
                  canvasScale={zoomScale}
                  animationPreviewKey={animationPreviewKey}
                  selectedItemId={selectedItemId}
                  onSelectItem={setSelectedItemId}
                  onDuplicateItem={duplicateItemById}
                  onDeleteItem={removeItemById}
                  onLayerUpItem={(itemId) => updateItemLayerById(itemId, 'up')}
                  onLayerDownItem={(itemId) => updateItemLayerById(itemId, 'down')}
                  onDragStateChange={setIsCanvasDragging}
                  onItemTextChange={(itemId, nextText) => {
                    updateSelectedSlideItems((items) =>
                      items.map((entry) =>
                        entry.id === itemId
                          ? {
                              ...entry,
                              text: nextText
                            }
                          : entry
                      )
                    )
                  }}
                  onItemStyleChange={(itemId, next) => {
                    updateItemStyleById(itemId, next)
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 px-2.5 py-2 bg-muted/50 border-t">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1 overflow-x-auto pb-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSlidesDragEnd}
            >
              <SortableContext items={slideSortableIndex} strategy={horizontalListSortingStrategy}>
                <div className="flex items-center gap-1.5">
                  {slides.map((slide, index) => (
                    <SortableSlideCard
                      key={slide.id}
                      slide={slide}
                      index={index}
                      mediaById={mediaById}
                      themeById={themeById}
                      activeTheme={activePresentationTheme}
                      isSelected={selectedSlideIndex === index}
                      onSelect={() => {
                        setSelectedSlideIndex(index)
                        const topItem = [...(slide.items || [])]
                          .sort((a, b) => Number(a.layer || 0) - Number(b.layer || 0))
                          .at(-1)
                        setSelectedItemId(topItem?.id)
                      }}
                    />
                  ))}

                  <Card
                    className="w-36 shrink-0 p-1.5 h-full min-h-24 border-dashed cursor-pointer hover:border-primary/70 transition-colors"
                    onClick={addEmptySlide}
                  >
                    <div className="h-full min-h-16 flex flex-col items-center justify-center text-muted-foreground gap-1.5">
                      <Plus className="size-5" />
                      <span className="text-xs">Nueva diapositiva</span>
                    </div>
                  </Card>
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="shrink-0 rounded-md border bg-background/70 px-2 py-1.5 flex items-center gap-2">
            <Label className="text-xs text-muted-foreground shrink-0">Zoom</Label>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-7"
              onClick={() => setCanvasZoom((current) => clampCanvasZoom(current - 10))}
              aria-label="Reducir zoom del canvas"
            >
              <Minus className="size-4" />
            </Button>
            <Slider
              value={[canvasZoom]}
              min={minCanvasZoom}
              max={maxCanvasZoom}
              step={5}
              className="w-40"
              onValueChange={(value) => setCanvasZoom(clampCanvasZoom(value[0] ?? 100))}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-7"
              onClick={() => setCanvasZoom((current) => clampCanvasZoom(current + 10))}
              aria-label="Aumentar zoom del canvas"
            >
              <PlusIcon className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums w-11 text-right">
              {canvasZoom}%
            </span>
          </div>
        </div>
      </div>

      <MediaPicker
        open={isMediaPickerOpen}
        onOpenChange={setIsMediaPickerOpen}
        onSelect={handleSelectMedia}
        title="Seleccionar imagen o video"
      />

      <BibleTextPicker
        open={isBiblePickerOpen}
        onOpenChange={setIsBiblePickerOpen}
        onAddToPresentation={handleAddBibleToPresentation}
      />

      <ThemePicker
        open={isThemePickerOpen}
        onOpenChange={setIsThemePickerOpen}
        themes={themes}
        selectedThemeId={globalThemeId}
        onSelect={applyGlobalTheme}
      />
    </div>
  )
}
