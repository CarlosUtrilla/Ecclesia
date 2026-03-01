import { Routes, Route } from 'react-router-dom'
import LibraryPanel from './screens/panels/library'
import SongEditor from './screens/editors/songEditor'
import ThemesEditor from './screens/editors/themesEditor'
import SchedulePanel from './screens/panels/schedule'
import { MediaServerProvider } from './contexts/MediaServerContext'
import { ScreenSizeProvider } from './contexts/ScreenSizeContext'
import TagSongsEditor from './screens/editors/tagSongsEditor.tsx'
import { ScheduleProvider } from './contexts/ScheduleContext'
import LivePanels from './screens/panels/items-on-live'
import LiveScreens from './screens/panels/live-screens'
import { DisplaysProvider } from './contexts/displayContext'
import { PropsWithChildren } from 'react'
import LiveScreen from './screens/live-screen'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable'
import SettingsScreen from './screens/settings'

function App() {
  return (
    <MainApp>
      <Routes>
        <Route
          path="/"
          element={
            <ScheduleProvider>
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={65} minSize={'50%'}>
                  <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={20} minSize={'18%'} maxSize={'30%'}>
                      <SchedulePanel />
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={60} minSize={'30%'}>
                      <LivePanels />
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={20} minSize={'18%'} maxSize={'30%'}>
                      <LiveScreens />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </ResizablePanel>
                <ResizableHandle className="w-full" />
                <ResizablePanel defaultSize={35} minSize={'25%'}>
                  <LibraryPanel />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ScheduleProvider>
          }
        />
        {/* Rutas para crear/editar canción (ventana modal) */}
        <Route path="/song/new" element={<SongEditor />} />
        <Route path="/song/:id" element={<SongEditor />} />

        {/* Rutas para crear/editar tema (ventana modal) */}
        <Route path="/theme/new" element={<ThemesEditor />} />
        <Route path="/theme/:id" element={<ThemesEditor />} />

        {/* Rutas para crear/editar tags de canciones */}
        <Route path="/tagSongEditor" element={<TagSongsEditor />} />

        {/* Ruta para ajustes */}
        <Route path="/settings" element={<SettingsScreen />} />

        <Route path="/live-screen/:displayId" element={<LiveScreen />} />
      </Routes>
    </MainApp>
  )
}

import { FontsProvider } from './contexts/fontsContext'

function MainApp({ children }: PropsWithChildren) {
  return (
    <MediaServerProvider>
      <FontsProvider>
        <DisplaysProvider>
          <ScreenSizeProvider>{children}</ScreenSizeProvider>
        </DisplaysProvider>
      </FontsProvider>
    </MediaServerProvider>
  )
}

export default App
