import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { t } from '@locales'
import SongsPanelLibrary from './songs'

export default function LibraryPanel() {
  return (
    <Tabs defaultValue="songs" className="gap-0 border-r h-full">
      <div className="w-full bg-muted/40 p-1 py-0.5 border-b">
        <TabsList className="bg-transparent">
          <TabsTrigger value="songs">{t('libraryMenu.songs')}</TabsTrigger>
          <TabsTrigger value="images">{t('libraryMenu.images')}</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="songs">
        <SongsPanelLibrary />
      </TabsContent>
      <TabsContent value="images"></TabsContent>
    </Tabs>
  )
}
