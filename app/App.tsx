import { Routes, Route } from 'react-router-dom'
import LibraryPanel from './components/panels/library'
import SongEditor from './components/songEditor'
import ThemesEditor from './components/themesEditor'
import SchedulePanel from './components/panels/schedule'
import { MediaServerProvider } from './contexts/MediaServerContext'
import { ScreenSizeProvider } from './contexts/ScreenSizeContext'
import TagSongsEditor from './components/tagSongsEditor.tsx'
import { ScheduleProvider } from './contexts/ScheduleContext'
import LivePanels from './components/panels/items-on-live'
import LiveScreens from './components/panels/live-screens'
import { DisplaysProvider } from './contexts/displayContext'
import { PropsWithChildren } from 'react'
import LiveScreen from './components/live-screen'

function App() {
  return (
    <MainApp>
      <Routes>
        <Route
          path="/"
          element={
            <ScheduleProvider>
              <div className="grid grid-rows-1 grid-cols-4 h-dvh max-h-svh">
                <LibraryPanel />
                <SchedulePanel />
                <LivePanels />
                <LiveScreens />
              </div>
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

        <Route path="/live-screen/:displayId" element={<LiveScreen />} />
      </Routes>
    </MainApp>
  )
}

function MainApp({ children }: PropsWithChildren) {
  return (
    <MediaServerProvider>
      <DisplaysProvider>
        <ScreenSizeProvider>{children}</ScreenSizeProvider>
      </DisplaysProvider>
    </MediaServerProvider>
  )
}

export default App
