import { cn } from '@/lib/utils'
import { Upload } from 'lucide-react'

export default function EmptyShcedule({ isOver }: { isOver: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center flex-col text-center p-8',
        'border-2 border-dashed rounded-lg h-full transition-colors text-muted-foreground',
        {
          'border-primary bg-primary/5 text-primary': isOver
        }
      )}
    >
      <Upload
        className={cn('size-16 mb-4 transition-colors text-muted', {
          'text-primary': isOver
        })}
      />
      <p className="font-medium">Este cronograma no tiene items</p>
      <p className="text-xs mt-2">Arrastra canciones, medios o versículos desde la biblioteca</p>
    </div>
  )
}
