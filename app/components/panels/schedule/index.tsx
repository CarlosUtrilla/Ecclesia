import { useState } from 'react'
import { ScheduleProvider } from '@/contexts/ScheduleContext'
import ScheduleList from './components/scheduleList'
import ScheduleContent from './components/scheduleContent'
import ThemesPanel from './components/themes'

function SchedulePanelContent() {
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
    <div className="flex flex-col border-r h-full">
      {showList ? (
        <ScheduleList onScheduleSelect={handleScheduleSelect} />
      ) : (
        <ScheduleContent onBack={handleBackToList} />
      )}
    </div>
  )
}

export default function SchedulePanel() {
  return (
    <ScheduleProvider>
      <SchedulePanelContent />
    </ScheduleProvider>
  )
}
