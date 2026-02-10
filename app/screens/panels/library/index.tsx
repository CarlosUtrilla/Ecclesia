import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs'
import { t } from '@locales'
import SongsPanelLibrary from './songs'
import MediaLibrary from './media'
import BiblePanel from './bible'
import { useState } from 'react'

export default function LibraryPanel() {
  const [activeTab, setActiveTab] = useState('songs')

  return (
    <div className="gap-0 border-r panel-scrollable">
      <div className="panel-header w-full bg-muted/40 p-1 py-0.5 border-b">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-transparent">
            <TabsTrigger value="songs">{t('libraryMenu.songs')}</TabsTrigger>
            <TabsTrigger value="medios">{t('libraryMenu.medios')}</TabsTrigger>
            <TabsTrigger value="bible">Biblia</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Renderizar todos los componentes pero mostrar solo el activo */}
      <div className="panel-scroll-content">
        <div className={`${activeTab === 'songs' ? 'block' : 'hidden'} h-full`}>
          <SongsPanelLibrary />
        </div>
        <div className={`${activeTab === 'medios' ? 'block' : 'hidden'} h-full`}>
          <MediaLibrary />
        </div>
        <div className={`${activeTab === 'bible' ? 'block' : 'hidden'} h-full`}>
          <BiblePanel />
        </div>
      </div>
    </div>
  )
}
