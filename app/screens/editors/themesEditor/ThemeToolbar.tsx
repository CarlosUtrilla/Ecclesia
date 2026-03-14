import { Controller } from 'react-hook-form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Button } from '@/ui/button'
import { ColorPicker } from '@/ui/colorPicker'
import FontFamilySelector from '@/ui/fontFamilySelector'
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline as UnderlineIcon
} from 'lucide-react'
import FormatLineSpacingIcon from '@/icons/line-spacing'
import LetterSpacingIcon from '@/icons/letter-spacing'
import { Separator } from '@/ui/separator'
import { fontSizes, lineHeights, letterSpacings } from '@/lib/themeConstants'
import TextEffectsControls, { TextEffectsValue } from '../components/textEffectsControls'

type Props = {
  control: any
  setValue: any
  watchedData: any
  handlePreviewAnimation: () => void
  handlePreviewTransition: () => void
}

export default function ThemeToolbar({
  control,
  setValue,
  watchedData,
  handlePreviewAnimation,
  handlePreviewTransition
}: Props) {
  const textEffectsValue: TextEffectsValue = watchedData.textStyle || {}

  const handleTextEffectsChange = (updates: Partial<TextEffectsValue>) => {
    for (const [key, nextValue] of Object.entries(updates)) {
      setValue(`textStyle.${key}`, nextValue, { shouldDirty: true })
    }
  }

  return (
    <div className="p-2 flex items-center gap-1 border-b flex-wrap">
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

      <Controller
        name="textStyle.color"
        control={control}
        render={({ field }) => (
          <ColorPicker
            data-testid="color-picker"
            value={field.value || '#000000'}
            onChange={field.onChange}
            className="h-8 w-10"
          />
        )}
      />

      <Separator orientation="vertical" className="!h-6 mx-1" />

      <Controller
        name="textStyle.fontWeight"
        control={control}
        render={({ field }) => (
          <Button
            data-testid="bold-btn"
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

      <Controller
        name="textStyle.fontStyle"
        control={control}
        render={({ field }) => (
          <Button
            data-testid="italic-btn"
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

      <Controller
        name="textStyle.textDecoration"
        control={control}
        render={({ field }) => (
          <Button
            data-testid="underline-btn"
            type="button"
            size="icon"
            variant={field.value === 'underline' ? 'default' : 'ghost'}
            onClick={() => field.onChange(field.value === 'underline' ? undefined : 'underline')}
            className="h-8 w-8"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
        )}
      />

      <Separator orientation="vertical" className="!h-6 mx-1" />

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

      <Controller
        name="textStyle.letterSpacing"
        control={control}
        render={({ field }) => (
          <Select value={String(field.value || 0)} onValueChange={(v) => field.onChange(Number(v))}>
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

      <Controller
        name="textStyle.textAlign"
        control={control}
        render={({ field }) => (
          <>
            <Button
              data-testid="align-left"
              type="button"
              size="icon"
              variant={field.value === 'left' ? 'default' : 'ghost'}
              onClick={() => field.onChange('left')}
              className="h-8 w-8"
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              data-testid="align-center"
              type="button"
              size="icon"
              variant={field.value === 'center' ? 'default' : 'ghost'}
              onClick={() => field.onChange('center')}
              className="h-8 w-8"
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              data-testid="align-right"
              type="button"
              size="icon"
              variant={field.value === 'right' ? 'default' : 'ghost'}
              onClick={() => field.onChange('right')}
              className="h-8 w-8"
            >
              <AlignRight className="h-4 w-4" />
            </Button>
            <Button
              data-testid="align-justify"
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

      <Separator orientation="vertical" className="!h-6 mx-1" />

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

      <TextEffectsControls value={textEffectsValue} onChange={handleTextEffectsChange} />

      <div className="ml-auto flex items-center gap-2">
        <Button data-testid="preview-animation" onClick={handlePreviewAnimation} size="sm">
          Animación
        </Button>
        <Button data-testid="preview-transition" onClick={handlePreviewTransition} size="sm">
          Transición
        </Button>
      </div>
    </div>
  )
}
