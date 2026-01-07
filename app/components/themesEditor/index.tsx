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
import React, { useRef } from 'react'
import { Separator } from '@/ui/separator'
import FontFamilySelector from '@/ui/fontFamilySelector'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import FormatLineSpacingIcon from '@/icons/line-spacing'
import LetterSpacingIcon from '@/icons/letter-spacing'
import BackgroundSelector from './backgroundSelector'
import AnimationSelector from './animationSelector'
import { PresentationView } from '../PresentationView'
import { defaultAnimationSettings, AnimationSettings } from '@/lib/animationSettings'

import { useResizeObserver } from 'usehooks-ts'

const fontSizes = [
  { label: '12px', value: 12 },
  { label: '14px', value: 14 },
  { label: '16px', value: 16 },
  { label: '18px', value: 18 },
  { label: '20px', value: 20 },
  { label: '24px', value: 24 },
  { label: '28px', value: 28 },
  { label: '32px', value: 32 },
  { label: '36px', value: 36 },
  { label: '48px', value: 48 },
  { label: '64px', value: 64 }
]

const lineHeights = [
  { label: '1.0', value: 1.0 },
  { label: '1.2', value: 1.2 },
  { label: '1.5', value: 1.5 },
  { label: '1.8', value: 1.8 },
  { label: '2.0', value: 2.0 }
]

const letterSpacings = [
  { label: 'Normal', value: 0 },
  { label: '0.5px', value: 0.5 },
  { label: '1px', value: 1 },
  { label: '2px', value: 2 },
  { label: '3px', value: 3 },
  { label: '4px', value: 4 }
]

type BackgroundType = 'color' | 'gradient' | 'image' | 'video'

export default function ThemesEditor() {
  const previewRef = useRef<HTMLDivElement>(null)
  const { height = 0 } = useResizeObserver({
    ref: previewRef as React.RefObject<HTMLDivElement>
  })

  const [backgroundType, setBackgroundType] = React.useState<BackgroundType>('color')
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

  // Parse animation settings
  const animationSettings: AnimationSettings = React.useMemo(() => {
    try {
      return JSON.parse(values.animationSettings)
    } catch {
      return defaultAnimationSettings
    }
  }, [values.animationSettings])
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
            onValueChange={(value) => setFieldValue('background', value)}
          />
          <Separator orientation="vertical" className="!h-16 mx-1" />

          {/* Animation Selector */}
          <AnimationSelector
            settings={animationSettings}
            onChange={(settings) => setFieldValue('animationSettings', JSON.stringify(settings))}
          />
        </div>

        {/* Barra de herramientas de estilo */}
        <div className="p-2 flex items-center gap-1 border-b flex-wrap">
          {/* Font Size */}
          <FontFamilySelector
            value={values.fontFamily}
            onChange={(value) => setFieldValue('fontFamily', value)}
          />
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
