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
import { EditableBoundsTarget } from '@/ui/PresentationView/types'
import {
  getTargetTextEffectsValue,
  getTargetTextStyleFieldPath,
  getTargetTypographyStyle,
  mapTextEffectsUpdatesToTarget
} from './textStyleTarget'

type Props = {
  setValue: any
  watchedData: any
  selectedBoundsTarget: EditableBoundsTarget
  canSelectVerseBounds: boolean
  setSelectedBoundsTarget: (target: EditableBoundsTarget) => void
  handlePreviewAnimation: () => void
  handlePreviewTransition: () => void
}

export default function ThemeToolbar({
  setValue,
  watchedData,
  selectedBoundsTarget,
  canSelectVerseBounds,
  setSelectedBoundsTarget,
  handlePreviewAnimation,
  handlePreviewTransition
}: Props) {
  const targetTextStyle = getTargetTypographyStyle(watchedData.textStyle, selectedBoundsTarget)
  const textEffectsValue: TextEffectsValue = getTargetTextEffectsValue(
    watchedData.textStyle,
    selectedBoundsTarget
  )

  const handleTextEffectsChange = (updates: Partial<TextEffectsValue>) => {
    const mappedUpdates = mapTextEffectsUpdatesToTarget(updates, selectedBoundsTarget)

    for (const [key, nextValue] of Object.entries(mappedUpdates)) {
      setValue(`textStyle.${key}`, nextValue, { shouldDirty: true })
    }
  }

  const setTargetTypographyValue = (
    key: Parameters<typeof getTargetTextStyleFieldPath>[1],
    value: unknown
  ) => {
    setValue(getTargetTextStyleFieldPath(selectedBoundsTarget, key), value, {
      shouldDirty: true
    })
  }

  return (
    <div className="p-2 flex items-center gap-1 border-b flex-wrap">
      <div className="flex items-center gap-1 rounded-md border px-1 py-1 mr-1">
        <Button
          type="button"
          size="sm"
          variant={selectedBoundsTarget === 'text' ? 'default' : 'ghost'}
          className="h-7 px-2 text-xs"
          onClick={() => setSelectedBoundsTarget('text')}
        >
          Texto
        </Button>
        <Button
          type="button"
          size="sm"
          variant={selectedBoundsTarget === 'verse' ? 'default' : 'ghost'}
          className="h-7 px-2 text-xs"
          disabled={!canSelectVerseBounds}
          onClick={() => setSelectedBoundsTarget('verse')}
        >
          Indicador
        </Button>
      </div>

      <FontFamilySelector
        value={targetTextStyle.fontFamily || 'Arial'}
        onChange={(value) => setTargetTypographyValue('fontFamily', value)}
      />

      <Select
        value={String(targetTextStyle.fontSize || 24)}
        onValueChange={(v) => setTargetTypographyValue('fontSize', Number(v))}
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

      <ColorPicker
        data-testid="color-picker"
        value={targetTextStyle.color || '#000000'}
        onChange={(value) => setTargetTypographyValue('color', value)}
        className="h-8 w-10"
      />

      <Separator orientation="vertical" className="!h-6 mx-1" />

      <Button
        data-testid="bold-btn"
        type="button"
        size="icon"
        variant={targetTextStyle.fontWeight === 'bold' ? 'default' : 'ghost'}
        onClick={() =>
          setTargetTypographyValue(
            'fontWeight',
            targetTextStyle.fontWeight === 'bold' ? undefined : 'bold'
          )
        }
        className="h-8 w-8"
      >
        <Bold className="h-4 w-4" />
      </Button>

      <Button
        data-testid="italic-btn"
        type="button"
        size="icon"
        variant={targetTextStyle.fontStyle === 'italic' ? 'default' : 'ghost'}
        onClick={() =>
          setTargetTypographyValue(
            'fontStyle',
            targetTextStyle.fontStyle === 'italic' ? undefined : 'italic'
          )
        }
        className="h-8 w-8"
      >
        <Italic className="h-4 w-4" />
      </Button>

      <Button
        data-testid="underline-btn"
        type="button"
        size="icon"
        variant={targetTextStyle.textDecoration === 'underline' ? 'default' : 'ghost'}
        onClick={() =>
          setTargetTypographyValue(
            'textDecoration',
            targetTextStyle.textDecoration === 'underline' ? undefined : 'underline'
          )
        }
        className="h-8 w-8"
      >
        <UnderlineIcon className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="!h-6 mx-1" />

      <Select
        value={String(targetTextStyle.lineHeight || 1.2)}
        onValueChange={(v) => setTargetTypographyValue('lineHeight', Number(v))}
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

      <Select
        value={String(targetTextStyle.letterSpacing || 0)}
        onValueChange={(v) => setTargetTypographyValue('letterSpacing', Number(v))}
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

      <>
        <Button
          data-testid="align-left"
          type="button"
          size="icon"
          variant={targetTextStyle.textAlign === 'left' ? 'default' : 'ghost'}
          onClick={() => setTargetTypographyValue('textAlign', 'left')}
          className="h-8 w-8"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          data-testid="align-center"
          type="button"
          size="icon"
          variant={targetTextStyle.textAlign === 'center' ? 'default' : 'ghost'}
          onClick={() => setTargetTypographyValue('textAlign', 'center')}
          className="h-8 w-8"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          data-testid="align-right"
          type="button"
          size="icon"
          variant={targetTextStyle.textAlign === 'right' ? 'default' : 'ghost'}
          onClick={() => setTargetTypographyValue('textAlign', 'right')}
          className="h-8 w-8"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          data-testid="align-justify"
          type="button"
          size="icon"
          variant={targetTextStyle.textAlign === 'justify' ? 'default' : 'ghost'}
          onClick={() => setTargetTypographyValue('textAlign', 'justify')}
          className="h-8 w-8"
        >
          <AlignJustify className="h-4 w-4" />
        </Button>
      </>

      <Separator orientation="vertical" className="!h-6 mx-1" />

      <Select
        value={String(targetTextStyle.justifyContent || 'center')}
        onValueChange={(value) =>
          setTargetTypographyValue('justifyContent', value as 'flex-start' | 'center' | 'flex-end')
        }
      >
        <SelectTrigger size="sm" className="w-[120px]">
          <SelectValue placeholder="Alineación Y" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="flex-start">Arriba</SelectItem>
          <SelectItem value="center">Centro</SelectItem>
          <SelectItem value="flex-end">Abajo</SelectItem>
        </SelectContent>
      </Select>

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
