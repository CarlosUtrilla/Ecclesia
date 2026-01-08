import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Themes, Media } from '@prisma/client'
import { useForm, Controller } from 'react-hook-form'
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
import { useRef, useMemo, useCallback, useState } from 'react'
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

type BackgroundType = 'color' | 'gradient' | 'image' | 'video'

type ThemeFormData = Themes & {
  backgroundMedia?: Media | null
}

export default function ThemesEditor() {
  const previewRef = useRef<HTMLDivElement>(null)
  const { height = 0 } = useResizeObserver({
    ref: previewRef as React.RefObject<HTMLDivElement>
  })

  const [backgroundType, setBackgroundType] = useState<BackgroundType>('color')
  const [animationKey, setAnimationKey] = useState(0)

  const { control, setValue, watch } = useForm<ThemeFormData>({
    defaultValues: {
      id: 0,
      name: '',
      background: '',
      backgroundMediaId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      letterSpacing: 0,
      lineHeight: 1.5,
      textSize: 16,
      textColor: '#000000',
      fontFamily: '"Arial", sans-serif',
      previewImage: '',
      textAlign: 'center',
      bold: false,
      italic: false,
      underline: false,
      animationSettings: JSON.stringify(defaultAnimationSettings)
    },
    mode: 'onChange',
    shouldUnregister: false
  })

  // Observar valores para preview - optimizado por react-hook-form
  const previewData = watch()

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
      setValue('backgroundMediaId', mediaId)
      setValue('backgroundMedia', media as any)
    },
    [setValue]
  )

  const handleAnimationChange = useCallback(
    (settings: AnimationSettings) => {
      setValue('animationSettings', JSON.stringify(settings))
      setAnimationKey((prev) => prev + 1)
    },
    [setValue]
  )

  const handlePreviewAnimation = useCallback(() => {
    setAnimationKey((prev) => prev + 1)
  }, [])

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
                <Input className="!bg-background" placeholder="Enter theme name" {...field} />
              )}
            />
            <div className="ml-auto flex mt-1.5 gap-2 w-full">
              <Button size="sm" className="flex-1">
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
            onValueChange={(v) => setValue('background', v)}
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
          items={[
            {
              text: `Testing Theme Preview
              <br>Aa Áá Ee Éé Ii Íí Oo Óó Uu Úú
              <br>Çç Ññ Ää Öö Üü ß
              <br>Àà Èè Ìì Òò Ùù`
            }
          ]}
          maxHeight={height - 32}
        />
      </div>
    </div>
  )
}
