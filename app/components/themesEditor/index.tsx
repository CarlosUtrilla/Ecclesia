import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Themes } from '@prisma/client'
import { useFormik } from 'formik'
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

import { useResizeObserver } from 'usehooks-ts'

type BackgroundType = 'color' | 'gradient' | 'image' | 'video'

export default function ThemesEditor() {
  const previewRef = useRef<HTMLDivElement>(null)
  const { height = 0 } = useResizeObserver({
    ref: previewRef as React.RefObject<HTMLDivElement>
  })

  const [backgroundType, setBackgroundType] = useState<BackgroundType>('color')
  const [animationKey, setAnimationKey] = useState(0)

  const { values, setFieldValue, handleChange } = useFormik<Themes>({
    initialValues: {
      id: 0,
      name: '',
      background: '',
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
    onSubmit: (values) => {
      console.log(values)
    }
  })

  // Parse animation settings - memoizado para evitar re-parseos
  const animationSettings = useMemo<AnimationSettings>(() => {
    try {
      return JSON.parse(values.animationSettings)
    } catch {
      return defaultAnimationSettings
    }
  }, [values.animationSettings])

  // Callbacks memoizados para evitar re-renders
  const handleAnimationChange = useCallback(
    (settings: AnimationSettings) => {
      setFieldValue('animationSettings', JSON.stringify(settings))
      setAnimationKey((prev) => prev + 1) // Recargar preview al cambiar animación
    },
    [setFieldValue]
  )

  const handleFontFamilyChange = useCallback(
    (value: string) => setFieldValue('fontFamily', value),
    [setFieldValue]
  )

  const handleBackgroundChange = useCallback(
    (value: string) => setFieldValue('background', value),
    [setFieldValue]
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
            <Input
              className="!bg-background"
              placeholder="Enter theme name"
              name="name"
              value={values.name}
              onChange={handleChange}
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
            value={values.background}
            onTypeChange={setBackgroundType}
            onValueChange={handleBackgroundChange}
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
          <FontFamilySelector value={values.fontFamily} onChange={handleFontFamilyChange} />
          <Select
            value={String(values.textSize)}
            onValueChange={(value) => setFieldValue('textSize', Number(value))}
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

          {/* Text Color */}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={values.textColor}
              onChange={(e) => setFieldValue('textColor', e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border"
            />
          </div>

          <Separator orientation="vertical" className="!h-6 mx-1" />

          {/* Bold */}
          <Button
            type="button"
            size="icon"
            variant={values.bold ? 'default' : 'ghost'}
            onClick={() => setFieldValue('bold', !values.bold)}
            className="h-8 w-8"
          >
            <Bold className="h-4 w-4" />
          </Button>

          {/* Italic */}
          <Button
            type="button"
            size="icon"
            variant={values.italic ? 'default' : 'ghost'}
            onClick={() => setFieldValue('italic', !values.italic)}
            className="h-8 w-8"
          >
            <Italic className="h-4 w-4" />
          </Button>

          {/* Underline */}
          <Button
            type="button"
            size="icon"
            variant={values.underline ? 'default' : 'ghost'}
            onClick={() => setFieldValue('underline', !values.underline)}
            className="h-8 w-8"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="!h-6 mx-1" />

          {/* Line Height */}
          <Select
            value={String(values.lineHeight)}
            onValueChange={(value) => setFieldValue('lineHeight', Number(value))}
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

          {/* Letter Spacing */}
          <Select
            value={String(values.letterSpacing)}
            onValueChange={(value) => setFieldValue('letterSpacing', Number(value))}
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

          <Separator orientation="vertical" className="!h-6 mx-1" />

          {/* Text Align */}
          <Button
            type="button"
            size="icon"
            variant={values.textAlign === 'left' ? 'default' : 'ghost'}
            onClick={() => setFieldValue('textAlign', 'left')}
            className="h-8 w-8"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="icon"
            variant={values.textAlign === 'center' ? 'default' : 'ghost'}
            onClick={() => setFieldValue('textAlign', 'center')}
            className="h-8 w-8"
          >
            <AlignCenter className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="icon"
            variant={values.textAlign === 'right' ? 'default' : 'ghost'}
            onClick={() => setFieldValue('textAlign', 'right')}
            className="h-8 w-8"
          >
            <AlignRight className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="icon"
            variant={values.textAlign === 'justify' ? 'default' : 'ghost'}
            onClick={() => setFieldValue('textAlign', 'justify')}
            className="h-8 w-8"
          >
            <AlignJustify className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 bg-muted flex items-center justify-center p-4" ref={previewRef}>
        <PresentationView
          key={animationKey}
          theme={values}
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
