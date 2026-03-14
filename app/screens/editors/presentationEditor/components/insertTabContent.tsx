import { BookText, FileImage, TextCursorInput } from 'lucide-react'
import { Button } from '@/ui/button'

type Props = {
  onInsertText: () => void
  onOpenBiblePicker: () => void
  onInsertMedia: () => void
}

export default function InsertTabContent({
  onInsertText,
  onOpenBiblePicker,
  onInsertMedia
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
        <BookText className="size-4" />
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
    </div>
  )
}
