import { lazy, Suspense, PropsWithChildren } from 'react'
import { Routes, Route } from 'react-router-dom'
import { MediaServerProvider } from './contexts/MediaServerContext'
import { ScreenSizeProvider } from './contexts/ScreenSizeContext'
import { DisplaysProvider } from './contexts/displayContext'
import { FontsProvider } from './contexts/fontsContext'

// Todas las rutas son lazy — cada ventana sólo parsea el código que su ruta necesita.
// La ventana principal carga MainRoute (paneles, dnd-kit, zod, etc.).
// Las ventanas de live screen sólo cargan LiveScreen + framer-motion.
// Las ventanas de editor sólo cargan TipTap + sus dependencias.
const MainRoute = lazy(() => import('./screens/main-route'))
const SongEditor = lazy(() => import('./screens/editors/songEditor'))
const ThemesEditor = lazy(() => import('./screens/editors/themesEditor'))
const TagSongsEditor = lazy(() => import('./screens/editors/tagSongsEditor.tsx'))
const SettingsScreen = lazy(() => import('./screens/settings'))
const PresentationEditor = lazy(() => import('./screens/editors/presentationEditor'))
const LiveScreen = lazy(() => import('./screens/live-screen'))
const StageScreen = lazy(() => import('./screens/stage-screen'))
const StageControlScreen = lazy(() => import('./screens/stage-control'))
const StageLayoutScreen = lazy(() => import('./screens/stage-layout'))

function App() {
  return (
    <MainApp>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<MainRoute />} />

          {/* Rutas de editores (ventanas separadas) */}
          <Route path="/song/new" element={<SongEditor />} />
          <Route path="/song/:id" element={<SongEditor />} />
          <Route path="/theme/new" element={<ThemesEditor />} />
          <Route path="/theme/:id" element={<ThemesEditor />} />
          <Route path="/tagSongEditor" element={<TagSongsEditor />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/presentation/new" element={<PresentationEditor />} />
          <Route path="/presentation/:id" element={<PresentationEditor />} />

          {/* Rutas de pantallas en vivo (ventanas separadas) */}
          <Route path="/live-screen/:displayId" element={<LiveScreen />} />
          <Route path="/stage-screen/:displayId" element={<StageScreen />} />
          <Route path="/stage-control" element={<StageControlScreen />} />
          <Route path="/stage-layout" element={<StageLayoutScreen />} />
        </Routes>
      </Suspense>
    </MainApp>
  )
}

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
