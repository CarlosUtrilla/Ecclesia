import { Suspense } from 'react'
import LiveItem from './components/liveItem'

export default function LivePanels() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 border-r h-full flex items-center justify-center">Cargando...</div>
      }
    >
      <LiveItem />
    </Suspense>
  )
}
