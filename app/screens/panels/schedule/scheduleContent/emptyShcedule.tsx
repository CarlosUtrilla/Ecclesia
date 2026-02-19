import { cn } from '@/lib/utils'
import { Upload } from 'lucide-react'
import { m, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion'

export default function EmptyShcedule({ isOver }: { isOver: boolean }) {
  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'flex items-center justify-center flex-col text-center p-8',
          'border-2 border-dashed rounded-lg h-full transition-all duration-300 text-muted-foreground',
          {
            'border-primary bg-primary/5 text-primary shadow-lg scale-105': isOver
          }
        )}
      >
        <m.div
          animate={isOver ? { scale: 1.1, rotate: [0, -5, 5, 0] } : { scale: 1, rotate: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Upload
            className={cn('size-16 mb-4 transition-colors text-muted', {
              'text-primary': isOver
            })}
          />
        </m.div>
        <m.p
          className="font-medium"
          animate={isOver ? { scale: 1.05 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {isOver ? '¡Perfecto! Suelta aquí para agregar' : 'Este cronograma no tiene items'}
        </m.p>
        <AnimatePresence>
          {!isOver && (
            <m.p initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs mt-2">
              Arrastra canciones, medios o versículos desde la biblioteca
            </m.p>
          )}
        </AnimatePresence>
      </m.div>
    </LazyMotion>
  )
}
