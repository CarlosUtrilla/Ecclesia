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
  Settings
} from 'lucide-react'
import { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { Separator } from '@/ui/separator'
import FontFamilySelector from '@/ui/fontFamilySelector'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import FormatLineSpacingIcon from '@/icons/line-spacing'
import LetterSpacingIcon from '@/icons/letter-spacing'
import BackgroundSelector from './backgroundSelector'
import AnimationSelector from './animationSelector'
import { PresentationView } from '../../../ui/PresentationView'
import { defaultAnimationSettings, AnimationSettings } from '@/lib/animationSettings'
import { fontSizes, lineHeights, letterSpacings } from '@/lib/themeConstants'
import { ColorPicker } from '@/ui/colorPicker'
import { useResizeObserver } from 'usehooks-ts'
import { PresentationViewItems, ThemeWithMedia } from '../../../ui/PresentationView/types'
import { useParams } from 'react-router'
import { CreateThemeSchema, UpdateThemeSchema } from './schema'
import { z } from 'zod'
import { Switch } from '@/ui/switch'
import BiblePresentationConfiguration from '../biblePresentationConfiguration'
import { useDefaultBiblePresentationSettings } from '@/hooks/useDefaultBiblePresentationSettings'
import { useScreenSize } from '@/contexts/ScreenSizeContext'

type BackgroundType = 'color' | 'gradient' | 'image' | 'video'

type FormData = z.infer<typeof CreateThemeSchema> & {
  backgroundMedia?: any
  id?: number
  createdAt?: Date
  updatedAt?: Date
}

export default function ThemesEditor() {
  const { id } = useParams()
  const previewRef = useRef<HTMLDivElement>(null)
  const { defaultBiblePresentationSettings } = useDefaultBiblePresentationSettings()
  const { height = 0 } = useResizeObserver({
    ref: previewRef as React.RefObject<HTMLDivElement>
  })
  const screenSize = useScreenSize(height || 0)

  const [selectedPreview, setSelectedPreview] = useState(0)
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('color')
  const [animationKey, setAnimationKey] = useState(0)

  const {
    control,
    setValue,
    watch,
    formState: { isDirty, errors },
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
        textAlign: 'center'
      },
      animationSettings: JSON.stringify(defaultAnimationSettings),
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

  // Parse animation settings - memoizado para evitar re-parseos
  const animationSettings = useMemo<AnimationSettings>(() => {
    try {
      return JSON.parse(previewData.animationSettings)
    } catch {
      return defaultAnimationSettings
    }
  }, [previewData])

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

  const onSave = handleSubmit(async (data) => {
    console.log('Saving theme data:', data)
    if (!data.name || data.name.trim() === '') {
      alert('Se requiere un nombre para el tema.')
      return
    }
    try {
      if (id !== undefined) {
        // Update existing theme
        await window.api.themes.updateTheme(data.id!, data as any)
      } else {
        // Create new theme
        await window.api.themes.createTheme(data)
      }
      // cerrar ventana
      window.electron.ipcRenderer.send('theme-saved')
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
      setValue(
        'biblePresentationSettings',
        {
          ...defaultBiblePresentationSettings,
          id: undefined
        } as any,
        { shouldDirty: true }
      )
    }
  }

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
              <Button onClick={onSave} disabled={!isDirty} size="sm" className="flex-1">
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
                onClick={() => field.onChange(!field.value)}
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
                onClick={() => field.onChange(!field.value)}
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
                onClick={() => field.onChange(!field.value)}
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
          />
        </div>
      </div>
      <div className="flex-shrink-0 p-3 bg-muted/50 flex items-center gap-1 justify-center overflow-x-auto">
        {PreviewsItems.map((item, index) => (
          <PresentationView
            onClick={() => setSelectedPreview(index)}
            key={index}
            theme={previewData}
            items={[item]}
            className="max-w-48"
            selected={selectedPreview === index}
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
          <br>Àà Èè Ìì Òò Ùù`
  },
  {
    text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.',
    verse: {
      bookId: 43,
      chapter: 3,
      verse: 16,
      version: 'RVR1960'
    }
  }
]
