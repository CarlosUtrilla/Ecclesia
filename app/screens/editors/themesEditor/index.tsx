import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save, Settings } from 'lucide-react'
import { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { Separator } from '@/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/dialog'

import BackgroundSelector from './backgroundSelector'
import AnimationSelector from './animationSelector'
import { PresentationView } from '../../../ui/PresentationView'
import { defaultAnimationSettings, AnimationSettings } from '@/lib/animationSettings'

import { useResizeObserver } from 'usehooks-ts'
import useThemePreview from './useThemePreview'
import ThemeToolbar from './ThemeToolbar'
import {
  EditableBoundsTarget,
  PresentationViewItems,
  TextBoundsValues
} from '../../../ui/PresentationView/types'
import { useParams } from 'react-router'
import { CreateThemeSchema, UpdateThemeSchema } from './schema'
import { z } from 'zod'
import { Switch } from '@/ui/switch'
import BiblePresentationConfiguration from '../biblePresentationConfiguration'
import { useDefaultBiblePresentationSettings } from '@/hooks/useDefaultBiblePresentationSettings'
import { useScreenSize } from '@/contexts/ScreenSizeContext'
import { clampBibleEdgeOffset, shouldDetachDefaultBibleSettings } from './utils/bibleSettings'

type BackgroundType = 'color' | 'gradient' | 'image' | 'video'

type FormData = z.infer<typeof CreateThemeSchema> & {
  backgroundMedia?: any
  id?: number
  createdAt?: Date
  updatedAt?: Date
}

const NEW_THEME_DEFAULT_VERSE_EDGE = 10

export default function ThemesEditor() {
  const logBibleDebug = (event: string, payload?: Record<string, unknown>) => {
    console.log(`[ThemeEditor:BibleDebug] ${event}`, payload || {})
  }

  const { id } = useParams()
  const isCreatingTheme = !id
  const previewRef = useRef<HTMLDivElement>(null)
  const { defaultBiblePresentationSettings } = useDefaultBiblePresentationSettings()
  const { height = 0 } = useResizeObserver({
    ref: previewRef as React.RefObject<HTMLDivElement>
  })
  const screenSize = useScreenSize(height || 0)

  const [selectedPreview, setSelectedPreview] = useState(0)
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('color')
  const [animationKey, setAnimationKey] = useState(0)
  const [themeTransitionPreviewKey, setThemeTransitionPreviewKey] = useState(0)
  const [selectedBoundsTarget, setSelectedBoundsTarget] = useState<EditableBoundsTarget>('text')

  const {
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
    handleSubmit,
    reset
  } = useForm<FormData>({
    defaultValues: {
      name: '',
      background: '',
      backgroundMediaId: null,
      previewImage: '',
      textStyle: {
        color: '#000000',
        fontSize: 24,
        lineHeight: 1.2,
        letterSpacing: 0,
        fontFamily: 'Arial',
        textAlign: 'center',
        justifyContent: 'center',
        paddingInline: 16,
        paddingBlock: 16,
        translate: '0px 0px'
      },
      animationSettings: JSON.stringify(defaultAnimationSettings),
      transitionSettings: JSON.stringify(defaultAnimationSettings),
      biblePresentationSettings: undefined,
      useDefaultBibleSettings: true,
      biblePresentationSettingsId: null
    },
    mode: 'onChange',
    shouldUnregister: false,
    resolver: zodResolver(id ? UpdateThemeSchema : CreateThemeSchema)
  })

  // Cargar datos del tema si hay un id
  useEffect(() => {
    if (id) {
      const loadTheme = async () => {
        try {
          const theme = await window.api.themes.getThemeById(Number(id))
          if (!theme) {
            console.error('Theme not found with id:', id)
            return
          }
          setBackgroundType(
            theme.backgroundMediaId !== null
              ? theme?.backgroundMedia?.type === 'VIDEO'
                ? 'video'
                : 'image'
              : 'color'
          )
          reset({
            ...theme
          })
        } catch (error) {
          console.error('Error loading theme:', error)
        }
      }
      loadTheme()
    }
  }, [id])

  // Observar valores para preview - optimizado por react-hook-form
  const watchedData = watch()
  const { previewData, animationSettings, transitionSettings } = useThemePreview(watchedData)

  const prevBibleDebugStateRef = useRef<{
    useDefaultBibleSettings?: boolean
    selectedBoundsTarget?: EditableBoundsTarget
    customPositionStyle?: number | null
  }>({})

  useEffect(() => {
    const currentState = {
      useDefaultBibleSettings: watchedData.useDefaultBibleSettings,
      selectedBoundsTarget,
      customPositionStyle: watchedData.biblePresentationSettings?.positionStyle ?? null
    }

    const previousState = prevBibleDebugStateRef.current

    if (
      previousState.useDefaultBibleSettings !== currentState.useDefaultBibleSettings ||
      previousState.selectedBoundsTarget !== currentState.selectedBoundsTarget ||
      previousState.customPositionStyle !== currentState.customPositionStyle
    ) {
      logBibleDebug('state-change', {
        previousState,
        currentState
      })
      prevBibleDebugStateRef.current = currentState
    }
  }, [
    watchedData.useDefaultBibleSettings,
    watchedData.biblePresentationSettings?.positionStyle,
    selectedBoundsTarget
  ])

  // Callbacks memoizados para evitar re-renders
  const handleMediaChange = useCallback(
    (mediaId: number | null, media: any) => {
      setValue('backgroundMediaId', mediaId, { shouldDirty: true })
      setValue('backgroundMedia', media as any, { shouldDirty: true })
    },
    [setValue]
  )

  const handleAnimationChange = useCallback(
    (settings: AnimationSettings) => {
      setValue('animationSettings', JSON.stringify(settings), { shouldDirty: true })
      setAnimationKey((prev) => prev + 1)
    },
    [setValue]
  )

  const handlePreviewAnimation = useCallback(() => {
    setAnimationKey((prev) => prev + 1)
  }, [])

  const handleTransitionChange = useCallback(
    (settings: AnimationSettings) => {
      setValue('transitionSettings', JSON.stringify(settings), { shouldDirty: true })
      setThemeTransitionPreviewKey((prev) => prev + 1)
    },
    [setValue]
  )

  const handlePreviewTransition = useCallback(() => {
    setThemeTransitionPreviewKey((prev) => prev + 1)
  }, [])

  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const pendingCloseRef = useRef(false)

  useEffect(() => {
    const unsub = window.electron.ipcRenderer.on('theme-close-requested', () => {
      if (!isDirty) {
        window.windowAPI.confirmThemeClose()
        return
      }
      setShowCloseDialog(true)
    })
    return () => unsub()
  }, [isDirty])

  const handleCloseDiscard = useCallback(() => {
    setShowCloseDialog(false)
    window.windowAPI.confirmThemeClose()
  }, [])

  const handleCloseCancel = useCallback(() => {
    setShowCloseDialog(false)
  }, [])

  const onSave = handleSubmit(async (data) => {
    if (!data.name || data.name.trim() === '') {
      alert('Se requiere un nombre para el tema.')
      return
    }

    const routeThemeId = Number(id)
    const loadedThemeId = Number(watchedData.id)
    const themeId = Number.isFinite(routeThemeId)
      ? routeThemeId
      : Number.isFinite(loadedThemeId)
        ? loadedThemeId
        : NaN
    const isEditing = Number.isFinite(themeId)

    try {
      if (id && !isEditing) {
        throw new Error('No se pudo determinar el ID del tema para guardar los cambios')
      }

      if (isEditing) {
        // Update existing theme
        await window.api.themes.updateTheme(themeId, data as any)
      } else {
        // Create new theme
        await window.api.themes.createTheme(data as any)
      }
      // cerrar ventana
      window.electron.ipcRenderer.send('theme-saved')
      window.googleDriveSyncAPI.notifyAutoSaveEvent()
      pendingCloseRef.current = false
      window.windowAPI.confirmThemeClose()
    } catch (error: any) {
      console.error('Error saving theme:', error)
      const errorMessage = error?.message || 'Ocurrió un error desconocido al guardar el tema.'

      // Mostrar mensaje específico si es error de nombre duplicado
      if (errorMessage.includes('Ya existe un tema con el nombre')) {
        alert(errorMessage)
      } else {
        alert('Ocurrió un error al guardar el tema: ' + errorMessage)
      }
    }
  })

  const handleCloseSave = useCallback(async () => {
    pendingCloseRef.current = true
    setShowCloseDialog(false)
    await onSave()
  }, [onSave])

  const handleSwitchBibleSetting = (value: boolean) => {
    logBibleDebug('switch-useDefaultBibleSettings', {
      nextValue: value,
      currentValue: watchedData.useDefaultBibleSettings,
      hasCustomSettings: Boolean(watchedData.biblePresentationSettings)
    })

    setValue('useDefaultBibleSettings', value, { shouldDirty: true })
    if (!watchedData.biblePresentationSettings) {
      const nextPositionStyle =
        defaultBiblePresentationSettings?.positionStyle === null ||
        defaultBiblePresentationSettings?.positionStyle === undefined ||
        (isCreatingTheme && defaultBiblePresentationSettings?.positionStyle === 0)
          ? NEW_THEME_DEFAULT_VERSE_EDGE
          : defaultBiblePresentationSettings.positionStyle

      setValue(
        'biblePresentationSettings',
        {
          ...defaultBiblePresentationSettings,
          positionStyle: nextPositionStyle,
          id: undefined
        } as any,
        { shouldDirty: true }
      )

      logBibleDebug('seed-custom-bible-settings', {
        source: 'handleSwitchBibleSetting',
        seededPositionStyle: nextPositionStyle
      })
    }
  }

  const handleTextBoundsChange = useCallback(
    (next: TextBoundsValues) => {
      setValue('textStyle.paddingInline', next.paddingInline, { shouldDirty: true })
      setValue('textStyle.paddingBlock', next.paddingBlock, { shouldDirty: true })
      setValue('textStyle.translate', `${next.translateX}px ${next.translateY}px`, {
        shouldDirty: true
      })
    },
    [setValue]
  )

  const activeBibleSettings = useMemo(() => {
    const baseSettings = watchedData.useDefaultBibleSettings
      ? defaultBiblePresentationSettings
      : watchedData.biblePresentationSettings

    if (!baseSettings) return baseSettings

    if (
      isCreatingTheme &&
      watchedData.useDefaultBibleSettings &&
      (baseSettings.positionStyle === null || baseSettings.positionStyle === 0)
    ) {
      return {
        ...baseSettings,
        positionStyle: NEW_THEME_DEFAULT_VERSE_EDGE
      }
    }

    return baseSettings
  }, [
    defaultBiblePresentationSettings,
    isCreatingTheme,
    watchedData.useDefaultBibleSettings,
    watchedData.biblePresentationSettings
  ])

  const canSelectVerseBounds = useMemo(() => {
    const item = PreviewsItems[selectedPreview]
    if (!item?.verse) return false
    const position = activeBibleSettings?.position
    return position === 'upScreen' || position === 'downScreen'
  }, [activeBibleSettings?.position, selectedPreview])

  useEffect(() => {
    if (!canSelectVerseBounds && selectedBoundsTarget === 'verse') {
      setSelectedBoundsTarget('text')
    }
  }, [canSelectVerseBounds, selectedBoundsTarget])

  const handleBibleVersePositionChange = useCallback(
    (next: number) => {
      logBibleDebug('verse-position-change-received', {
        next,
        selectedBoundsTarget,
        useDefaultBibleSettings: watchedData.useDefaultBibleSettings,
        currentCustomPositionStyle: watchedData.biblePresentationSettings?.positionStyle ?? null
      })

      if (selectedBoundsTarget !== 'verse') {
        logBibleDebug('verse-position-change-ignored-not-verse-target', {
          selectedBoundsTarget
        })
        return
      }

      const bounded = clampBibleEdgeOffset(next)

      if (watchedData.useDefaultBibleSettings) {
        const sourceSettings =
          watchedData.biblePresentationSettings || defaultBiblePresentationSettings
        if (!sourceSettings) return

        const startPositionStyle =
          sourceSettings.positionStyle === null || sourceSettings.positionStyle === undefined
            ? NEW_THEME_DEFAULT_VERSE_EDGE
            : sourceSettings.positionStyle

        if (!shouldDetachDefaultBibleSettings(true, startPositionStyle, bounded)) {
          logBibleDebug('verse-position-change-ignored-no-real-change-default', {
            startPositionStyle,
            bounded
          })
          return
        }

        setValue('useDefaultBibleSettings', false, { shouldDirty: true })
        setValue(
          'biblePresentationSettings',
          {
            ...sourceSettings,
            id: undefined,
            positionStyle: bounded
          } as any,
          { shouldDirty: true }
        )

        logBibleDebug('detached-default-bible-settings', {
          from: startPositionStyle,
          to: bounded
        })
        return
      }

      if (!watchedData.biblePresentationSettings) return

      const currentCustomPosition =
        watchedData.biblePresentationSettings.positionStyle === null ||
        watchedData.biblePresentationSettings.positionStyle === undefined
          ? NEW_THEME_DEFAULT_VERSE_EDGE
          : watchedData.biblePresentationSettings.positionStyle

      if (currentCustomPosition === bounded) {
        logBibleDebug('verse-position-change-ignored-no-real-change-custom', {
          currentCustomPosition,
          bounded
        })
        return
      }

      setValue('biblePresentationSettings.positionStyle', bounded, { shouldDirty: true })
      logBibleDebug('updated-custom-position-style', {
        from: currentCustomPosition,
        to: bounded
      })
    },
    [
      defaultBiblePresentationSettings,
      selectedBoundsTarget,
      setValue,
      watchedData.biblePresentationSettings,
      watchedData.useDefaultBibleSettings
    ]
  )
  return (
    <div className="min-h-screen max-h-screen flex flex-col overflow-hidden">
      <div className="flex-shrink-0">
        <title>Editor de temas</title>
        <div className="p-2  flex items-center gap-1 border-b flex-wrap">
          <div className="">
            {/* Theme Name */}
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <Input
                  error={errors.name ? errors.name.message : ''}
                  className="!bg-background"
                  placeholder="Enter theme name"
                  {...field}
                />
              )}
            />
            <div className="ml-auto flex mt-1.5 gap-2 w-full">
              <Button
                onClick={onSave}
                disabled={isSubmitting || !isDirty}
                size="sm"
                className="flex-1"
              >
                <Save />
                Save
              </Button>
              <Button
                onClick={() => window.windowAPI.confirmThemeClose()}
                size="sm"
                className="flex-1"
                variant="destructive"
              >
                Cancel
              </Button>
            </div>
          </div>
          <Separator orientation="vertical" className="!h-16 mx-1" />
          {/* Background Selector */}
          <BackgroundSelector
            backgroundType={backgroundType}
            value={previewData.background}
            onTypeChange={setBackgroundType}
            onValueChange={(v) => setValue('background', v, { shouldDirty: true })}
            onMediaChange={handleMediaChange}
            selectedMedia={previewData.backgroundMedia}
          />
          <Separator orientation="vertical" className="!h-16 mx-1" />

          {/* Animation Selector */}
          <AnimationSelector
            settings={animationSettings}
            onChange={handleAnimationChange}
            onPreview={handlePreviewAnimation}
            label="Animación texto:"
          />

          <Separator orientation="vertical" className="!h-16 mx-1" />

          <AnimationSelector
            settings={transitionSettings}
            onChange={handleTransitionChange}
            onPreview={handlePreviewTransition}
            label="Transición tema:"
          />

          <Separator orientation="vertical" className="!h-16 mx-1" />

          {/* Configuración de Biblia */}
          <div className="flex items-center gap-2 px-2 py-1.5 border rounded-md bg-background/50">
            <div className="flex flex-col gap-1 min-w-[160px]">
              <span className="text-xs font-medium">Presentación Biblia</span>
              <div className="flex items-center gap-2">
                <Switch
                  id="useDefaultBibleSettings"
                  checked={watchedData.useDefaultBibleSettings}
                  onCheckedChange={handleSwitchBibleSetting}
                />
                <span className="text-xs text-muted-foreground">
                  {watchedData.useDefaultBibleSettings ? 'Por defecto' : 'Personalizado'}
                </span>
              </div>
            </div>
            <BiblePresentationConfiguration
              customTheme={previewData}
              customBibleSettings={watchedData.biblePresentationSettings ?? undefined}
              setCustomBibleSettings={(settings) => {
                logBibleDebug('setCustomBibleSettings-from-dialog', {
                  settings
                })
                setValue('biblePresentationSettings', settings, { shouldDirty: true })
              }}
            >
              <Button
                disabled={watchedData.useDefaultBibleSettings}
                size="icon"
                className="h-8 w-8"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </BiblePresentationConfiguration>
          </div>
        </div>

        {/* Barra de herramientas de estilo */}
        <ThemeToolbar
          setValue={setValue}
          watchedData={watchedData}
          selectedBoundsTarget={selectedBoundsTarget}
          canSelectVerseBounds={canSelectVerseBounds}
          setSelectedBoundsTarget={setSelectedBoundsTarget}
          handlePreviewAnimation={handlePreviewAnimation}
          handlePreviewTransition={handlePreviewTransition}
        />
      </div>
      <div
        className="flex-1 min-h-0 bg-muted flex items-center justify-center p-4 overflow-auto"
        ref={previewRef}
      >
        <div
          style={{
            height: screenSize.height,
            width: screenSize.width
          }}
        >
          <PresentationView
            key={animationKey}
            theme={previewData}
            items={PreviewsItems}
            live
            currentIndex={selectedPreview}
            themeTransitionKey={themeTransitionPreviewKey}
            showTextBounds
            textBoundsIsSelected={selectedBoundsTarget === 'text'}
            bibleVerseIsSelected={selectedBoundsTarget === 'verse'}
            onTextBoundsChange={handleTextBoundsChange}
            onBibleVersePositionChange={handleBibleVersePositionChange}
            onEditableTargetSelect={setSelectedBoundsTarget}
          />
        </div>
      </div>
      <div className="flex-shrink-0 p-3 bg-muted/50 flex items-center gap-4 justify-center overflow-x-auto">
        {PreviewsItems.map((item, index) => (
          <PresentationView
            onClick={() => setSelectedPreview(index)}
            key={`preview-${item.text?.slice(0, 20)}`}
            theme={previewData}
            items={[item]}
            className="max-w-48"
            selected={selectedPreview === index}
            showTextBounds
            textBoundsIsSelected={selectedBoundsTarget === 'text'}
            bibleVerseIsSelected={selectedBoundsTarget === 'verse'}
          />
        ))}
      </div>

      <Dialog
        open={showCloseDialog}
        onOpenChange={(open) => {
          if (!open) handleCloseCancel()
        }}
      >
        <DialogContent showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Cambios sin guardar</DialogTitle>
            <DialogDescription>
              Tienes cambios sin guardar en este tema. ¿Qué deseas hacer?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={handleCloseCancel}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleCloseDiscard}>
              Salir sin guardar
            </Button>
            <Button onClick={handleCloseSave} disabled={isSubmitting}>
              <Save className="h-4 w-4" />
              Guardar y salir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const PreviewsItems: PresentationViewItems[] = [
  {
    text: `Testing Theme Preview
          <br>Aa Áá Ee Éé Ii Íí Oo Óó Uu Úú
          <br>Çç Ññ Ää Öö Üü ß
          <br>Àà Èè Ìì Òò Ùù`,
    resourceType: 'BIBLE'
  },
  {
    text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.',
    verse: {
      bookId: 43,
      chapter: 3,
      verse: 16,
      version: 'RVR1960'
    },
    resourceType: 'BIBLE'
  }
]
