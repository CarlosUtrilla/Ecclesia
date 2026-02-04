import { Upload } from 'lucide-react'

export default function EmptyShcedule() {
  return (
    <div className="flex items-center justify-center flex-col text-center p-8 border-2 border-dashed rounded-lg h-full transition-colors">
      <Upload className="size-16 mb-4 transition-colors" />
      <p className="text-primary font-medium">Este cronograma no tiene items</p>
      <p className="text-xs mt-2">Arrastra canciones, medios o versículos desde la biblioteca</p>
    </div>
  )
}
