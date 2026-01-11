import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { t } from '@locales'
import SongsPanelLibrary from './songs'
import MediaLibrary from './media'
import BiblePanel from './bible'
import { useRef, useState, useLayoutEffect } from 'react'

export default function LibraryPanel() {
  const tabsRef = useRef<HTMLDivElement>(null)
  const [tabsHeight, setTabsHeight] = useState(0)
  const style = {
    height: `calc(100vh - ${tabsHeight}px)`
  }

  useLayoutEffect(() => {
    if (tabsRef.current) {
      setTabsHeight(tabsRef.current.offsetHeight)
    }
  }, [])
  return (
    <Tabs defaultValue="songs" className="gap-0 border-r h-svh max-h-svh">
      <div ref={tabsRef} className="w-full bg-muted/40 p-1 py-0.5 border-b">
        <TabsList className="bg-transparent">
          <TabsTrigger value="songs">{t('libraryMenu.songs')}</TabsTrigger>
          <TabsTrigger value="medios">{t('libraryMenu.medios')}</TabsTrigger>
          <TabsTrigger value="bible">Biblia</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="songs" className="m-0" style={style}>
        <SongsPanelLibrary />
      </TabsContent>
      <TabsContent value="medios" className="m-0" style={style}>
        <MediaLibrary />
      </TabsContent>
      <TabsContent value="bible" className="m-0" style={style}>
        <BiblePanel />
      </TabsContent>
    </Tabs>
  )
}
