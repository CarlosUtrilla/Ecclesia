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
  Underline as UnderlineIcon
} from 'lucide-react'
import { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { Separator } from '@/ui/separator'
import FontFamilySelector from '@/ui/fontFamilySelector'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import FormatLineSpacingIcon from '@/icons/line-spacing'
import LetterSpacingIcon from '@/icons/letter-spacing'
import BackgroundSelector from './backgroundSelector'
import AnimationSelector from './animationSelector'
import { PresentationView } from '../PresentationView'
import { defaultAnimationSettings, AnimationSettings } from '@/lib/animationSettings'
import { fontSizes, lineHeights, letterSpacings } from '@/lib/themeConstants'
import { ColorPicker } from '@/ui/colorPicker'
import { useResizeObserver } from 'usehooks-ts'
import { PresentationViewItems } from '../PresentationView/types'
import { useParams } from 'react-router'
import { CreateThemeSchema, UpdateThemeSchema } from './schema'
import { z } from 'zod'

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
  const { height = 0 } = useResizeObserver({
    ref: previewRef as React.RefObject<HTMLDivElement>
  })

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
      letterSpacing: 0,
      lineHeight: 1.5,
      textSize: 16,
      textColor: '#000000',
      fontFamily: 'Arial',
      previewImage: '',
      textAlign: 'center',
      bold: false,
      italic: false,
      underline: false,
      animationSettings: JSON.stringify(defaultAnimationSettings),
      ...(id ? { id: Number(id) } : {})
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
  const previewData = {
    ...watchedData,
    id: watchedData.id || 0,
    createdAt: watchedData.createdAt || new Date(),
    updatedAt: watchedData.updatedAt || new Date()
  }

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

  return (
    <div className="h-full flex flex-col">
      <div>
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
              <Button size="sm" className="flex-1" variant="destructive">
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
        </div>

        {/* Barra de herramientas de estilo */}
        <div className="p-2 flex items-center gap-1 border-b flex-wrap">
          {/* Font Size */}
          <Controller
            name="fontFamily"
            control={control}
            render={({ field }) => (
              <FontFamilySelector value={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            name="textSize"
            control={control}
            render={({ field }) => (
              <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
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
            name="textColor"
            control={control}
            render={({ field }) => (
              <ColorPicker value={field.value} onChange={field.onChange} className="h-8 w-10" />
            )}
          />

          <Separator orientation="vertical" className="!h-6 mx-1" />

          {/* Bold */}
          <Controller
            name="bold"
            control={control}
            render={({ field }) => (
              <Button
                type="button"
                size="icon"
                variant={field.value ? 'default' : 'ghost'}
                onClick={() => field.onChange(!field.value)}
                className="h-8 w-8"
              >
                <Bold className="h-4 w-4" />
              </Button>
            )}
          />

          {/* Italic */}
          <Controller
            name="italic"
            control={control}
            render={({ field }) => (
              <Button
                type="button"
                size="icon"
                variant={field.value ? 'default' : 'ghost'}
                onClick={() => field.onChange(!field.value)}
                className="h-8 w-8"
              >
                <Italic className="h-4 w-4" />
              </Button>
            )}
          />

          {/* Underline */}
          <Controller
            name="underline"
            control={control}
            render={({ field }) => (
              <Button
                type="button"
                size="icon"
                variant={field.value ? 'default' : 'ghost'}
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
            name="lineHeight"
            control={control}
            render={({ field }) => (
              <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
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
            name="letterSpacing"
            control={control}
            render={({ field }) => (
              <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
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
            name="textAlign"
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
      <div className="flex-1 bg-muted flex items-center justify-center p-4" ref={previewRef}>
        <PresentationView
          key={animationKey}
          theme={previewData}
          items={PreviewsItems}
          live
          maxHeight={height - 32}
          currentIndex={selectedPreview}
        />
      </div>
      <div className="p-3 bg-muted/50 flex items-center gap-1 justify-center">
        {PreviewsItems.map((item, index) => (
          <PresentationView
            onClick={() => setSelectedPreview(index)}
            key={index}
            theme={previewData}
            items={[item]}
            maxHeight={120}
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
    text: 'Second Slide Preview'
  }
]
