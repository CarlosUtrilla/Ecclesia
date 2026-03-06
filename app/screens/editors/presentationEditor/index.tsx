import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams } from 'react-router-dom'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Bold,
  BookText,
  FileImage,
  Italic,
  Minus,
  Palette,
  Play,
  Plus as PlusIcon,
  Plus,
  Redo2,
  Save,
  TextCursorInput,
  Underline as UnderlineIcon,
  Undo2,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/ui/dialog'
import { Card } from '@/ui/card'
import { Slider } from '@/ui/slider'
import { Label } from '@/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import {
  AnimationSettings,
  defaultAnimationSettings,
  easingOptions,
  EasingType
} from '@/lib/animationSettings'
import { BlankTheme, useThemes } from '@/hooks/useThemes'
import { MediaPicker } from '@/screens/panels/library/media/exports'
import ThemePicker from './themePicker'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs'
import { ColorPicker } from '@/ui/colorPicker'
import FontFamilySelector from '@/ui/fontFamilySelector'
import { animations } from '@/lib/animations'
import { cn } from '@/lib/utils'
import FormatLineSpacingIcon from '@/icons/line-spacing'
import LetterSpacingIcon from '@/icons/letter-spacing'
import { PresentationSchema, PresentationFormValues } from './schema'
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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
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
      <title>Editor de presentaciones</title>

      {/* ── TOP BAR ─────────────────────────────────────────────────── */}
      <div className="h-10 px-3 flex items-center gap-1 border-b bg-background shrink-0">
        <button
          type="button"
          onClick={() => {
            setSaveDialogOpen(true)
            setSaveName(title || '')
          }}
          className="flex items-center gap-1.5 px-2 h-7 rounded hover:bg-muted transition-colors max-w-[200px] shrink-0"
          title="Haz clic para guardar o renombrar"
        >
          <Save className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{title || 'Sin título'}</span>
        </button>

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={undoHistory}
          title="Deshacer (Ctrl+Z)"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={redoHistory}
          title="Rehacer (Ctrl+Y)"
        >
          <Redo2 className="size-4" />
        </Button>

        <div className="flex-1" />

        {selectedSlide ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs shrink-0"
              onClick={() => setIsThemePickerOpen(true)}
            >
              <Palette className="size-3.5" />
              {globalThemeId === null
                ? 'Sin tema'
                : (themes.find((t) => t.id === globalThemeId)?.name ?? 'Tema')}
            </Button>
          </>
        ) : null}
      </div>
      {/* ── Fin top bar ────────────────────────────────────────────────── */}

      {/* ── MIDDLE: SIDEBAR + CANVAS ─────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT SIDEBAR */}
        <aside className="w-[280px] border-r flex flex-col shrink-0 bg-background">
          <Tabs defaultValue="texto" className="flex flex-col flex-1 min-h-0 gap-0">
            <TabsList className="w-full rounded-none border-b h-10 bg-transparent p-0">
              <TabsTrigger
                value="texto"
                className="flex-1 h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary gap-1.5 text-xs"
              >
                <TextCursorInput className="size-3.5" />
                Texto
              </TabsTrigger>
              <TabsTrigger
                value="animar"
                className="flex-1 h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary gap-1.5 text-xs"
              >
                <Zap className="size-3.5" />
                Animar
              </TabsTrigger>
              <TabsTrigger
                value="insertar"
                className="flex-1 h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary gap-1.5 text-xs"
              >
                <Plus className="size-3.5" />
                Insertar
              </TabsTrigger>
            </TabsList>

            {/* TAB: TEXTO */}
            <TabsContent value="texto" className="flex-1 overflow-y-auto m-0">
              {selectedItem &&
              selectedItemStyle &&
              (selectedItem.type === 'TEXT' ||
                selectedItem.type === 'BIBLE' ||
                selectedItem.type === 'SONG' ||
                selectedItem.type === 'GROUP') ? (
                <div className="p-3 flex flex-col gap-4">
                  {/* FUENTE */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Fuente
                    </span>
                    <FontFamilySelector
                      value={selectedItemStyle.fontFamily || 'Arial'}
                      onChange={(fontFamily) => updateSelectedTextStyle({ fontFamily })}
                      className="w-full"
                    />
                  </div>

                  {/* TAMAÑO */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Tamaño
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 shrink-0"
                        onClick={() =>
                          updateSelectedTextStyle({
                            fontSize: Math.max(1, (selectedItemStyle.fontSize || 24) - 1)
                          })
                        }
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <Input
                        type="number"
                        containerClassName="w-auto flex-1"
                        className="h-8 text-center"
                        value={selectedItemStyle.fontSize || 24}
                        onChange={(e) =>
                          updateSelectedTextStyle({ fontSize: Number(e.target.value) })
                        }
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 shrink-0"
                        onClick={() =>
                          updateSelectedTextStyle({
                            fontSize: (selectedItemStyle.fontSize || 24) + 1
                          })
                        }
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* ESTILO */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Estilo
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant={selectedItemStyle.fontWeight === 'bold' ? 'default' : 'outline'}
                        className="h-8 w-8"
                        title="Negrita"
                        onClick={() =>
                          updateSelectedTextStyle({
                            fontWeight: selectedItemStyle.fontWeight === 'bold' ? 'normal' : 'bold'
                          })
                        }
                      >
                        <Bold className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant={selectedItemStyle.fontStyle === 'italic' ? 'default' : 'outline'}
                        className="h-8 w-8"
                        title="Cursiva"
                        onClick={() =>
                          updateSelectedTextStyle({
                            fontStyle:
                              selectedItemStyle.fontStyle === 'italic' ? 'normal' : 'italic'
                          })
                        }
                      >
                        <Italic className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant={
                          selectedItemStyle.textDecoration === 'underline' ? 'default' : 'outline'
                        }
                        className="h-8 w-8"
                        title="Subrayado"
                        onClick={() =>
                          updateSelectedTextStyle({
                            textDecoration:
                              selectedItemStyle.textDecoration === 'underline'
                                ? 'none'
                                : 'underline'
                          })
                        }
                      >
                        <UnderlineIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* ALINEACIÓN HORIZONTAL */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Alineación horizontal
                    </span>
                    <div className="flex gap-1">
                      {(
                        [
                          { value: 'left', Icon: AlignLeft, label: 'Izquierda' },
                          { value: 'center', Icon: AlignCenter, label: 'Centro' },
                          { value: 'right', Icon: AlignRight, label: 'Derecha' },
                          { value: 'justify', Icon: AlignJustify, label: 'Justificado' }
                        ] as const
                      ).map(({ value, Icon, label }) => (
                        <Button
                          key={value}
                          type="button"
                          size="icon"
                          variant={selectedItemStyle.textAlign === value ? 'default' : 'outline'}
                          className="h-8 w-8"
                          title={label}
                          onClick={() => updateSelectedTextStyle({ textAlign: value })}
                        >
                          <Icon className="size-3.5" />
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* ALINEACIÓN VERTICAL */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Alineación vertical
                    </span>
                    <div className="flex gap-1">
                      {(
                        [
                          { value: 'top', Icon: AlignVerticalJustifyStart, label: 'Arriba' },
                          { value: 'center', Icon: AlignVerticalJustifyCenter, label: 'Centro' },
                          { value: 'bottom', Icon: AlignVerticalJustifyEnd, label: 'Abajo' }
                        ] as const
                      ).map(({ value, Icon, label }) => (
                        <Button
                          key={value}
                          type="button"
                          size="icon"
                          variant={
                            selectedItemStyle.verticalAlign === value ? 'default' : 'outline'
                          }
                          className="h-8 w-8"
                          title={label}
                          onClick={() => updateSelectedTextStyle({ verticalAlign: value })}
                        >
                          <Icon className="size-3.5" />
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* ESPACIADO */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Espaciado
                    </span>
                    <div className="flex items-center gap-2">
                      <FormatLineSpacingIcon size={16} />
                      <span className="text-xs text-muted-foreground w-5 shrink-0">LH</span>
                      <Slider
                        value={[selectedItemStyle.lineHeight ?? 1.2]}
                        min={0.8}
                        max={3}
                        step={0.1}
                        className="flex-1"
                        onValueChange={([v]) => updateSelectedTextStyle({ lineHeight: v })}
                      />
                      <span className="text-xs tabular-nums w-7 text-right shrink-0">
                        {(selectedItemStyle.lineHeight ?? 1.2).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <LetterSpacingIcon size={16} />
                      <span className="text-xs text-muted-foreground w-5 shrink-0">LS</span>
                      <Slider
                        value={[selectedItemStyle.letterSpacing ?? 0]}
                        min={-5}
                        max={20}
                        step={0.5}
                        className="flex-1"
                        onValueChange={([v]) => updateSelectedTextStyle({ letterSpacing: v })}
                      />
                      <span className="text-xs tabular-nums w-7 text-right shrink-0">
                        {(selectedItemStyle.letterSpacing ?? 0).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* COLOR DE TEXTO */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Color de texto
                    </span>
                    <ColorPicker
                      value={selectedItemStyle.color || '#ffffff'}
                      onChange={(color) => updateSelectedTextStyle({ color })}
                      className="w-full h-9"
                    />
                  </div>

                  {/* REFERENCIA BÍBLICA */}
                  {selectedItem.type === 'BIBLE' &&
                    (() => {
                      const bible = parseBibleAccessData(selectedItem.accessData)
                      return (
                        <div className="flex flex-col gap-3 pt-2 border-t">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Referencia bíblica
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-muted-foreground">Libro</span>
                              <Input
                                type="number"
                                containerClassName="w-auto"
                                className="h-8 text-xs"
                                value={bible.bookId}
                                onChange={(e) =>
                                  updateSelectedItem({
                                    accessData: buildBibleAccessData({
                                      ...bible,
                                      bookId: Number(e.target.value)
                                    })
                                  })
                                }
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-muted-foreground">Capítulo</span>
                              <Input
                                type="number"
                                containerClassName="w-auto"
                                className="h-8 text-xs"
                                value={bible.chapter}
                                onChange={(e) =>
                                  updateSelectedItem({
                                    accessData: buildBibleAccessData({
                                      ...bible,
                                      chapter: Number(e.target.value)
                                    })
                                  })
                                }
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-muted-foreground">
                                Verso inicio
                              </span>
                              <Input
                                type="number"
                                containerClassName="w-auto"
                                className="h-8 text-xs"
                                value={bible.verseStart}
                                onChange={(e) =>
                                  updateSelectedItem({
                                    accessData: buildBibleAccessData({
                                      ...bible,
                                      verseStart: Number(e.target.value)
                                    })
                                  })
                                }
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-muted-foreground">Verso fin</span>
                              <Input
                                type="number"
                                containerClassName="w-auto"
                                className="h-8 text-xs"
                                value={bible.verseEnd || ''}
                                onChange={(e) =>
                                  updateSelectedItem({
                                    accessData: buildBibleAccessData({
                                      ...bible,
                                      verseEnd: e.target.value ? Number(e.target.value) : undefined
                                    })
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground">Versión</span>
                            <Input
                              containerClassName="w-auto"
                              className="h-8 text-xs"
                              value={bible.version}
                              onChange={(e) =>
                                updateSelectedItem({
                                  accessData: buildBibleAccessData({
                                    ...bible,
                                    version: e.target.value
                                  })
                                })
                              }
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-xs"
                            onClick={loadBibleText}
                          >
                            Cargar texto bíblico
                          </Button>
                        </div>
                      )
                    })()}
                </div>
              ) : selectedItem?.type === 'MEDIA' ? (
                <div className="p-3 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Imagen / Video
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-9 justify-start gap-2 text-xs"
                      onClick={replaceSelectedMedia}
                    >
                      <FileImage className="size-4" />
                      Cambiar archivo
                    </Button>
                    <Select
                      value={selectedMediaId ? String(selectedMediaId) : undefined}
                      onValueChange={(v) => updateSelectedItem({ accessData: v })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Seleccionar media" />
                      </SelectTrigger>
                      <SelectContent>
                        {media.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedSlide && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Reproducción en vivo
                      </span>
                      <Select
                        value={selectedSlide.videoLiveBehavior || 'manual'}
                        onValueChange={(value: 'auto' | 'manual') => {
                          setValue(`slides.${selectedSlideIndex}.videoLiveBehavior`, value, {
                            shouldDirty: true
                          })
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <Zap className="size-3.5 mr-1 shrink-0" />
                          <SelectValue placeholder="Video live" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Inicio manual</SelectItem>
                          <SelectItem value="auto">Inicio automático</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2 px-4">
                  <TextCursorInput className="size-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Selecciona un elemento de texto para editar sus propiedades
                  </p>
                </div>
              )}
            </TabsContent>

            {/* TAB: ANIMAR */}
            <TabsContent value="animar" className="flex-1 overflow-y-auto m-0">
              {selectedItem ? (
                <div className="p-3 flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Animación de elementos
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {animations.map((anim) => {
                        const AnimIcon = anim.icon
                        return (
                          <button
                            key={anim.value}
                            type="button"
                            className={cn(
                              'flex flex-col items-center gap-1.5 p-2 rounded-lg border text-center transition-colors',
                              selectedItemAnimationSettings.type === anim.value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/40 hover:bg-muted/50'
                            )}
                            onClick={() =>
                              handleSelectedItemAnimationChange({
                                ...selectedItemAnimationSettings,
                                type: anim.value
                              })
                            }
                          >
                            <AnimIcon className="size-5" />
                            <span className="text-[10px] leading-tight">{anim.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Duración */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Duración</span>
                      <span className="text-xs tabular-nums">
                        {selectedItemAnimationSettings.duration}s
                      </span>
                    </div>
                    <Slider
                      value={[selectedItemAnimationSettings.duration]}
                      min={0.1}
                      max={3}
                      step={0.1}
                      onValueChange={([v]) =>
                        handleSelectedItemAnimationChange({
                          ...selectedItemAnimationSettings,
                          duration: v
                        })
                      }
                    />
                  </div>

                  {/* Retraso */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Retraso</span>
                      <span className="text-xs tabular-nums">
                        {selectedItemAnimationSettings.delay}s
                      </span>
                    </div>
                    <Slider
                      value={[selectedItemAnimationSettings.delay]}
                      min={0}
                      max={2}
                      step={0.1}
                      onValueChange={([v]) =>
                        handleSelectedItemAnimationChange({
                          ...selectedItemAnimationSettings,
                          delay: v
                        })
                      }
                    />
                  </div>

                  {/* Easing */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">Easing</span>
                    <Select
                      value={selectedItemAnimationSettings.easing}
                      onValueChange={(v) =>
                        handleSelectedItemAnimationChange({
                          ...selectedItemAnimationSettings,
                          easing: v as EasingType
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {easingOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedItem.type !== 'MEDIA' && (
                    <Button size="sm" className="w-full" onClick={handleAnimationPreview}>
                      <Play className="size-3.5 mr-2" />
                      Previsualizar
                    </Button>
                  )}

                  {/* Transición de diapositivas */}
                  {selectedSlide && (
                    <div className="flex flex-col gap-3 pt-3 border-t">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Transición de diapositivas
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {animations.map((anim) => {
                          const AnimIcon = anim.icon
                          return (
                            <button
                              key={anim.value}
                              type="button"
                              className={cn(
                                'flex flex-col items-center gap-1.5 p-2 rounded-lg border text-center transition-colors',
                                selectedSlideTransitionSettings.type === anim.value
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border hover:border-primary/40 hover:bg-muted/50'
                              )}
                              onClick={() =>
                                handleSelectedSlideTransitionChange({
                                  ...selectedSlideTransitionSettings,
                                  type: anim.value
                                })
                              }
                            >
                              <AnimIcon className="size-5" />
                              <span className="text-[10px] leading-tight">{anim.label}</span>
                            </button>
                          )
                        })}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Duración</span>
                          <span className="text-xs tabular-nums">
                            {selectedSlideTransitionSettings.duration}s
                          </span>
                        </div>
                        <Slider
                          value={[selectedSlideTransitionSettings.duration]}
                          min={0.1}
                          max={3}
                          step={0.1}
                          onValueChange={([v]) =>
                            handleSelectedSlideTransitionChange({
                              ...selectedSlideTransitionSettings,
                              duration: v
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2 px-4">
                  <Zap className="size-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Selecciona un elemento para configurar su animación
                  </p>
                </div>
              )}
            </TabsContent>

            {/* TAB: INSERTAR */}
            <TabsContent value="insertar" className="flex-1 overflow-y-auto m-0 p-3">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Insertar elemento
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 justify-start gap-3"
                  onClick={insertTextInCurrentSlide}
                >
                  <TextCursorInput className="size-4" />
                  Texto libre
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 justify-start gap-3"
                  onClick={() => setIsBiblePickerOpen(true)}
                >
                  <BookText className="size-4" />
                  Versículo bíblico
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 justify-start gap-3"
                  onClick={insertMediaItem}
                >
                  <FileImage className="size-4" />
                  Imagen / Video
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        {/* CANVAS */}
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
                          entry.id === itemId ? { ...entry, text: nextText } : entry
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
      </div>

      {/* ── SLIDE TRAY + ZOOM ─────────────────────────────────────────── */}
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

      {/* ── DIALOGS ───────────────────────────────────────────────────── */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar presentación</DialogTitle>
            <DialogDescription>Escribe un nombre para la presentación.</DialogDescription>
          </DialogHeader>
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Nombre de la presentación"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setValue('title', saveName, { shouldDirty: true })
                onSave()
                setSaveDialogOpen(false)
              }
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() => {
                setValue('title', saveName, { shouldDirty: true })
                onSave()
                setSaveDialogOpen(false)
              }}
            >
              <Save className="size-4 mr-1.5" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
