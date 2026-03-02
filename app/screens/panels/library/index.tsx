import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs'
import { t } from '@locales'
import SongsPanelLibrary from './songs'
import MediaLibrary from './media'
import BiblePanel from './bible'
import PresentationsPanel from './presentations'
import { useEffect, useState } from 'react'
import { ThemesSidePanel } from './themesSidePanel'
import { Button } from '@/ui/button'
import { Settings } from 'lucide-react'

export default function LibraryPanel() {
  const [activeTab, setActiveTab] = useState('songs')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)

  useEffect(() => {
    const unsubscribe = window.googleDriveSyncAPI.onSyncStateChange(({ syncing, progress }) => {
      setIsSyncing(syncing)
      setSyncProgress(progress)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return (
    <div className="flex flex-row h-full">
      {/* Panel lateral de temas */}
      <ThemesSidePanel />
      {/* Biblioteca principal */}
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
          <Button size="sm" variant="ghost" onClick={() => window.windowAPI.openSettingsWindow()}>
            <Settings className="h-4 w-4" />
            Ajustes
            {isSyncing ? (
              <span className="text-xs text-primary">
                {syncProgress > 0 ? `Sincronizando ${syncProgress}%` : 'Sincronizando...'}
              </span>
            ) : null}
          </Button>
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
            <BiblePanel />
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
