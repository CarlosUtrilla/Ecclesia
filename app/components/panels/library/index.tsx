import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { t } from '@locales'
import SongsPanelLibrary from './songs'
import MediaLibrary from './media'
import BiblePanel from './bible'

export default function LibraryPanel() {
  return (
    <Tabs defaultValue="songs" className="gap-0 border-r h-full">
      <div className="w-full bg-muted/40 p-1 py-0.5 border-b">
        <TabsList className="bg-transparent">
          <TabsTrigger value="songs">{t('libraryMenu.songs')}</TabsTrigger>
          <TabsTrigger value="medios">{t('libraryMenu.medios')}</TabsTrigger>
          <TabsTrigger value="bible">Biblia</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="songs" className="m-0">
        <SongsPanelLibrary />
      </TabsContent>
      <TabsContent value="medios" className="m-0">
        <MediaLibrary />
      </TabsContent>
      <TabsContent value="bible" className="m-0">
        <BiblePanel />
      </TabsContent>
    </Tabs>
  )
}
