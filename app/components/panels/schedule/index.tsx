import { useState } from 'react'
import ScheduleList from './components/scheduleList'
import ScheduleContent from './components/scheduleContent'

export default function SchedulePanelContent() {
  const [showList, setShowList] = useState(false) // Empezar en vista de contenido

  // Mostrar contenido cuando se selecciona un schedule
  const handleScheduleSelect = () => {
    setShowList(false)
  }

  // Volver a la lista
  const handleBackToList = () => {
    setShowList(true)
  }

  return (
    <div className="h-full">
      {showList ? (
        <ScheduleList onScheduleSelect={handleScheduleSelect} />
      ) : (
        <ScheduleContent onBack={handleBackToList} />
      )}
    </div>
  )
}
