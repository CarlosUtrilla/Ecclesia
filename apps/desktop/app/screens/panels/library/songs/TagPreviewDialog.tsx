import { useEffect, useRef, useState } from 'react'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui/dialog'
import { Input } from '@/ui/input'
import { ColorPicker } from '@/ui/colorPicker'
import { Trash2 } from 'lucide-react'

export type MissingTag = {
  verseName: string
  color: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tags: MissingTag[]
  onConfirm: (tags: MissingTag[]) => void
  onSkip: () => void
}

export function TagPreviewDialog({ open, onOpenChange, tags: initialTags, onConfirm, onSkip }: Props) {
  const [tags, setTags] = useState<MissingTag[]>(initialTags)
  const prevOpenRef = useRef(open)

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setTags(initialTags)
    }
    prevOpenRef.current = open
  }, [open, initialTags])

  const updateTag = (index: number, field: keyof MissingTag, value: string) => {
    setTags((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)))
  }

  const removeTag = (index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Etiquetas detectadas</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Se encontraron versos sin una etiqueta existente. Puedes crearlas, renombrarlas o cambiar
          su color antes de importar.
        </p>

        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {tags.map((tag, i) => (
            <div key={`${tag.verseName}-${i}`} className="flex items-center gap-2">
              <ColorPicker
                value={tag.color}
                onChange={(c) => updateTag(i, 'color', c)}
                className="h-8 w-8 shrink-0"
              />
              <Input
                value={tag.verseName}
                onChange={(e) => updateTag(i, 'verseName', e.target.value)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeTag(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onSkip}>
            Importar sin tags
          </Button>
          <Button disabled={tags.length === 0} onClick={() => onConfirm(tags)}>
            Crear {tags.length > 0 && `(${tags.length})`} e importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
