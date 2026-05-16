import { Plus } from 'lucide-react'
import { Button } from '@/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  onInsert: () => void
  className?: string
}

export default function SlideInsertSlot({ onInsert, className }: Props) {
  return (
    <div className={cn('group relative h-full w-3 shrink-0', className)}>
      <div className="absolute inset-y-1 left-1/2 -translate-x-1/2 w-px bg-border/70" />
      <Button
        type="button"
        size="icon"
        variant="secondary"
        onClick={onInsert}
        className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border opacity-0 scale-90 transition-all group-hover:opacity-100 group-hover:scale-100 focus-visible:opacity-100 focus-visible:scale-100"
        aria-label="Añadir diapositiva aquí"
        title="Añadir diapositiva aquí"
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  )
}