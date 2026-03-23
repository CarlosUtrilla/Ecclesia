import {
  ArrowRight,
  BookPlus,
  Circle,
  FileImage,
  Film,
  Minus,
  Plus,
  Square,
  TextCursorInput,
  Triangle
} from 'lucide-react'
import { Button } from '@/ui/button'
import { PresentationShapeType } from '../utils/slideUtils'

type Props = {
  onInsertText: () => void
  onOpenBiblePicker: () => void
  onInsertMedia: () => void
  onImportCanvaSlides: () => void
  onInsertShape: (shapeType: PresentationShapeType) => void
}

export default function InsertTabContent({
  onInsertText,
  onOpenBiblePicker,
  onInsertMedia,
  onImportCanvaSlides,
  onInsertShape
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Insertar elemento
      </span>
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 justify-start gap-3"
        onClick={onInsertText}
      >
        <TextCursorInput className="size-4" />
        Texto libre
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 justify-start gap-3"
        onClick={onOpenBiblePicker}
      >
        <BookPlus className="size-4" />
        Versículo bíblico
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 justify-start gap-3"
        onClick={onInsertMedia}
      >
        <FileImage className="size-4" />
        Imagen / Video
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 justify-start gap-3"
        onClick={onImportCanvaSlides}
      >
        <Film className="size-4" />
        Importar Canva (MP4/ZIP)
      </Button>

      <span className="mt-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Formas
      </span>
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 justify-start gap-3"
        onClick={() => onInsertShape('rectangle')}
      >
        <Square className="size-4" />
        Rectángulo
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 justify-start gap-3"
        onClick={() => onInsertShape('circle')}
      >
        <Circle className="size-4" />
        Círculo
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 justify-start gap-3"
        onClick={() => onInsertShape('arrow')}
      >
        <ArrowRight className="size-4" />
        Flecha
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 justify-start gap-3"
        onClick={() => onInsertShape('line-arrow')}
      >
        <ArrowRight className="size-4" />
        Flecha de línea
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 justify-start gap-3"
        onClick={() => onInsertShape('triangle')}
      >
        <Triangle className="size-4" />
        Triángulo
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 justify-start gap-3"
        onClick={() => onInsertShape('line')}
      >
        <Minus className="size-4" />
        Línea
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 justify-start gap-3"
        onClick={() => onInsertShape('cross')}
      >
        <Plus className="size-4" />
        Cruz
      </Button>
    </div>
  )
}
