import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Save,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Settings,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react'
import { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { Separator } from '@/ui/separator'
import FontFamilySelector from '@/ui/fontFamilySelector'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Slider } from '@/ui/slider'
import FormatLineSpacingIcon from '@/icons/line-spacing'
import LetterSpacingIcon from '@/icons/letter-spacing'
import BackgroundSelector from './backgroundSelector'
import AnimationSelector from './animationSelector'
import { PresentationView } from '../../../ui/PresentationView'
import { defaultAnimationSettings, AnimationSettings } from '@/lib/animationSettings'
import { fontSizes, lineHeights, letterSpacings } from '@/lib/themeConstants'
import { ColorPicker } from '@/ui/colorPicker'
import { useResizeObserver } from 'usehooks-ts'
import {
  EditableBoundsTarget,
  PresentationViewItems,
  ThemeWithMedia,
  TextBoundsValues
} from '../../../ui/PresentationView/types'
import { useParams } from 'react-router'
import { CreateThemeSchema, UpdateThemeSchema } from './schema'
import { z } from 'zod'
import { Switch } from '@/ui/switch'
import BiblePresentationConfiguration from '../biblePresentationConfiguration'
import { useDefaultBiblePresentationSettings } from '@/hooks/useDefaultBiblePresentationSettings'
import { useScreenSize } from '@/contexts/ScreenSizeContext'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/ui/dropdown-menu'

type BackgroundType = 'color' | 'gradient' | 'image' | 'video'

type FormData = z.infer<typeof CreateThemeSchema> & {
  backgroundMedia?: any
  id?: number
  createdAt?: Date
  updatedAt?: Date
}

const NEW_THEME_DEFAULT_VERSE_EDGE = 10

const parseTranslate = (translateValue: unknown) => {
  if (typeof translateValue !== 'string') {
    return { x: 0, y: 0 }
  }

  const parts = translateValue.trim().split(/\s+/)
  const x = Number.parseFloat(parts[0] || '0')
  const y = Number.parseFloat(parts[1] || parts[0] || '0')

  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0
  }
}

export default function ThemesEditor() {
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
    formState: { errors, isSubmitting },
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
          reset({
            ...theme
          })
          setBackgroundType(
            theme.backgroundMediaId !== null
              ? theme?.backgroundMedia?.type === 'VIDEO'
                ? 'video'
                : 'image'
              : 'color'
          )
        } catch (error) {
          console.error('Error loading theme:', error)
        }
      }
      loadTheme()
    }
  }, [id])

  // Observar valores para preview - optimizado por react-hook-form
  const watchedData = watch()
  const previewData = {
    ...watchedData,
    id: watchedData.id || 0,
    createdAt: watchedData.createdAt || new Date(),
    updatedAt: watchedData.updatedAt || new Date()
  } as ThemeWithMedia

  const translateValues = useMemo(
    () => parseTranslate(watchedData.textStyle?.translate),
    [watchedData.textStyle?.translate]
  )

  // Parse animation settings - memoizado para evitar re-parseos
  const animationSettings = useMemo<AnimationSettings>(() => {
    try {
      return JSON.parse(previewData.animationSettings)
    } catch {
      return defaultAnimationSettings
    }
  }, [previewData])

  const transitionSettings = useMemo<AnimationSettings>(() => {
    try {
      return JSON.parse(previewData.transitionSettings || '{}')
    } catch {
      return defaultAnimationSettings
    }
  }, [previewData.transitionSettings])

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

  const onSave = handleSubmit(async (data) => {
    console.log('Saving theme data:', data)
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
        await window.api.themes.createTheme(data)
      }
      // cerrar ventana
      window.electron.ipcRenderer.send('theme-saved')
      window.googleDriveSyncAPI.notifyAutoSaveEvent()
      window.windowAPI.closeCurrentWindow()
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

  const handleSwitchBibleSetting = (value: boolean) => {
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
    }
  }

  const handleResetTextPosition = () => {
    setValue('textStyle.paddingInline', 16, { shouldDirty: true })
    setValue('textStyle.paddingBlock', 16, { shouldDirty: true })
    setValue('textStyle.translate', '0px 0px', { shouldDirty: true })
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
      const bounded = Math.min(Math.max(0, Math.round(next)), 72)

      if (watchedData.useDefaultBibleSettings) {
        const sourceSettings =
          watchedData.biblePresentationSettings || defaultBiblePresentationSettings
        if (!sourceSettings) return

        const startPositionStyle =
          sourceSettings.positionStyle === null ||
          sourceSettings.positionStyle === undefined ||
          (isCreatingTheme && sourceSettings.positionStyle === 0)
            ? NEW_THEME_DEFAULT_VERSE_EDGE
            : sourceSettings.positionStyle

        setValue('useDefaultBibleSettings', false, { shouldDirty: true })
        setValue(
          'biblePresentationSettings',
          {
            ...sourceSettings,
            id: undefined,
            positionStyle: startPositionStyle === bounded ? startPositionStyle : bounded
          } as any,
          { shouldDirty: true }
        )
        return
      }

      if (!watchedData.biblePresentationSettings) return

      setValue('biblePresentationSettings.positionStyle', bounded, { shouldDirty: true })
    },
    [
      defaultBiblePresentationSettings,
      isCreatingTheme,
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
              <Button onClick={onSave} disabled={isSubmitting} size="sm" className="flex-1">
                <Save />
                Save
              </Button>
              <Button
                onClick={() => window.windowAPI.closeCurrentWindow()}
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
              customBibleSettings={
                watchedData.biblePresentationSettings
                  ? {
                      ...watchedData.biblePresentationSettings
                    }
                  : undefined
              }
              setCustomBibleSettings={(settings) =>
                setValue('biblePresentationSettings', settings, { shouldDirty: true })
              }
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
        <div className="p-2 flex items-center gap-1 border-b flex-wrap">
          {/* Font Size */}
          <Controller
            name="textStyle.fontFamily"
            control={control}
            render={({ field }) => (
              <FontFamilySelector value={field.value || 'Arial'} onChange={field.onChange} />
            )}
          />
          <Controller
            name="textStyle.fontSize"
            control={control}
            render={({ field }) => (
              <Select
                value={String(field.value || 24)}
                onValueChange={(v) => field.onChange(Number(v))}
              >
                <SelectTrigger size="sm">
                  <Type className="h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fontSizes.map((size) => (
                    <SelectItem key={size.value} value={String(size.value)}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />

          {/* Text Color */}
          <Controller
            name="textStyle.color"
            control={control}
            render={({ field }) => (
              <ColorPicker
                value={field.value || '#000000'}
                onChange={field.onChange}
                className="h-8 w-10"
              />
            )}
          />

          <Separator orientation="vertical" className="!h-6 mx-1" />

          {/* Bold */}
          <Controller
            name="textStyle.fontWeight"
            control={control}
            render={({ field }) => (
              <Button
                type="button"
                size="icon"
                variant={field.value === 'bold' ? 'default' : 'ghost'}
                onClick={() => field.onChange(field.value === 'bold' ? undefined : 'bold')}
                className="h-8 w-8"
              >
                <Bold className="h-4 w-4" />
              </Button>
            )}
          />

          {/* Italic */}
          <Controller
            name="textStyle.fontStyle"
            control={control}
            render={({ field }) => (
              <Button
                type="button"
                size="icon"
                variant={field.value === 'italic' ? 'default' : 'ghost'}
                onClick={() => field.onChange(field.value === 'italic' ? undefined : 'italic')}
                className="h-8 w-8"
              >
                <Italic className="h-4 w-4" />
              </Button>
            )}
          />

          {/* Underline */}
          <Controller
            name="textStyle.textDecoration"
            control={control}
            render={({ field }) => (
              <Button
                type="button"
                size="icon"
                variant={field.value === 'underline' ? 'default' : 'ghost'}
                onClick={() =>
                  field.onChange(field.value === 'underline' ? undefined : 'underline')
                }
                className="h-8 w-8"
              >
                <UnderlineIcon className="h-4 w-4" />
              </Button>
            )}
          />

          <Separator orientation="vertical" className="!h-6 mx-1" />

          {/* Line Height */}
          <Controller
            name="textStyle.lineHeight"
            control={control}
            render={({ field }) => (
              <Select
                value={String(field.value || 1.2)}
                onValueChange={(v) => field.onChange(Number(v))}
              >
                <SelectTrigger size="sm" className="w-[95px]">
                  <FormatLineSpacingIcon className="h-5 w-5" />
                  <SelectValue placeholder="Line height" />
                </SelectTrigger>
                <SelectContent>
                  {lineHeights.map((height) => (
                    <SelectItem key={height.value} value={String(height.value)}>
                      {height.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />

          {/* Letter Spacing */}
          <Controller
            name="textStyle.letterSpacing"
            control={control}
            render={({ field }) => (
              <Select
                value={String(field.value || 0)}
                onValueChange={(v) => field.onChange(Number(v))}
              >
                <SelectTrigger size="sm" className="w-[120px]">
                  <LetterSpacingIcon className="h-4 w-4" />
                  <SelectValue placeholder="Letter spacing" />
                </SelectTrigger>
                <SelectContent>
                  {letterSpacings.map((spacing) => (
                    <SelectItem key={spacing.value} value={String(spacing.value)}>
                      {spacing.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />

          <Separator orientation="vertical" className="!h-6 mx-1" />

          {/* Text Align */}
          <Controller
            name="textStyle.textAlign"
            control={control}
            render={({ field }) => (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant={field.value === 'left' ? 'default' : 'ghost'}
                  onClick={() => field.onChange('left')}
                  className="h-8 w-8"
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant={field.value === 'center' ? 'default' : 'ghost'}
                  onClick={() => field.onChange('center')}
                  className="h-8 w-8"
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant={field.value === 'right' ? 'default' : 'ghost'}
                  onClick={() => field.onChange('right')}
                  className="h-8 w-8"
                >
                  <AlignRight className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant={field.value === 'justify' ? 'default' : 'ghost'}
                  onClick={() => field.onChange('justify')}
                  className="h-8 w-8"
                >
                  <AlignJustify className="h-4 w-4" />
                </Button>
              </>
            )}
          />

          <Controller
            name="textStyle.justifyContent"
            control={control}
            render={({ field }) => (
              <Select value={String(field.value || 'center')} onValueChange={field.onChange}>
                <SelectTrigger size="sm" className="w-[120px]">
                  <SelectValue placeholder="Alineación Y" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flex-start">Arriba</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="flex-end">Abajo</SelectItem>
                </SelectContent>
              </Select>
            )}
          />

          <Separator orientation="vertical" className="!h-6 mx-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Posición
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[360px] p-3 space-y-3">
              <div className="rounded-md border bg-background/60 px-2.5 py-1.5 text-xs">
                Editando seleccionado:{' '}
                <span className="font-medium text-foreground">
                  {selectedBoundsTarget === 'verse' ? 'Verso bíblico' : 'Texto principal'}
                </span>
              </div>

              {selectedBoundsTarget === 'text' ? (
                <>
                  <Controller
                    name="textStyle.paddingInline"
                    control={control}
                    render={({ field }) => (
                      <div className="w-full flex items-center gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Margen X
                        </span>
                        <Slider
                          value={[Number(field.value ?? 16)]}
                          min={0}
                          max={160}
                          step={1}
                          onValueChange={(value) => field.onChange(value[0])}
                        />
                        <div className="relative w-16 shrink-0">
                          <Input
                            type="number"
                            min={0}
                            max={160}
                            step={1}
                            className="h-6 w-16 pr-6 pl-2 text-right text-xs"
                            value={Number(field.value ?? 16)}
                            onChange={(event) => {
                              const nextValue = Number(event.target.value)
                              field.onChange(Number.isFinite(nextValue) ? nextValue : 0)
                            }}
                          />
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                            px
                          </span>
                        </div>
                      </div>
                    )}
                  />

                  <Controller
                    name="textStyle.paddingBlock"
                    control={control}
                    render={({ field }) => (
                      <div className="w-full flex items-center gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Margen Y
                        </span>
                        <Slider
                          value={[Number(field.value ?? 16)]}
                          min={0}
                          max={160}
                          step={1}
                          onValueChange={(value) => field.onChange(value[0])}
                        />
                        <div className="relative w-16 shrink-0">
                          <Input
                            type="number"
                            min={0}
                            max={160}
                            step={1}
                            className="h-6 w-16 pr-6 pl-2 text-right text-xs"
                            value={Number(field.value ?? 16)}
                            onChange={(event) => {
                              const nextValue = Number(event.target.value)
                              field.onChange(Number.isFinite(nextValue) ? nextValue : 0)
                            }}
                          />
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                            px
                          </span>
                        </div>
                      </div>
                    )}
                  />

                  <div className="w-full flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Posición X
                    </span>
                    <Slider
                      value={[translateValues.x]}
                      min={-200}
                      max={200}
                      step={1}
                      onValueChange={(value) => {
                        const nextX = value[0] ?? 0
                        setValue('textStyle.translate', `${nextX}px ${translateValues.y}px`, {
                          shouldDirty: true
                        })
                      }}
                    />
                    <div className="relative w-16 shrink-0">
                      <Input
                        type="number"
                        min={-200}
                        max={200}
                        step={1}
                        className="h-6 w-16 pr-6 pl-2 text-right text-xs"
                        value={translateValues.x}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value)
                          const nextX = Number.isFinite(nextValue) ? nextValue : 0
                          setValue('textStyle.translate', `${nextX}px ${translateValues.y}px`, {
                            shouldDirty: true
                          })
                        }}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        px
                      </span>
                    </div>
                  </div>

                  <div className="w-full flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Posición Y
                    </span>
                    <Slider
                      value={[translateValues.y]}
                      min={-200}
                      max={200}
                      step={1}
                      onValueChange={(value) => {
                        const nextY = value[0] ?? 0
                        setValue('textStyle.translate', `${translateValues.x}px ${nextY}px`, {
                          shouldDirty: true
                        })
                      }}
                    />
                    <div className="relative w-16 shrink-0">
                      <Input
                        type="number"
                        min={-200}
                        max={200}
                        step={1}
                        className="h-6 w-16 pr-6 pl-2 text-right text-xs"
                        value={translateValues.y}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value)
                          const nextY = Number.isFinite(nextValue) ? nextValue : 0
                          setValue('textStyle.translate', `${translateValues.x}px ${nextY}px`, {
                            shouldDirty: true
                          })
                        }}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        px
                      </span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full gap-2"
                      onClick={handleResetTextPosition}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Centrar / Restablecer
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-full flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Borde verso
                    </span>
                    <Slider
                      value={[Number(activeBibleSettings?.positionStyle ?? 0)]}
                      min={0}
                      max={72}
                      step={1}
                      disabled={!canSelectVerseBounds}
                      onValueChange={(value) => handleBibleVersePositionChange(value[0] ?? 0)}
                    />
                    <div className="relative w-16 shrink-0">
                      <Input
                        type="number"
                        min={0}
                        max={72}
                        step={1}
                        className="h-6 w-16 pr-6 pl-2 text-right text-xs"
                        value={Number(activeBibleSettings?.positionStyle ?? 0)}
                        disabled={!canSelectVerseBounds}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value)
                          handleBibleVersePositionChange(Number.isFinite(nextValue) ? nextValue : 0)
                        }}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        px
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    El verso solo se mueve en el borde superior o inferior para no tapar el texto.
                  </p>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
