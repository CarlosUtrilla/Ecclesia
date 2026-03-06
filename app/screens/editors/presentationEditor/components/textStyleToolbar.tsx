import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Underline as UnderlineIcon
} from 'lucide-react'
import { Button } from '@/ui/button'
import { ColorPicker } from '@/ui/colorPicker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Separator } from '@/ui/separator'
import FontFamilySelector from '@/ui/fontFamilySelector'
import { fontSizes, lineHeights, letterSpacings } from '@/lib/themeConstants'
import FormatLineSpacingIcon from '@/icons/line-spacing'
import LetterSpacingIcon from '@/icons/letter-spacing'
import { cn } from '@/lib/utils'

export type TextStyleValue = {
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
  className?: string
}

export default function TextStyleToolbar({ value, onChange, className }: Props) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Fuente y tamaño */}
      <FontFamilySelector
        value={value.fontFamily || 'Arial'}
        onChange={(fontFamily) => onChange({ fontFamily })}
        className="w-[130px]"
      />
      <Select
        value={String(value.fontSize || 24)}
        onValueChange={(v) => onChange({ fontSize: Number(v) })}
      >
        <SelectTrigger size="sm" className="w-14">
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
        className="h-7 w-8"
      />

      <Separator orientation="vertical" className="!h-5 mx-0.5" />

      {/* Formato */}
      <Button
        type="button"
        size="icon"
        variant={value.fontWeight === 'bold' ? 'default' : 'ghost'}
        onClick={() => onChange({ fontWeight: value.fontWeight === 'bold' ? 'normal' : 'bold' })}
        className="h-7 w-7"
        title="Negrita"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={value.fontStyle === 'italic' ? 'default' : 'ghost'}
        onClick={() => onChange({ fontStyle: value.fontStyle === 'italic' ? 'normal' : 'italic' })}
        className="h-7 w-7"
        title="Cursiva"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={value.textDecoration === 'underline' ? 'default' : 'ghost'}
        onClick={() =>
          onChange({ textDecoration: value.textDecoration === 'underline' ? 'none' : 'underline' })
        }
        className="h-7 w-7"
        title="Subrayado"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="!h-5 mx-0.5" />

      {/* Alineación horizontal */}
      <Button
        type="button"
        size="icon"
        variant={value.textAlign === 'left' ? 'default' : 'ghost'}
        onClick={() => onChange({ textAlign: 'left' })}
        className="h-7 w-7"
        title="Izquierda"
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={value.textAlign === 'center' || !value.textAlign ? 'default' : 'ghost'}
        onClick={() => onChange({ textAlign: 'center' })}
        className="h-7 w-7"
        title="Centrar"
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={value.textAlign === 'right' ? 'default' : 'ghost'}
        onClick={() => onChange({ textAlign: 'right' })}
        className="h-7 w-7"
        title="Derecha"
      >
        <AlignRight className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="!h-5 mx-0.5" />

      {/* Espaciado */}
      <Select
        value={String(value.lineHeight ?? 1.2)}
        onValueChange={(v) => onChange({ lineHeight: Number(v) })}
      >
        <SelectTrigger size="sm" className="w-[84px] gap-1">
          <FormatLineSpacingIcon className="h-4 w-4 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {lineHeights.map((h) => (
            <SelectItem key={h.value} value={String(h.value)}>
              {h.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(value.letterSpacing ?? 0)}
        onValueChange={(v) => onChange({ letterSpacing: Number(v) })}
      >
        <SelectTrigger size="sm" className="w-[84px] gap-1">
          <LetterSpacingIcon className="h-4 w-4 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {letterSpacings.map((s) => (
            <SelectItem key={s.value} value={String(s.value)}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
