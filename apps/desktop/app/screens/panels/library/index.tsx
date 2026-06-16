import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs'
import { t } from '@locales'
import SongsPanelLibrary from './songs'
import MediaLibrary from './media'
import BiblePanel from './bible'
import PresentationsPanel from './presentations'
import SyncButton from './SyncButton'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/ui/button'
import { MonitorCog, Settings } from 'lucide-react'

export type BibleSearchParams = {
  version: string
  bookId: number
  chapter: number
  verse: number
}

export default function LibraryPanel() {
  const [activeTab, setActiveTab] = useState('songs')
  const [bibleSearchParams, setBibleSearchParams] = useState<BibleSearchParams | null>(null)
  const bibleSearchParamsRef = useRef(bibleSearchParams)
  bibleSearchParamsRef.current = bibleSearchParams

  useEffect(() => {
    const unsubscribe = window.bibleSearchAPI.onBibleSearch((data) => {
      setBibleSearchParams(data)
      setActiveTab('bible')
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return (
    <div className="flex flex-row h-full">
      <div className="flex-1 gap-0 border-r panel-scrollable">
        <div className="panel-header w-full bg-muted/40 p-1 py-0.5 border-b flex items-center justify-between gap-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-transparent">
              <TabsTrigger value="songs">{t('libraryMenu.songs')}</TabsTrigger>
              <TabsTrigger value="medios">{t('libraryMenu.medios')}</TabsTrigger>
              <TabsTrigger value="bible">Biblia</TabsTrigger>
              <TabsTrigger value="presentations">Presentaciones</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <SyncButton />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.windowAPI.openStageControlWindow()}
            >
              <MonitorCog className="h-4 w-4" />
              Control Stage
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.windowAPI.openSettingsWindow()}>
              <Settings className="h-4 w-4" />
              Ajustes
            </Button>
          </div>
        </div>

        {/* Renderizar todos los componentes pero mostrar solo el activo */}
        <div className="panel-scroll-content">
          <div
            className={`${activeTab === 'songs' ? 'block' : 'hidden pointer-events-none'} h-full`}
          >
            <SongsPanelLibrary />
          </div>
          <div
            className={`${activeTab === 'medios' ? 'block' : 'hidden pointer-events-none'} h-full`}
          >
            <MediaLibrary />
          </div>
          <div
            className={`${activeTab === 'bible' ? 'block' : 'hidden pointer-events-none'} h-full`}
          >
            <BiblePanel searchParams={bibleSearchParams} />
          </div>
          <div
            className={`${activeTab === 'presentations' ? 'block' : 'hidden pointer-events-none'} h-full`}
          >
            <PresentationsPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
