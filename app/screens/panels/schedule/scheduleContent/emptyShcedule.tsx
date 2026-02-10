import { cn } from '@/lib/utils'
import { Upload } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function EmptyShcedule({ isOver }: { isOver: boolean }) {
  return (
    <motion.div
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
      <motion.div
        animate={isOver ? { scale: 1.1, rotate: [0, -5, 5, 0] } : { scale: 1, rotate: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Upload
          className={cn('size-16 mb-4 transition-colors text-muted', {
            'text-primary': isOver
          })}
        />
      </motion.div>
      <motion.p
        className="font-medium"
        animate={isOver ? { scale: 1.05 } : { scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {isOver ? '¡Perfecto! Suelta aquí para agregar' : 'Este cronograma no tiene items'}
      </motion.p>
      <AnimatePresence>
        {!isOver && (
          <motion.p initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs mt-2">
            Arrastra canciones, medios o versículos desde la biblioteca
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
