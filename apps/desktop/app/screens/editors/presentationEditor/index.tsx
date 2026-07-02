import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams } from 'react-router-dom'
import { Plus, TextCursorInput, Zap } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { Media } from '@ecclesia/api'
import {
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'

import { AnimationSettings, defaultAnimationSettings, easingOptions } from '@/lib/animationSettings'
import { BlankTheme, useThemes } from '@/hooks/useThemes'
import { resolvePresentationSlideTheme } from '@/lib/presentationSlides'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs'
import { PresentationSchema, PresentationFormValues } from './schema'
import EditorCanvas from './components/editorCanvas'
import EditorTopBar from './components/editorTopBar'
import SlideTray from './components/slideTray'
import EditorDialogs from './components/editorDialogs'
import TextTabContent from './components/textTabContent'
import AnimationTabContent from './components/animationTabContent'
import InsertTabContent from './components/insertTabContent'
import usePresentationEditorShortcuts from './hooks/usePresentationEditorShortcuts'
import usePresentationEditorActions from './hooks/usePresentationEditorActions'
import usePresentationEditorHistory, {
  PresentationEditorHistorySnapshot
} from './hooks/usePresentationEditorHistory'
import { parseBibleAccessData } from './utils/bibleAccessData'
import { cloneClipboardItems, getPastedImagePayload } from './utils/presentationClipboard'
import {
  buildPrimaryItemFromSlide,
  BASE_CANVAS_HEIGHT,
  BASE_CANVAS_WIDTH,
  cloneSlideForDuplication,
  createMediaSlide,
  createSlideItem,
  createTextSlide,
  defaultTransitionSettingsString,
  ensureSlideItems,
  getNextLayer,
  parseCanvasItemStyle,
  PresentationSlide,
  PresentationSlideItem
} from './utils/slideUtils'
import { Api } from '@ecclesia/queries'

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
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false)
  const [mediaPickerMode, setMediaPickerMode] = useState<'insert-current' | 'replace-current'>(
    'insert-current'
  )
  const [isBiblePickerOpen, setIsBiblePickerOpen] = useState(false)
  const [isCanvasDragging, setIsCanvasDragging] = useState(false)
  const [animationPreviewKey, setAnimationPreviewKey] = useState(0)
  const [canvasZoom, setCanvasZoom] = useState(100)
  const [globalThemeId, setGlobalThemeId] = useState<number | null>(() => {
    if (!isCreating) return null
    try {
      const raw = localStorage.getItem('presentation-editor-last-theme-id')
      if (raw === null) return null
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : null
    } catch {
      return null
    }
  })
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [renameSlideDialogOpen, setRenameSlideDialogOpen] = useState(false)
  const [renameSlideIndex, setRenameSlideIndex] = useState<number | null>(null)
  const [renameSlideName, setRenameSlideName] = useState('')
  const [isSlideTrayHovered, setIsSlideTrayHovered] = useState(false)
  const [activeInspectorTab, setActiveInspectorTab] = useState<'texto' | 'animar' | 'insertar'>(
    'texto'
  )
  const copiedItemsRef = useRef<PresentationSlideItem[]>([])
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
    formState: { isDirty, isSubmitting }
  } = form

  const title = watch('title')
  const slides = watch('slides')
  const themeById = useMemo(() => new Map(themes.map((theme) => [theme.id, theme])), [themes])
  const selectedSlide = slides[selectedSlideIndex]
  const activePresentationTheme = useMemo(
    () => (globalThemeId === null ? BlankTheme : (themeById.get(globalThemeId) ?? BlankTheme)),
    [globalThemeId, themeById]
  )
  const selectedSlideTheme = useMemo(
    () => (selectedSlide ? resolvePresentationSlideTheme(selectedSlide, themeById) : undefined),
    [selectedSlide, themeById]
  )
  const editorCanvasTheme = selectedSlideTheme ?? activePresentationTheme

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

  const { fields, append, move, insert, remove } = useFieldArray({
    control: form.control,
    name: 'slides'
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const { data: media = [], refetch: refetchMedia } = useQuery({
    queryKey: ['media', 'presentation-editor'],
    queryFn: async () => {
      const all = await Api.fetch.media.findAll()
      return all.items as Media[]
    }
  })

  const slideSortableIndex = useMemo(() => slides.map((slide) => slide.id), [slides])

  const slideMediaIds = useMemo(() => {
    const ids = new Set<number>()
    for (const slide of slides) {
      if (slide.mediaId) ids.add(slide.mediaId)
      if (slide.items) {
        for (const item of slide.items) {
          if (item.type === 'MEDIA' && item.accessData) {
            const id = Number(item.accessData)
            if (Number.isFinite(id)) ids.add(id)
          }
        }
      }
    }
    return Array.from(ids)
  }, [slides])

  const { data: extraSlideMedia = [] } = useQuery({
    queryKey: ['presentation-extra-media', id, ...slideMediaIds],
    queryFn: async () => {
      if (slideMediaIds.length === 0) return []
      const result = await Api.fetch.media.getMediaByIds({ body: { ids: slideMediaIds } })
      return result as Media[]
    },
    enabled: slideMediaIds.length > 0
  })

  const mediaById = useMemo(() => {
    const map = new Map(media.map((item: Media) => [item.id, item]))
    for (const item of extraSlideMedia) {
      if (!map.has(item.id)) {
        map.set(item.id, item)
      }
    }
    return map
  }, [media, extraSlideMedia])

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('presentation-close-requested', () => {
      if (!isDirty) {
        window.windowAPI.confirmPresentationClose()
        return
      }

      setShowCloseDialog(true)
    })

    return () => {
      unsubscribe()
    }
  }, [isDirty])

  const presentationQuery = useQuery({
    queryKey: ['presentation', id],
    queryFn: async () => {
      if (isCreating || !id) return null

      const presentation = await Api.fetch.presentations.getPresentationById({
        body: { id: Number(id) }
      })
      if (!presentation) return null

      const normalizedSlides = (presentation.slides as PresentationFormValues['slides']).map(
        (slide) => ({
          ...slide,
          videoLoop: slide.videoLoop === true,
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
    enabled: !isCreating,
    refetchOnWindowFocus: false
  })

  useEffect(() => {
    if (!selectedSlide) return

    const normalizedItems = ensureSlideItems(selectedSlide)
    if ((selectedSlide.items || []).length !== normalizedItems.length) {
      setValue(`slides.${selectedSlideIndex}.items`, normalizedItems, { shouldDirty: true })
      const fallbackItemId = normalizedItems[normalizedItems.length - 1]?.id
      setSelectedItemId(fallbackItemId)
      setSelectedItemIds(fallbackItemId ? [fallbackItemId] : [])
      return
    }

    const normalizedItemIdSet = new Set(normalizedItems.map((item) => item.id))
    const nextSelectedIds = selectedItemIds.filter((itemId) => normalizedItemIdSet.has(itemId))

    if (nextSelectedIds.length !== selectedItemIds.length) {
      setSelectedItemIds(nextSelectedIds)
    }

    if (!selectedItemId || !normalizedItemIdSet.has(selectedItemId)) {
      const topItem = [...normalizedItems]
        .sort((a, b) => Number(a.layer || 0) - Number(b.layer || 0))
        .at(-1)
      const fallbackItemId = topItem?.id
      setSelectedItemId(fallbackItemId)
      setSelectedItemIds(fallbackItemId ? [fallbackItemId] : [])
      return
    }

    if (nextSelectedIds.length === 0 && selectedItemId) {
      setSelectedItemIds([selectedItemId])
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

  const handleCanvasSelection = (itemId?: string, options?: { toggle?: boolean }) => {
    if (!itemId) {
      setSelectedItemId(undefined)
      setSelectedItemIds([])
      return
    }

    if (options?.toggle) {
      setSelectedItemIds((current) => {
        if (current.includes(itemId)) {
          const next = current.filter((id) => id !== itemId)
          setSelectedItemId(next[next.length - 1])
          return next
        }

        const next = [...current, itemId]
        setSelectedItemId(itemId)
        return next
      })
      return
    }

    setSelectedItemId(itemId)
    setSelectedItemIds([itemId])
  }

  const copySelectedItem = () => {
    if (!selectedSlide) return

    const items = ensureSlideItems(selectedSlide)
    const selectedIds =
      selectedItemIds.length > 0 ? selectedItemIds : selectedItem ? [selectedItem.id] : []
    if (selectedIds.length === 0) return

    const selectedSet = new Set(selectedIds)
    copiedItemsRef.current = items
      .filter((item) => selectedSet.has(item.id))
      .sort((a, b) => Number(a.layer || 0) - Number(b.layer || 0))
      .map((item) => JSON.parse(JSON.stringify(item)) as PresentationSlideItem)
  }

  const pasteCopiedItem = () => {
    if (!selectedSlide) return false

    const copiedItems = copiedItemsRef.current
    if (copiedItems.length === 0) return false

    const items = ensureSlideItems(selectedSlide)
    const duplicatedItems = cloneClipboardItems({
      copiedItems,
      existingItems: items
    })
    if (duplicatedItems.length === 0) return false

    setValue(`slides.${selectedSlideIndex}.items`, [...items, ...duplicatedItems], {
      shouldDirty: true
    })

    const duplicatedIds = duplicatedItems.map((item) => item.id)
    setSelectedItemIds(duplicatedIds)
    setSelectedItemId(duplicatedIds[duplicatedIds.length - 1])
    return true
  }

  const handlePasteInEditor = async (event: ClipboardEvent) => {
    const imagePayload = await getPastedImagePayload(event)
    if (imagePayload) {
      event.preventDefault()

      try {
        const formData = new FormData()
        const blob = new Blob([imagePayload.bytes], { type: imagePayload.mimeType })
        const ext = imagePayload.mimeType.split('/')[1] || 'png'
        formData.append('file', blob, `clipboard-${Date.now()}.${ext}`)
        const result = await Api.fetch.media.importFile(formData)
        const [mediaRecord] = result
        const mediaId = Number(mediaRecord.id)

        if (!Number.isFinite(mediaId) || mediaId <= 0) return

        if (!selectedSlide) {
          append(createMediaSlide(mediaId, globalThemeId))
          setSelectedSlideIndex(fields.length)
          setSelectedItemId(undefined)
          setSelectedItemIds([])
        } else {
          const items = ensureSlideItems(selectedSlide)
          const newItem = createSlideItem('MEDIA', {
            accessData: String(mediaId),
            layer: getNextLayer(items)
          })

          setValue(`slides.${selectedSlideIndex}.items`, [...items, newItem], {
            shouldDirty: true
          })
          setSelectedItemId(newItem.id)
          setSelectedItemIds([newItem.id])
        }

        return
      } catch (error) {
        console.error('No se pudo importar la imagen pegada:', error)
        return
      }
    }

    if (pasteCopiedItem()) {
      event.preventDefault()
    }
  }

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
      setSelectedItemIds(snapshot.selectedItemId ? [snapshot.selectedItemId] : [])
    },
    isCapturePaused: isCanvasDragging
  })

  useEffect(() => {
    if (!selectedItemId) {
      if (selectedItemIds.length > 0) {
        setSelectedItemIds([])
      }
      return
    }

    if (selectedItemIds.length === 0) {
      setSelectedItemIds([selectedItemId])
    }
  }, [selectedItemId, selectedItemIds])

  useEffect(() => {
    if (!shouldSeedHistoryRef.current) return
    seedHistory(historySnapshot)
    shouldSeedHistoryRef.current = false
  }, [historySnapshot, seedHistory])

  // Calcula el zoom inicial para que el canvas ocupe el 90% del contenedor disponible
  useEffect(() => {
    const container = previewAreaRef.current
    if (!container) return

    const style = getComputedStyle(container)
    const paddingH = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
    const paddingV = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    // El wrapper interior tiene p-2 (8px por lado = 16px por eje)
    const wrapperPadding = 16

    const availableWidth = container.clientWidth - paddingH - wrapperPadding
    const availableHeight = container.clientHeight - paddingV - wrapperPadding

    const zoomToFitWidth = availableWidth / BASE_CANVAS_WIDTH
    const zoomToFitHeight = availableHeight / BASE_CANVAS_HEIGHT
    const zoomToFit = Math.min(zoomToFitWidth, zoomToFitHeight)

    // 90% del zoom de ajuste, redondeado al múltiplo de 5 más cercano
    const raw = Math.round((zoomToFit * 100 * 0.9) / 5) * 5
    setCanvasZoom(Math.min(maxCanvasZoom, Math.max(minCanvasZoom, raw)))
  }, [])

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
    insertShapeInCurrentSlide,
    addEmptySlide,
    importCanvaAssetsAsSlides,
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
    slides,
    slidesLength: slides.length,
    fieldsLength: fields.length,
    setValue,
    appendSlide: append,
    setSelectedSlideIndex,
    setSelectedItemId,
    setMediaPickerMode,
    setIsMediaPickerOpen
  })

  const focusTextInspectorTab = () => {
    setActiveInspectorTab('texto')
  }

  const handleInsertTextAndFocus = () => {
    insertTextInCurrentSlide()
    focusTextInspectorTab()
  }

  const handleInsertShapeAndFocus = (
    shapeType: Parameters<typeof insertShapeInCurrentSlide>[0]
  ) => {
    insertShapeInCurrentSlide(shapeType)
    focusTextInspectorTab()
  }

  const handleInsertMediaAndFocus = () => {
    insertMediaItem()
    focusTextInspectorTab()
  }

  const handleSelectMediaAndFocus = (selectedMedia: Media) => {
    handleSelectMedia(selectedMedia)
    focusTextInspectorTab()
  }

  const handleAddBibleToPresentationAndFocus = (
    selection: Parameters<typeof handleAddBibleToPresentation>[0]
  ) => {
    handleAddBibleToPresentation(selection)
    focusTextInspectorTab()
  }

  usePresentationEditorShortcuts({
    hasSelectedItem: selectedItemIds.length > 0 || Boolean(selectedItem),
    hasSelectedSlide: slides.length > 0,
    preferSlideShortcuts: isSlideTrayHovered,
    onDelete: removeSelectedItem,
    onDeleteSlide: () => {
      if (selectedSlideIndex < 0 || selectedSlideIndex >= slides.length) return

      if (slides.length <= 1) {
        setValue('slides', [createTextSlide(globalThemeId)], { shouldDirty: true })
        setSelectedSlideIndex(0)
        setSelectedItemId(undefined)
        setSelectedItemIds([])
        return
      }

      remove(selectedSlideIndex)
      const nextIndex = Math.max(0, Math.min(selectedSlideIndex, slides.length - 2))
      setSelectedSlideIndex(nextIndex)
      setSelectedItemId(undefined)
      setSelectedItemIds([])
    },
    onDuplicate: duplicateSelectedItem,
    onUndo: undoHistory,
    onRedo: redoHistory,
    onCopy: copySelectedItem,
    onPaste: (event) => {
      void handlePasteInEditor(event)
    }
  })

  const handleSelectedItemAnimationChange = (settings: AnimationSettings) => {
    if (!selectedItem) return
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
          videoLoop: slide.videoLoop === true,
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
      await Api.fetch.presentations.createPresentation({ body: normalizedValues })
    } else {
      await Api.fetch.presentations.updatePresentation({
        body: { id: Number(id), data: normalizedValues }
      })
    }

    window.windowAPI.confirmPresentationClose()
  })

  const handleCloseDiscard = () => {
    setShowCloseDialog(false)
    window.windowAPI.confirmPresentationClose()
  }

  const handleCloseCancel = () => {
    setShowCloseDialog(false)
  }

  const handleCloseSave = () => {
    setShowCloseDialog(false)

    if (!title.trim()) {
      setSaveName(title)
      setSaveDialogOpen(true)
      return
    }

    void onSave()
  }

  const applyGlobalTheme = (nextThemeId: number | null) => {
    setGlobalThemeId(nextThemeId)
    try {
      if (nextThemeId !== null) {
        localStorage.setItem('presentation-editor-last-theme-id', String(nextThemeId))
      } else {
        localStorage.removeItem('presentation-editor-last-theme-id')
      }
    } catch {
      // localStorage no disponible
    }
    setValue(
      'slides',
      slides.map((slide) => ({
        ...slide,
        themeId: nextThemeId
      })),
      { shouldDirty: true }
    )
  }

  const insertEmptySlideAt = (targetIndex: number) => {
    const clampedIndex = Math.max(0, Math.min(targetIndex, slides.length))
    insert(clampedIndex, createTextSlide(globalThemeId))
    setSelectedSlideIndex(clampedIndex)
    setSelectedItemId(undefined)
  }

  const deleteSlideAt = (index: number) => {
    if (slides.length <= 1) {
      setValue('slides', [createTextSlide(globalThemeId)], { shouldDirty: true })
      setSelectedSlideIndex(0)
      setSelectedItemId(undefined)
      return
    }

    remove(index)
    const nextIndex = Math.max(0, Math.min(index, slides.length - 2))
    setSelectedSlideIndex(nextIndex)
    setSelectedItemId(undefined)
  }

  const duplicateSlideAt = (index: number) => {
    const sourceSlide = slides[index]
    if (!sourceSlide) return

    const duplicated = cloneSlideForDuplication(sourceSlide)
    insert(index + 1, duplicated)
    setSelectedSlideIndex(index + 1)
    const topItem = [...(duplicated.items || [])]
      .sort((a, b) => Number(a.layer || 0) - Number(b.layer || 0))
      .at(-1)
    setSelectedItemId(topItem?.id)
  }

  const renameSlideAt = (index: number) => {
    const currentSlide = slides[index]
    if (!currentSlide) return

    setRenameSlideIndex(index)
    setRenameSlideName(currentSlide.slideName?.trim() || '')
    setRenameSlideDialogOpen(true)
  }

  const handleRenameSlide = () => {
    if (renameSlideIndex === null) return

    const trimmed = renameSlideName.trim()
    setValue(`slides.${renameSlideIndex}.slideName`, trimmed.length > 0 ? trimmed : undefined, {
      shouldDirty: true
    })

    setRenameSlideDialogOpen(false)
    setRenameSlideIndex(null)
    setRenameSlideName('')
  }

  const handleRenameSlideDialogChange = (isOpen: boolean) => {
    setRenameSlideDialogOpen(isOpen)

    if (!isOpen) {
      setRenameSlideIndex(null)
      setRenameSlideName('')
    }
  }

  const handleSelectedSlideBackgroundChange = (nextColor: string) => {
    if (!selectedSlide) return

    setValue(`slides.${selectedSlideIndex}.backgroundColor`, nextColor, {
      shouldDirty: true
    })
  }

  const handleResetSelectedSlideBackground = () => {
    if (!selectedSlide) return

    setValue(`slides.${selectedSlideIndex}.backgroundColor`, undefined, {
      shouldDirty: true
    })
  }

  return (
    <div className="min-h-screen max-h-screen flex flex-col overflow-hidden">
      <title>Editor de presentaciones</title>

      <EditorTopBar
        title={title}
        onOpenSaveDialog={() => {
          setShowCloseDialog(false)
          setSaveDialogOpen(true)
          setSaveName(title || '')
        }}
        onUndo={undoHistory}
        onRedo={redoHistory}
        selectedSlide={selectedSlide}
        onSlideBackgroundChange={handleSelectedSlideBackgroundChange}
        onResetSlideBackground={handleResetSelectedSlideBackground}
        globalThemeId={globalThemeId}
        themes={themes}
        onOpenThemePicker={() => setIsThemePickerOpen(true)}
      />

      {/* ── MIDDLE: SIDEBAR + CANVAS ─────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT SIDEBAR */}
        <aside className="w-[280px] border-r flex flex-col shrink-0 bg-background">
          <Tabs
            value={activeInspectorTab}
            onValueChange={(value) =>
              setActiveInspectorTab(value as 'texto' | 'animar' | 'insertar')
            }
            className="flex flex-col flex-1 min-h-0 gap-0"
          >
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
              <TextTabContent
                selectedItem={selectedItem}
                selectedItemStyle={selectedItemStyle}
                selectedSlide={selectedSlide}
                selectedMediaId={selectedMediaId}
                media={media}
                updateSelectedTextStyle={updateSelectedTextStyle}
                updateSelectedItem={updateSelectedItem}
                loadBibleText={loadBibleText}
                replaceSelectedMedia={replaceSelectedMedia}
                onVideoLiveBehaviorChange={(value) => {
                  setValue(`slides.${selectedSlideIndex}.videoLiveBehavior`, value, {
                    shouldDirty: true
                  })
                }}
                onVideoLoopChange={(value) => {
                  setValue(`slides.${selectedSlideIndex}.videoLoop`, value, {
                    shouldDirty: true
                  })
                }}
              />
            </TabsContent>

            {/* TAB: ANIMAR */}
            <TabsContent value="animar" className="flex-1 overflow-y-auto m-0">
              <AnimationTabContent
                selectedItem={selectedItem}
                selectedSlide={selectedSlide}
                selectedItemAnimationSettings={selectedItemAnimationSettings}
                selectedSlideTransitionSettings={selectedSlideTransitionSettings}
                easingOptions={easingOptions}
                onSelectedItemAnimationChange={handleSelectedItemAnimationChange}
                onSelectedSlideTransitionChange={handleSelectedSlideTransitionChange}
                onAnimationPreview={handleAnimationPreview}
              />
            </TabsContent>

            {/* TAB: INSERTAR */}
            <TabsContent value="insertar" className="flex-1 overflow-y-auto m-0 p-3">
              <InsertTabContent
                onInsertText={handleInsertTextAndFocus}
                onOpenBiblePicker={() => setIsBiblePickerOpen(true)}
                onInsertMedia={handleInsertMediaAndFocus}
                onInsertShape={handleInsertShapeAndFocus}
                onImportCanvaSlides={importCanvaAssetsAsSlides}
              />
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
              setSelectedItemIds([])
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
                    theme={editorCanvasTheme}
                    canvasScale={zoomScale}
                    animationPreviewKey={animationPreviewKey}
                    selectedItemIds={selectedItemIds}
                    selectedItemId={selectedItemId}
                    onSelectItem={handleCanvasSelection}
                    onCopySelection={copySelectedItem}
                    onPasteSelection={() => {
                      pasteCopiedItem()
                    }}
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

      <SlideTray
        slides={slides}
        selectedSlideIndex={selectedSlideIndex}
        onSelectSlide={(index) => {
          setSelectedSlideIndex(index)
          const topItem = [...(slides[index]?.items || [])]
            .sort((a, b) => Number(a.layer || 0) - Number(b.layer || 0))
            .at(-1)
          setSelectedItemId(topItem?.id)
          setSelectedItemIds(topItem?.id ? [topItem.id] : [])
        }}
        onAddEmptySlide={addEmptySlide}
        onInsertEmptySlideAt={insertEmptySlideAt}
        onDuplicateSlide={duplicateSlideAt}
        onDeleteSlide={deleteSlideAt}
        onRenameSlide={renameSlideAt}
        onSlidesDragEnd={handleSlidesDragEnd}
        mediaById={mediaById}
        themeById={themeById}
        activePresentationTheme={activePresentationTheme}
        canvasZoom={canvasZoom}
        onZoomChange={setCanvasZoom}
        onHoverChange={setIsSlideTrayHovered}
      />
      <EditorDialogs
        saveDialogOpen={saveDialogOpen}
        onSaveDialogOpenChange={setSaveDialogOpen}
        saveName={saveName}
        onSaveNameChange={setSaveName}
        onSave={() => {
          setValue('title', saveName, { shouldDirty: true })
          onSave()
          setSaveDialogOpen(false)
        }}
        isSubmitting={isSubmitting}
        showCloseDialog={showCloseDialog}
        onCloseDiscard={handleCloseDiscard}
        onCloseCancel={handleCloseCancel}
        onCloseSave={handleCloseSave}
        renameSlideDialogOpen={renameSlideDialogOpen}
        onRenameSlideDialogOpenChange={handleRenameSlideDialogChange}
        renameSlideName={renameSlideName}
        onRenameSlideNameChange={setRenameSlideName}
        onRenameSlide={handleRenameSlide}
        renameSlidePlaceholder={
          renameSlideIndex !== null
            ? `Diapositiva ${renameSlideIndex + 1}`
            : 'Nombre de la diapositiva'
        }
        isMediaPickerOpen={isMediaPickerOpen}
        onMediaPickerOpenChange={setIsMediaPickerOpen}
        onMediaPickerSelect={handleSelectMediaAndFocus}
        isBiblePickerOpen={isBiblePickerOpen}
        onBiblePickerOpenChange={setIsBiblePickerOpen}
        onBiblePickerAdd={handleAddBibleToPresentationAndFocus}
        isThemePickerOpen={isThemePickerOpen}
        onThemePickerOpenChange={setIsThemePickerOpen}
        themes={themes}
        globalThemeId={globalThemeId}
        onThemePickerSelect={applyGlobalTheme}
      />
    </div>
  )
}
