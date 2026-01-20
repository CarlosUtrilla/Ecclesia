import { Routes, Route, useLocation } from 'react-router-dom'
import LibraryPanel from './components/panels/library'
import SongEditor from './components/songEditor'
import ThemesEditor from './components/themesEditor'
import SchedulePanel from './components/panels/schedule'
import { MediaServerProvider } from './contexts/MediaServerContext'
import { ScreenSizeProvider } from './contexts/ScreenSizeContext'
import TagSongsEditor from './components/tagSongsEditor.tsx'
import { ScheduleProvider } from './contexts/ScheduleContext'
import LivePanels from './components/panels/live'
import LiveScreens from './components/panels/live-screens'
import NewDisplayConected from './components/new-display-connected'
import { DisplaysProvider } from './contexts/displayContext'
import { PropsWithChildren } from 'react'

function App() {
  const location = useLocation()
  const currentPath = location.pathname

  const urlsAreNotMain = ['/newDisplayConnected']
  const isNotMain = urlsAreNotMain.includes(currentPath)

  if (!isNotMain) {
    return (
      <MainApp>
        <Routes>
          <Route
            path="/"
            element={
              <div className="grid grid-rows-1 grid-cols-4 h-dvh max-h-svh">
                <LibraryPanel />
                <SchedulePanel />
                <LivePanels />
                <LiveScreens />
              </div>
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
        </Routes>
      </MainApp>
    )
  }

  return (
    <Routes>
      {/*Rutas para pantallas */}
      <Route path="/newDisplayConnected" element={<NewDisplayConected />} />
    </Routes>
  )
}

function MainApp({ children }: PropsWithChildren) {
  return (
    <MediaServerProvider>
      <DisplaysProvider>
        <ScreenSizeProvider>
          <ScheduleProvider>{children}</ScheduleProvider>
        </ScreenSizeProvider>
      </DisplaysProvider>
    </MediaServerProvider>
  )
}

export default App
