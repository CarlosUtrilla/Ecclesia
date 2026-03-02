import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  BookText,
  ChevronDown,
  Copy,
  FileImage,
  Plus,
  Save,
  TextCursorInput,
  Trash2
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
import { MediaPicker } from '@/screens/panels/library/media/exports'
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
  createTextSlide,
  ensureSlideItems,
  parseCanvasItemStyle,
  PresentationSlide
} from './utils/slideUtils'
import { BibleSlideControls, MediaSlideControls } from './components/slideControls'

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
  const shouldSeedHistoryRef = useRef(false)

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
  const selectedSlide = slides[selectedSlideIndex]

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
          items: ensureSlideItems(slide)
        })
      )

      reset({
        title: presentation.title,
        slides: normalizedSlides.length > 0 ? normalizedSlides : [createTextSlide()]
      })
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
    updateSelectedItemLayer,
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

  return (
    <div className="min-h-screen max-h-screen flex flex-col overflow-hidden">
      <div className="flex-shrink-0">
        <title>Editor de presentaciones</title>
        <div className="p-2 flex items-center gap-1 border-b flex-wrap">
          <div>
            <Input
              placeholder="Título de la presentación"
              className="!bg-background"
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

          <div className="h-16 w-px mx-1 bg-border" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="gap-2">
                <Plus className="size-4" />
                Insertar
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

        {selectedItem && selectedItem.type !== 'MEDIA' && selectedItemStyle ? (
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
              offsetX: selectedItemStyle.x - 220,
              offsetY: selectedItemStyle.y - 180
            }}
            onChange={(updates) => updateSelectedTextStyle(updates)}
            onInsertMedia={insertMediaItem}
          />
        ) : null}

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

        {selectedItem && selectedItemStyle ? (
          <div className="p-2 border-b flex items-center gap-2 flex-wrap">
            <Label className="text-xs text-muted-foreground">Elemento</Label>
            <Button size="sm" variant="outline" onClick={() => updateSelectedItemLayer('down')}>
              <ArrowDown className="size-4" />
              Bajar capa
            </Button>
            <Button size="sm" variant="outline" onClick={() => updateSelectedItemLayer('up')}>
              <ArrowUp className="size-4" />
              Subir capa
            </Button>
            <Button size="sm" variant="outline" onClick={duplicateSelectedItem}>
              <Copy className="size-4" />
              Duplicar
            </Button>
            <Button size="sm" variant="destructive" onClick={removeSelectedItem}>
              <Trash2 className="size-4" />
              Eliminar item
            </Button>
            <span className="text-xs text-muted-foreground">Rotación</span>
            <Slider
              value={[selectedItemStyle.rotation]}
              min={-180}
              max={180}
              step={1}
              className="w-36"
              onValueChange={(value) => updateSelectedItemStyle({ rotation: value[0] ?? 0 })}
            />
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 bg-muted flex items-center justify-center p-4 overflow-auto">
        <div className="w-full max-w-6xl aspect-video">
          {selectedSlide ? (
            <EditorCanvas
              slide={selectedSlide}
              mediaById={mediaById}
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

      <div className="flex-shrink-0 p-3 bg-muted/50 flex items-center gap-2 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSlidesDragEnd}
        >
          <SortableContext items={slideSortableIndex} strategy={horizontalListSortingStrategy}>
            <div className="flex items-center gap-2">
              {slides.map((slide, index) => (
                <SortableSlideCard
                  key={slide.id}
                  slide={slide}
                  index={index}
                  mediaById={mediaById}
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
                className="w-56 shrink-0 p-2 h-full min-h-36 border-dashed cursor-pointer hover:border-primary/70 transition-colors"
                onClick={addEmptySlide}
              >
                <div className="h-full min-h-28 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Plus className="size-6" />
                  <span className="text-sm">Nueva diapositiva</span>
                </div>
              </Card>
            </div>
          </SortableContext>
        </DndContext>
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
    </div>
  )
}
