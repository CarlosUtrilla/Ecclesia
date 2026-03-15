import type { Media } from '@prisma/client'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowRight,
  Bold,
  Circle,
  FileImage,
  Italic,
  Minus,
  Plus,
  Square,
  TextCursorInput,
  Underline as UnderlineIcon,
  Zap
} from 'lucide-react'
import { Button } from '@/ui/button'
import { ColorPicker } from '@/ui/colorPicker'
import FontFamilySelector from '@/ui/fontFamilySelector'
import { Input } from '@/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Slider } from '@/ui/slider'
import { Textarea } from '@/ui/textarea'
import FormatLineSpacingIcon from '@/icons/line-spacing'
import LetterSpacingIcon from '@/icons/letter-spacing'
import TextEffectsControls from '../../components/textEffectsControls'
import { buildBibleAccessData, parseBibleAccessData } from '../utils/bibleAccessData'
import {
  getShapeTypeFromAccessData,
  type CanvasItemStyle,
  type PresentationSlide,
  type PresentationSlideItem
} from '../utils/slideUtils'

type TextStyleUpdates = Partial<{
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
  shapeFill?: string
  shapeStroke?: string
  shapeStrokeWidth?: number
  shapeOpacity?: number
}>

type Props = {
  selectedItem: PresentationSlideItem | undefined
  selectedItemStyle: CanvasItemStyle | undefined
  selectedSlide: PresentationSlide | undefined
  selectedMediaId: number | undefined
  media: Media[]
  updateSelectedTextStyle: (updates: TextStyleUpdates) => void
  updateSelectedItem: (updates: Partial<PresentationSlideItem>) => void
  loadBibleText: () => Promise<void>
  replaceSelectedMedia: () => void
  onVideoLiveBehaviorChange: (value: 'auto' | 'manual') => void
  onVideoLoopChange: (value: boolean) => void
}

export default function TextTabContent({
  selectedItem,
  selectedItemStyle,
  selectedSlide,
  selectedMediaId,
  media,
  updateSelectedTextStyle,
  updateSelectedItem,
  loadBibleText,
  replaceSelectedMedia,
  onVideoLiveBehaviorChange,
  onVideoLoopChange
}: Props) {
  const selectedMediaItem = selectedMediaId
    ? media.find((item) => item.id === selectedMediaId)
    : undefined
  const isSelectedVideo = selectedMediaItem?.type === 'VIDEO'

  const shapePresets = [
    {
      name: 'Énfasis',
      updates: {
        shapeFill: 'rgba(59, 130, 246, 0.18)',
        shapeStroke: '#2563eb',
        shapeStrokeWidth: 4,
        shapeOpacity: 1,
        color: '#1e3a8a'
      }
    },
    {
      name: 'Advertencia',
      updates: {
        shapeFill: 'rgba(245, 158, 11, 0.18)',
        shapeStroke: '#d97706',
        shapeStrokeWidth: 5,
        shapeOpacity: 1,
        color: '#78350f'
      }
    },
    {
      name: 'Marco',
      updates: {
        shapeFill: 'rgba(255, 255, 255, 0)',
        shapeStroke: '#0f172a',
        shapeStrokeWidth: 6,
        shapeOpacity: 1,
        color: '#0f172a'
      }
    },
    {
      name: 'Oscuro',
      updates: {
        shapeFill: 'rgba(15, 23, 42, 0.65)',
        shapeStroke: '#0f172a',
        shapeStrokeWidth: 2,
        shapeOpacity: 1,
        color: '#f8fafc'
      }
    }
  ] as const

  const isTextSelected =
    selectedItem &&
    selectedItemStyle &&
    (selectedItem.type === 'TEXT' ||
      selectedItem.type === 'BIBLE' ||
      selectedItem.type === 'SONG' ||
      selectedItem.type === 'GROUP')

  if (isTextSelected) {
    return (
      <div className="p-3 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Fuente
          </span>
          <FontFamilySelector
            value={selectedItemStyle.fontFamily || 'Arial'}
            onChange={(fontFamily) => updateSelectedTextStyle({ fontFamily })}
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Tamaño
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0"
              onClick={() =>
                updateSelectedTextStyle({
                  fontSize: Math.max(1, (selectedItemStyle.fontSize || 24) - 1)
                })
              }
            >
              <Minus className="size-3.5" />
            </Button>
            <Input
              type="number"
              containerClassName="w-auto flex-1"
              className="h-8 text-center"
              value={selectedItemStyle.fontSize || 24}
              onChange={(e) => updateSelectedTextStyle({ fontSize: Number(e.target.value) })}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0"
              onClick={() =>
                updateSelectedTextStyle({
                  fontSize: (selectedItemStyle.fontSize || 24) + 1
                })
              }
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Estilo
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              size="icon"
              variant={selectedItemStyle.fontWeight === 'bold' ? 'default' : 'outline'}
              className="h-8 w-8"
              title="Negrita"
              onClick={() =>
                updateSelectedTextStyle({
                  fontWeight: selectedItemStyle.fontWeight === 'bold' ? 'normal' : 'bold'
                })
              }
            >
              <Bold className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={selectedItemStyle.fontStyle === 'italic' ? 'default' : 'outline'}
              className="h-8 w-8"
              title="Cursiva"
              onClick={() =>
                updateSelectedTextStyle({
                  fontStyle: selectedItemStyle.fontStyle === 'italic' ? 'normal' : 'italic'
                })
              }
            >
              <Italic className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={selectedItemStyle.textDecoration === 'underline' ? 'default' : 'outline'}
              className="h-8 w-8"
              title="Subrayado"
              onClick={() =>
                updateSelectedTextStyle({
                  textDecoration:
                    selectedItemStyle.textDecoration === 'underline' ? 'none' : 'underline'
                })
              }
            >
              <UnderlineIcon className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Alineación horizontal
          </span>
          <div className="flex gap-1">
            {(
              [
                { value: 'left', Icon: AlignLeft, label: 'Izquierda' },
                { value: 'center', Icon: AlignCenter, label: 'Centro' },
                { value: 'right', Icon: AlignRight, label: 'Derecha' },
                { value: 'justify', Icon: AlignJustify, label: 'Justificado' }
              ] as const
            ).map(({ value, Icon, label }) => (
              <Button
                key={value}
                type="button"
                size="icon"
                variant={selectedItemStyle.textAlign === value ? 'default' : 'outline'}
                className="h-8 w-8"
                title={label}
                onClick={() => updateSelectedTextStyle({ textAlign: value })}
              >
                <Icon className="size-3.5" />
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Alineación vertical
          </span>
          <div className="flex gap-1">
            {(
              [
                { value: 'top', Icon: AlignVerticalJustifyStart, label: 'Arriba' },
                { value: 'center', Icon: AlignVerticalJustifyCenter, label: 'Centro' },
                { value: 'bottom', Icon: AlignVerticalJustifyEnd, label: 'Abajo' }
              ] as const
            ).map(({ value, Icon, label }) => (
              <Button
                key={value}
                type="button"
                size="icon"
                variant={selectedItemStyle.verticalAlign === value ? 'default' : 'outline'}
                className="h-8 w-8"
                title={label}
                onClick={() => updateSelectedTextStyle({ verticalAlign: value })}
              >
                <Icon className="size-3.5" />
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Espaciado
          </span>
          <div className="flex items-center gap-2">
            <FormatLineSpacingIcon size={16} />
            <span className="text-xs text-muted-foreground w-5 shrink-0">LH</span>
            <Slider
              value={[selectedItemStyle.lineHeight ?? 1.2]}
              min={0.8}
              max={3}
              step={0.1}
              className="flex-1"
              onValueChange={([v]) => updateSelectedTextStyle({ lineHeight: v })}
            />
            <span className="text-xs tabular-nums w-7 text-right shrink-0">
              {(selectedItemStyle.lineHeight ?? 1.2).toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LetterSpacingIcon size={16} />
            <span className="text-xs text-muted-foreground w-5 shrink-0">LS</span>
            <Slider
              value={[selectedItemStyle.letterSpacing ?? 0]}
              min={-5}
              max={20}
              step={0.5}
              className="flex-1"
              onValueChange={([v]) => updateSelectedTextStyle({ letterSpacing: v })}
            />
            <span className="text-xs tabular-nums w-7 text-right shrink-0">
              {(selectedItemStyle.letterSpacing ?? 0).toFixed(1)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Color de texto
          </span>
          <ColorPicker
            value={selectedItemStyle.color || '#ffffff'}
            onChange={(color) => updateSelectedTextStyle({ color })}
            className="w-full h-9"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Efectos
          </span>
          <div className="flex flex-wrap gap-1">
            <TextEffectsControls value={selectedItemStyle} onChange={updateSelectedTextStyle} />
          </div>
        </div>

        {selectedItem.type === 'BIBLE' && (
          <BibleReferenceEditor
            selectedItem={selectedItem}
            updateSelectedItem={updateSelectedItem}
            loadBibleText={loadBibleText}
          />
        )}
      </div>
    )
  }

  if (selectedItem?.type === 'MEDIA') {
    return (
      <div className="p-3 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Imagen / Video
          </span>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-9 justify-start gap-2 text-xs"
            onClick={replaceSelectedMedia}
          >
            <FileImage className="size-4" />
            Cambiar archivo
          </Button>
          <Select
            value={selectedMediaId ? String(selectedMediaId) : undefined}
            onValueChange={(v) => updateSelectedItem({ accessData: v })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Seleccionar media" />
            </SelectTrigger>
            <SelectContent>
              {media.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedSlide && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Reproducción en vivo
            </span>
            <Select
              value={selectedSlide.videoLiveBehavior || 'manual'}
              onValueChange={onVideoLiveBehaviorChange}
            >
              <SelectTrigger className="h-9 text-xs">
                <Zap className="size-3.5 mr-1 shrink-0" />
                <SelectValue placeholder="Video live" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Inicio manual</SelectItem>
                <SelectItem value="auto">Inicio automático</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedSlide && isSelectedVideo ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Repetición
            </span>
            <Button
              type="button"
              variant={selectedSlide.videoLoop ? 'default' : 'outline'}
              className="h-9 justify-start text-xs"
              onClick={() => onVideoLoopChange(!selectedSlide.videoLoop)}
            >
              {selectedSlide.videoLoop ? 'Se repite al terminar' : 'No se repite'}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  if (selectedItem?.type === 'SHAPE' && selectedItemStyle) {
    const shapeType = getShapeTypeFromAccessData(selectedItem.accessData)
    const ShapeIcon =
      shapeType === 'circle' ? Circle : shapeType === 'arrow' ? ArrowRight : Square
    const shapeLabel =
      shapeType === 'circle'
        ? 'Círculo'
        : shapeType === 'arrow'
          ? 'Flecha'
          : shapeType === 'line-arrow'
            ? 'Flecha de línea'
            : shapeType === 'triangle'
              ? 'Triángulo'
              : shapeType === 'line'
                ? 'Línea'
                : shapeType === 'cross'
                  ? 'Cruz'
                  : 'Rectángulo'

    return (
      <div className="p-3 flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <ShapeIcon className="size-4" />
          <span>Forma seleccionada: {shapeLabel}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Presets
          </span>
          <div className="grid grid-cols-2 gap-2">
            {shapePresets.map((preset) => (
              <Button
                key={preset.name}
                type="button"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => updateSelectedTextStyle(preset.updates)}
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Relleno
          </span>
          <ColorPicker
            value={selectedItemStyle.shapeFill || 'rgba(59, 130, 246, 0.18)'}
            onChange={(shapeFill) => updateSelectedTextStyle({ shapeFill })}
            className="w-full h-9"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Borde
          </span>
          <ColorPicker
            value={selectedItemStyle.shapeStroke || '#2563eb'}
            onChange={(shapeStroke) => updateSelectedTextStyle({ shapeStroke })}
            className="w-full h-9"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Grosor del borde
          </span>
          <div className="flex items-center gap-2">
            <Slider
              value={[selectedItemStyle.shapeStrokeWidth ?? 4]}
              min={1}
              max={12}
              step={1}
              className="flex-1"
              onValueChange={([shapeStrokeWidth]) =>
                updateSelectedTextStyle({ shapeStrokeWidth })
              }
            />
            <span className="text-xs tabular-nums w-8 text-right shrink-0">
              {selectedItemStyle.shapeStrokeWidth ?? 4}px
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Opacidad
          </span>
          <div className="flex items-center gap-2">
            <Slider
              value={[Math.round((selectedItemStyle.shapeOpacity ?? 1) * 100)]}
              min={10}
              max={100}
              step={5}
              className="flex-1"
              onValueChange={([value]) => updateSelectedTextStyle({ shapeOpacity: value / 100 })}
            />
            <span className="text-xs tabular-nums w-10 text-right shrink-0">
              {Math.round((selectedItemStyle.shapeOpacity ?? 1) * 100)}%
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Texto
          </span>
          <div className="flex items-center gap-2">
            <Slider
              value={[selectedItemStyle.fontSize || 36]}
              min={12}
              max={96}
              step={1}
              className="flex-1"
              onValueChange={([fontSize]) => updateSelectedTextStyle({ fontSize })}
            />
            <span className="text-xs tabular-nums w-10 text-right shrink-0">
              {selectedItemStyle.fontSize || 36}px
            </span>
          </div>
          <ColorPicker
            value={selectedItemStyle.color || '#1e293b'}
            onChange={(color) => updateSelectedTextStyle({ color })}
            className="w-full h-9"
          />
          <div className="flex gap-1">
            {(
              [
                { value: 'left', Icon: AlignLeft, label: 'Izquierda' },
                { value: 'center', Icon: AlignCenter, label: 'Centro' },
                { value: 'right', Icon: AlignRight, label: 'Derecha' }
              ] as const
            ).map(({ value, Icon, label }) => (
              <Button
                key={value}
                type="button"
                size="icon"
                variant={selectedItemStyle.textAlign === value ? 'default' : 'outline'}
                className="h-8 w-8"
                title={label}
                onClick={() => updateSelectedTextStyle({ textAlign: value })}
              >
                <Icon className="size-3.5" />
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Texto interior
          </span>
          <Textarea
            value={selectedItem.text || ''}
            onChange={(event) => updateSelectedItem({ text: event.target.value })}
            placeholder="Texto dentro de la forma"
            className="min-h-24 resize-y"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-2 px-4">
      <TextCursorInput className="size-8 text-muted-foreground/30" />
      <p className="text-xs text-muted-foreground leading-relaxed">
        Selecciona un elemento de texto para editar sus propiedades
      </p>
    </div>
  )
}

type BibleReferenceEditorProps = {
  selectedItem: PresentationSlideItem
  updateSelectedItem: (updates: Partial<PresentationSlideItem>) => void
  loadBibleText: () => Promise<void>
}

function BibleReferenceEditor({
  selectedItem,
  updateSelectedItem,
  loadBibleText
}: BibleReferenceEditorProps) {
  const bible = parseBibleAccessData(selectedItem.accessData)

  return (
    <div className="flex flex-col gap-3 pt-2 border-t">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Referencia bíblica
      </span>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground">Libro</span>
          <Input
            type="number"
            containerClassName="w-auto"
            className="h-8 text-xs"
            value={bible.bookId}
            onChange={(e) =>
              updateSelectedItem({
                accessData: buildBibleAccessData({
                  ...bible,
                  bookId: Number(e.target.value)
                })
              })
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground">Capítulo</span>
          <Input
            type="number"
            containerClassName="w-auto"
            className="h-8 text-xs"
            value={bible.chapter}
            onChange={(e) =>
              updateSelectedItem({
                accessData: buildBibleAccessData({
                  ...bible,
                  chapter: Number(e.target.value)
                })
              })
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground">Verso inicio</span>
          <Input
            type="number"
            containerClassName="w-auto"
            className="h-8 text-xs"
            value={bible.verseStart}
            onChange={(e) =>
              updateSelectedItem({
                accessData: buildBibleAccessData({
                  ...bible,
                  verseStart: Number(e.target.value)
                })
              })
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground">Verso fin</span>
          <Input
            type="number"
            containerClassName="w-auto"
            className="h-8 text-xs"
            value={bible.verseEnd || ''}
            onChange={(e) =>
              updateSelectedItem({
                accessData: buildBibleAccessData({
                  ...bible,
                  verseEnd: e.target.value ? Number(e.target.value) : undefined
                })
              })
            }
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-muted-foreground">Versión</span>
        <Input
          containerClassName="w-auto"
          className="h-8 text-xs"
          value={bible.version}
          onChange={(e) =>
            updateSelectedItem({
              accessData: buildBibleAccessData({
                ...bible,
                version: e.target.value
              })
            })
          }
        />
      </div>
      <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={loadBibleText}>
        Cargar texto bíblico
      </Button>
    </div>
  )
}
