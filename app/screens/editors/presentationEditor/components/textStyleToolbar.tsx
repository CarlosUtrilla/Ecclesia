import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  RotateCcw,
  SlidersHorizontal,
  Type,
  Underline as UnderlineIcon
} from 'lucide-react'
import { Button } from '@/ui/button'
import { ColorPicker } from '@/ui/colorPicker'
import { Input } from '@/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Separator } from '@/ui/separator'
import { Slider } from '@/ui/slider'
import FontFamilySelector from '@/ui/fontFamilySelector'
import FormatLineSpacingIcon from '@/icons/line-spacing'
import LetterSpacingIcon from '@/icons/letter-spacing'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/ui/dropdown-menu'
import { fontSizes, letterSpacings, lineHeights } from '@/lib/themeConstants'
import { cn } from '@/lib/utils'

type TextStyleValue = {
  fontFamily?: string
  fontSize?: number
  color?: string
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline'
  lineHeight?: number
  letterSpacing?: number
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  verticalAlign?: 'top' | 'center' | 'bottom'
  offsetX?: number
  offsetY?: number
}

type Props = {
  value: TextStyleValue
  onChange: (updates: Partial<TextStyleValue>) => void
  containerClassName?: string
}

export default function TextStyleToolbar({ value, onChange, containerClassName }: Props) {
  const offsetX = Number(value.offsetX ?? 0)
  const offsetY = Number(value.offsetY ?? 0)

  return (
    <div className={cn('p-2 flex items-center gap-1 border-b flex-wrap', containerClassName)}>
      <FontFamilySelector
        value={value.fontFamily || 'Arial'}
        onChange={(fontFamily) => onChange({ fontFamily })}
      />

      <Select
        value={String(value.fontSize || 24)}
        onValueChange={(v) => onChange({ fontSize: Number(v) })}
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
        value={value.color || '#ffffff'}
        onChange={(color) => onChange({ color })}
        className="h-8 w-10"
      />

      <Separator orientation="vertical" className="!h-6 mx-1" />

      <Button
        type="button"
        size="icon"
        variant={value.fontWeight === 'bold' ? 'default' : 'ghost'}
        onClick={() => onChange({ fontWeight: value.fontWeight === 'bold' ? 'normal' : 'bold' })}
        className="h-8 w-8"
      >
        <Bold className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        size="icon"
        variant={value.fontStyle === 'italic' ? 'default' : 'ghost'}
        onClick={() => onChange({ fontStyle: value.fontStyle === 'italic' ? 'normal' : 'italic' })}
        className="h-8 w-8"
      >
        <Italic className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        size="icon"
        variant={value.textDecoration === 'underline' ? 'default' : 'ghost'}
        onClick={() =>
          onChange({ textDecoration: value.textDecoration === 'underline' ? 'none' : 'underline' })
        }
        className="h-8 w-8"
      >
        <UnderlineIcon className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="!h-6 mx-1" />

      <Select
        value={String(value.lineHeight || 1.2)}
        onValueChange={(v) => onChange({ lineHeight: Number(v) })}
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
        value={String(value.letterSpacing || 0)}
        onValueChange={(v) => onChange({ letterSpacing: Number(v) })}
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

      <Button
        type="button"
        size="icon"
        variant={value.textAlign === 'left' ? 'default' : 'ghost'}
        onClick={() => onChange({ textAlign: 'left' })}
        className="h-8 w-8"
      >
        <AlignLeft className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        size="icon"
        variant={value.textAlign === 'center' ? 'default' : 'ghost'}
        onClick={() => onChange({ textAlign: 'center' })}
        className="h-8 w-8"
      >
        <AlignCenter className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        size="icon"
        variant={value.textAlign === 'right' ? 'default' : 'ghost'}
        onClick={() => onChange({ textAlign: 'right' })}
        className="h-8 w-8"
      >
        <AlignRight className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        size="icon"
        variant={value.textAlign === 'justify' ? 'default' : 'ghost'}
        onClick={() => onChange({ textAlign: 'justify' })}
        className="h-8 w-8"
      >
        <AlignJustify className="h-4 w-4" />
      </Button>

      <Select
        value={value.verticalAlign || 'center'}
        onValueChange={(v) => onChange({ verticalAlign: v as TextStyleValue['verticalAlign'] })}
      >
        <SelectTrigger size="sm" className="w-[108px]">
          <SelectValue placeholder="Alineación Y" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="top">Arriba</SelectItem>
          <SelectItem value="center">Centro</SelectItem>
          <SelectItem value="bottom">Abajo</SelectItem>
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="!h-6 mx-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="outline" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Posición
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[320px] p-3 space-y-3">
          <div className="w-full flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Posición X</span>
            <Slider
              value={[offsetX]}
              min={-300}
              max={300}
              step={1}
              onValueChange={(next) => onChange({ offsetX: next[0] ?? 0 })}
            />
            <div className="relative w-16 shrink-0">
              <Input
                type="number"
                min={-300}
                max={300}
                step={1}
                className="h-6 w-16 pr-6 pl-2 text-right text-xs"
                value={offsetX}
                onChange={(event) => {
                  const nextValue = Number(event.target.value)
                  onChange({ offsetX: Number.isFinite(nextValue) ? nextValue : 0 })
                }}
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                px
              </span>
            </div>
          </div>

          <div className="w-full flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Posición Y</span>
            <Slider
              value={[offsetY]}
              min={-200}
              max={200}
              step={1}
              onValueChange={(next) => onChange({ offsetY: next[0] ?? 0 })}
            />
            <div className="relative w-16 shrink-0">
              <Input
                type="number"
                min={-200}
                max={200}
                step={1}
                className="h-6 w-16 pr-6 pl-2 text-right text-xs"
                value={offsetY}
                onChange={(event) => {
                  const nextValue = Number(event.target.value)
                  onChange({ offsetY: Number.isFinite(nextValue) ? nextValue : 0 })
                }}
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                px
              </span>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full gap-2"
            onClick={() => onChange({ offsetX: 0, offsetY: 0 })}
          >
            <RotateCcw className="h-4 w-4" />
            Centrar / Restablecer
          </Button>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
