import { Media } from '@prisma/client'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Slider } from '@/ui/slider'
import { Textarea } from '@/ui/textarea'
import { PresentationSlideItem } from '../utils/slideUtils'
import { parseBibleAccessData } from '../utils/bibleAccessData'

type MediaSlideControlsProps = {
  mediaId?: number
  width: number
  height: number
  rotation: number
  media: Media[]
  onOpenMediaPicker: () => void
  onMediaIdChange: (mediaId: number) => void
  onMediaWidthChange: (width: number) => void
  onMediaHeightChange: (height: number) => void
  onRotationChange: (rotation: number) => void
}

export function MediaSlideControls({
  mediaId,
  width,
  height,
  rotation,
  media,
  onOpenMediaPicker,
  onMediaIdChange,
  onMediaWidthChange,
  onMediaHeightChange,
  onRotationChange
}: MediaSlideControlsProps) {
  return (
    <div className="p-2 border-b flex items-center gap-2 flex-wrap">
      <Label className="text-xs">Media</Label>

      <Button size="sm" variant="outline" onClick={onOpenMediaPicker}>
        Seleccionar desde biblioteca
      </Button>

      <Select
        value={mediaId ? String(mediaId) : undefined}
        onValueChange={(value) => onMediaIdChange(Number(value))}
      >
        <SelectTrigger className="h-8 w-56">
          <SelectValue placeholder="Selecciona media" />
        </SelectTrigger>
        <SelectContent>
          {media.map((item) => (
            <SelectItem key={item.id} value={String(item.id)}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-xs text-muted-foreground">Ancho</span>
      <Slider
        value={[Number(width || 640)]}
        min={80}
        max={1280}
        step={1}
        className="w-36"
        onValueChange={(value) => onMediaWidthChange(value[0] ?? 640)}
      />

      <span className="text-xs text-muted-foreground">Alto</span>
      <Slider
        value={[Number(height || 360)]}
        min={60}
        max={720}
        step={1}
        className="w-36"
        onValueChange={(value) => onMediaHeightChange(value[0] ?? 360)}
      />

      <span className="text-xs text-muted-foreground">Rotación</span>
      <Slider
        value={[Number(rotation || 0)]}
        min={-180}
        max={180}
        step={1}
        className="w-36"
        onValueChange={(value) => onRotationChange(value[0] ?? 0)}
      />
    </div>
  )
}

type BibleSlideControlsProps = {
  item: PresentationSlideItem
  onBookChange: (value: number) => void
  onChapterChange: (value: number) => void
  onVerseStartChange: (value: number) => void
  onVerseEndChange: (value?: number) => void
  onVersionChange: (value: string) => void
  onLoadBibleText: () => void
}

export function BibleSlideControls({
  item,
  onBookChange,
  onChapterChange,
  onVerseStartChange,
  onVerseEndChange,
  onVersionChange,
  onLoadBibleText
}: BibleSlideControlsProps) {
  const bible = parseBibleAccessData(item.accessData)
  const bookId = bible.bookId
  const chapter = bible.chapter
  const verseStart = bible.verseStart
  const verseEnd = bible.verseEnd
  const version = bible.version

  return (
    <div className="p-2 border-b flex items-center gap-2 flex-wrap">
      <Label className="text-xs text-muted-foreground">Biblia</Label>
      <Input
        type="number"
        containerClassName="w-auto"
        className="h-8 w-16"
        value={bookId}
        onChange={(event) => onBookChange(Number(event.target.value))}
      />
      <Input
        type="number"
        containerClassName="w-auto"
        className="h-8 w-16"
        value={chapter}
        onChange={(event) => onChapterChange(Number(event.target.value))}
      />
      <Input
        type="number"
        containerClassName="w-auto"
        className="h-8 w-16"
        value={verseStart}
        onChange={(event) => onVerseStartChange(Number(event.target.value))}
      />
      <Input
        type="number"
        containerClassName="w-auto"
        className="h-8 w-16"
        value={verseEnd || ''}
        onChange={(event) =>
          onVerseEndChange(event.target.value ? Number(event.target.value) : undefined)
        }
      />
      <Input
        className="h-8 w-24"
        containerClassName="w-auto"
        value={version}
        onChange={(event) => onVersionChange(event.target.value)}
      />
      <Button size="sm" variant="outline" onClick={onLoadBibleText}>
        Cargar verso
      </Button>
    </div>
  )
}

type SlideTextContentEditorProps = {
  value: string
  onChange: (value: string) => void
}

export function SlideTextContentEditor({ value, onChange }: SlideTextContentEditorProps) {
  return (
    <div className="p-2 border-t space-y-1">
      <Label>Contenido</Label>
      <Textarea
        className="min-h-24"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Escribe o pega el contenido del slide"
      />
    </div>
  )
}
