import { Controller } from 'react-hook-form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Button } from '@/ui/button'
import { Slider } from '@/ui/slider'
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
  Underline as UnderlineIcon,
  Blend,
  PenLine,
  Layers
} from 'lucide-react'
import FormatLineSpacingIcon from '@/icons/line-spacing'
import LetterSpacingIcon from '@/icons/letter-spacing'
import { Separator } from '@/ui/separator'
import { fontSizes, lineHeights, letterSpacings } from '@/lib/themeConstants'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { Switch } from '@/ui/switch'
import { Label } from '@/ui/label'

type Props = {
  control: any
  watchedData: any
  handlePreviewAnimation: () => void
  handlePreviewTransition: () => void
}

export default function ThemeToolbar({
  control,
  watchedData,
  handlePreviewAnimation,
  handlePreviewTransition
}: Props) {
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

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={watchedData.textStyle?.textShadowEnabled ? 'default' : 'ghost'}
          >
            <Blend className="h-4 w-4" />
            Sombra
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3" side="bottom" align="start">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Sombra de texto</Label>
              <Controller
                name="textStyle.textShadowEnabled"
                control={control}
                render={({ field }) => (
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            {watchedData.textStyle?.textShadowEnabled && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <Controller
                    name="textStyle.textShadowColor"
                    control={control}
                    render={({ field }) => (
                      <ColorPicker
                        value={field.value || 'rgba(0,0,0,0.5)'}
                        onChange={field.onChange}
                        className="h-7 w-10"
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Desenfoque</Label>
                    <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                      {watchedData.textStyle?.textShadowBlur ?? 4}px
                    </span>
                  </div>
                  <Controller
                    name="textStyle.textShadowBlur"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        min={0}
                        max={30}
                        step={1}
                        value={[field.value ?? 4]}
                        onValueChange={([v]) => field.onChange(v)}
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Desplazamiento X</Label>
                    <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                      {watchedData.textStyle?.textShadowOffsetX ?? 2}px
                    </span>
                  </div>
                  <Controller
                    name="textStyle.textShadowOffsetX"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        min={-20}
                        max={20}
                        step={1}
                        value={[field.value ?? 2]}
                        onValueChange={([v]) => field.onChange(v)}
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Desplazamiento Y</Label>
                    <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                      {watchedData.textStyle?.textShadowOffsetY ?? 2}px
                    </span>
                  </div>
                  <Controller
                    name="textStyle.textShadowOffsetY"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        min={-20}
                        max={20}
                        step={1}
                        value={[field.value ?? 2]}
                        onValueChange={([v]) => field.onChange(v)}
                      />
                    )}
                  />
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={watchedData.textStyle?.textStrokeEnabled ? 'default' : 'ghost'}
          >
            <PenLine className="h-4 w-4" />
            Contorno
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3" side="bottom" align="start">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Contorno de texto</Label>
              <Controller
                name="textStyle.textStrokeEnabled"
                control={control}
                render={({ field }) => (
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            {watchedData.textStyle?.textStrokeEnabled && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <Controller
                    name="textStyle.textStrokeColor"
                    control={control}
                    render={({ field }) => (
                      <ColorPicker
                        value={field.value || '#000000'}
                        onChange={field.onChange}
                        className="h-7 w-10"
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Grosor</Label>
                    <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                      {watchedData.textStyle?.textStrokeWidth ?? 1}px
                    </span>
                  </div>
                  <Controller
                    name="textStyle.textStrokeWidth"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        min={0.5}
                        max={10}
                        step={0.5}
                        value={[field.value ?? 1]}
                        onValueChange={([v]) => field.onChange(v)}
                      />
                    )}
                  />
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={watchedData.textStyle?.blockBgEnabled ? 'default' : 'ghost'}
          >
            <Layers className="h-4 w-4" />
            Fondo
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3" side="bottom" align="start">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Fondo de bloque</Label>
              <Controller
                name="textStyle.blockBgEnabled"
                control={control}
                render={({ field }) => (
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            {watchedData.textStyle?.blockBgEnabled && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <Controller
                    name="textStyle.blockBgColor"
                    control={control}
                    render={({ field }) => (
                      <ColorPicker
                        value={field.value || 'rgba(0,0,0,0.5)'}
                        onChange={field.onChange}
                        className="h-7 w-10"
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Desenfoque</Label>
                    <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                      {watchedData.textStyle?.blockBgBlur ?? 0}px
                    </span>
                  </div>
                  <Controller
                    name="textStyle.blockBgBlur"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        min={0}
                        max={20}
                        step={1}
                        value={[field.value ?? 0]}
                        onValueChange={([v]) => field.onChange(v)}
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Padding</Label>
                    <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                      {watchedData.textStyle?.blockBgPadding ?? 'auto'}
                      {watchedData.textStyle?.blockBgPadding != null ? 'px' : ''}
                    </span>
                  </div>
                  <Controller
                    name="textStyle.blockBgPadding"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        min={0}
                        max={80}
                        step={1}
                        value={[field.value ?? 0]}
                        onValueChange={([v]) => field.onChange(v === 0 ? null : v)}
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Opacidad</Label>
                    <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                      {Math.round((watchedData.textStyle?.blockBgOpacity ?? 1) * 100)}%
                    </span>
                  </div>
                  <Controller
                    name="textStyle.blockBgOpacity"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={[field.value ?? 1]}
                        onValueChange={([v]) => field.onChange(v)}
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Radio</Label>
                    <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                      {watchedData.textStyle?.blockBgRadius ?? 0}px
                    </span>
                  </div>
                  <Controller
                    name="textStyle.blockBgRadius"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        min={0}
                        max={40}
                        step={1}
                        value={[field.value ?? 0]}
                        onValueChange={([v]) => field.onChange(v)}
                      />
                    )}
                  />
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

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
