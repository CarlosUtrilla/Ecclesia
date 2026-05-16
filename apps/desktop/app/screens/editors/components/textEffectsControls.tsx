import { Blend, Layers, PenLine } from 'lucide-react'
import { ColorPicker } from '@/ui/colorPicker'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { Slider } from '@/ui/slider'
import { Switch } from '@/ui/switch'

export type TextEffectsValue = {
  textShadowEnabled?: boolean
  textShadowColor?: string
  textShadowBlur?: number
  textShadowOffsetX?: number
  textShadowOffsetY?: number
  textStrokeEnabled?: boolean
  textStrokeColor?: string
  textStrokeWidth?: number
  blockBgEnabled?: boolean
  blockBgColor?: string
  blockBgBlur?: number
  blockBgPadding?: number | null
  blockBgOpacity?: number
  blockBgRadius?: number
}

type Props = {
  value: TextEffectsValue
  onChange: (updates: Partial<TextEffectsValue>) => void
  buttonSize?: 'sm' | 'default'
}

export default function TextEffectsControls({ value, onChange, buttonSize = 'sm' }: Props) {
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size={buttonSize}
            variant={value.textShadowEnabled ? 'default' : 'ghost'}
          >
            <Blend className="h-4 w-4" />
            Sombra
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3" side="bottom" align="start">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Sombra de texto</Label>
              <Switch
                checked={!!value.textShadowEnabled}
                onCheckedChange={(checked) => onChange({ textShadowEnabled: checked })}
              />
            </div>
            {value.textShadowEnabled && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <ColorPicker
                    value={value.textShadowColor || 'rgba(0,0,0,0.5)'}
                    onChange={(next) => onChange({ textShadowColor: next })}
                    className="h-7 w-10"
                  />
                </div>
                <RangeControl
                  label="Desenfoque"
                  value={value.textShadowBlur ?? 4}
                  min={0}
                  max={30}
                  step={1}
                  suffix="px"
                  onChange={(next) => onChange({ textShadowBlur: next })}
                />
                <RangeControl
                  label="Desplazamiento X"
                  value={value.textShadowOffsetX ?? 2}
                  min={-20}
                  max={20}
                  step={1}
                  suffix="px"
                  onChange={(next) => onChange({ textShadowOffsetX: next })}
                />
                <RangeControl
                  label="Desplazamiento Y"
                  value={value.textShadowOffsetY ?? 2}
                  min={-20}
                  max={20}
                  step={1}
                  suffix="px"
                  onChange={(next) => onChange({ textShadowOffsetY: next })}
                />
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size={buttonSize}
            variant={value.textStrokeEnabled ? 'default' : 'ghost'}
          >
            <PenLine className="h-4 w-4" />
            Contorno
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3" side="bottom" align="start">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Contorno de texto</Label>
              <Switch
                checked={!!value.textStrokeEnabled}
                onCheckedChange={(checked) => onChange({ textStrokeEnabled: checked })}
              />
            </div>
            {value.textStrokeEnabled && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <ColorPicker
                    value={value.textStrokeColor || '#000000'}
                    onChange={(next) => onChange({ textStrokeColor: next })}
                    className="h-7 w-10"
                  />
                </div>
                <RangeControl
                  label="Grosor"
                  value={value.textStrokeWidth ?? 1}
                  min={0.5}
                  max={10}
                  step={0.5}
                  suffix="px"
                  onChange={(next) => onChange({ textStrokeWidth: next })}
                />
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size={buttonSize}
            variant={value.blockBgEnabled ? 'default' : 'ghost'}
          >
            <Layers className="h-4 w-4" />
            Fondo
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3" side="bottom" align="start">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Fondo de bloque</Label>
              <Switch
                checked={!!value.blockBgEnabled}
                onCheckedChange={(checked) => onChange({ blockBgEnabled: checked })}
              />
            </div>
            {value.blockBgEnabled && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <ColorPicker
                    value={value.blockBgColor || 'rgba(0,0,0,0.5)'}
                    onChange={(next) => onChange({ blockBgColor: next })}
                    className="h-7 w-10"
                  />
                </div>
                <RangeControl
                  label="Desenfoque"
                  value={value.blockBgBlur ?? 0}
                  min={0}
                  max={20}
                  step={1}
                  suffix="px"
                  onChange={(next) => onChange({ blockBgBlur: next })}
                />
                <RangeControl
                  label="Padding"
                  value={value.blockBgPadding ?? 0}
                  min={0}
                  max={80}
                  step={1}
                  suffix={value.blockBgPadding == null ? 'auto' : 'px'}
                  onChange={(next) => onChange({ blockBgPadding: next === 0 ? null : next })}
                />
                <RangeControl
                  label="Opacidad"
                  value={Math.round((value.blockBgOpacity ?? 1) * 100)}
                  min={0}
                  max={100}
                  step={1}
                  suffix="%"
                  onChange={(next) => onChange({ blockBgOpacity: next / 100 })}
                />
                <RangeControl
                  label="Radio"
                  value={value.blockBgRadius ?? 0}
                  min={0}
                  max={40}
                  step={1}
                  suffix="px"
                  onChange={(next) => onChange({ blockBgRadius: next })}
                />
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}

type RangeControlProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (value: number) => void
}

function RangeControl({ label, value, min, max, step, suffix, onChange }: RangeControlProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">
          {suffix === '%' ? `${value}%` : `${value}${suffix}`}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
      />
    </div>
  )
}
