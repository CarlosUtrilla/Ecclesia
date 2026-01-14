import { Routes, Route, useLocation } from 'react-router-dom'
import LibraryPanel from './components/panels/library'
import SongEditor from './components/songEditor'
import ThemesEditor from './components/themesEditor'
import PreviewPanel from './components/panels/preview'
import { MediaServerProvider } from './contexts/MediaServerContext'
import { ScreenSizeProvider } from './contexts/ScreenSizeContext'
import { SplashScreen } from './components/SplashScreen'
import { useMediaServer } from './contexts/MediaServerContext'
import TagSongsEditor from './components/tagSongsEditor.tsx'
import { ScheduleProvider } from './contexts/ScheduleContext'

function AppContent() {
  const { isReady } = useMediaServer()
  const location = useLocation()

  // Solo mostrar splash en la ruta principal
  const showSplash = location.pathname === '/'

  return (
    <>
      {showSplash ? (
        <SplashScreen isReady={isReady}>
          <Routes>
            <Route
              path="/"
              element={
                <div className="grid grid-cols-4 h-svh">
                  <LibraryPanel />
                  <PreviewPanel />
                </div>
              }
            />
          </Routes>
        </SplashScreen>
      ) : (
        <Routes>
          {/* Rutas para crear/editar canción (ventana modal) */}
          <Route path="/song/new" element={<SongEditor />} />
          <Route path="/song/:id" element={<SongEditor />} />

          {/* Rutas para crear/editar tema (ventana modal) */}
          <Route path="/theme/new" element={<ThemesEditor />} />
          <Route path="/theme/:id" element={<ThemesEditor />} />

          {/* Rutas para crear/editar tags de canciones */}
          <Route path="/tagSongEditor" element={<TagSongsEditor />} />
        </Routes>
      )}
    </>
  )
}

function App() {
  return (
    <MediaServerProvider>
      <ScreenSizeProvider>
        <ScheduleProvider>
          <AppContent />
        </ScheduleProvider>
      </ScreenSizeProvider>
    </MediaServerProvider>
  )
}

export default App
