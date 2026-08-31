import { lazy, Suspense, PropsWithChildren } from 'react'
import { Routes, Route } from 'react-router-dom'
import { MediaServerProvider } from './contexts/MediaServerContext'
import { ScreenSizeProvider } from './contexts/ScreenSizeContext'
import { DisplaysProvider } from './contexts/displayContext'
import { FontsProvider } from './contexts/fontsContext'
import { Spinner } from './ui/spinner'
import { ClosingDialog } from './ui/closingDialog'
import { UpdateNotification } from './ui/UpdateNotification'
import { ApiProvider } from '@ecclesia/queries'
import { RemoteModeProvider } from './contexts/RemoteModeContext'
import RemoteConnectionListener from './RemoteConnectionListener'
import { PPTX_RENDER_ROUTE } from '../electron/main/pptxRenderer/pptxRenderTypes'

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
const PptxRenderHost = lazy(() => import('./screens/pptx-render'))

function App() {
  // La ventana de rasterizado de PPTX sólo pinta diapositivas para que el
  // proceso principal capture sus frames: no habla con el backend ni con el
  // servidor de medios. Montar ApiProvider y compañía aquí sería arrancar
  // sockets y bootstrap para nada, y encima puede fallar.
  if (window.location.hash === '#' + PPTX_RENDER_ROUTE) {
    return (
      <Suspense fallback={null}>
        <PptxRenderHost />
      </Suspense>
    )
  }

  return (
    <MainApp>
      <Suspense
        fallback={
          <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Spinner size="large" />
          </div>
        }
      >
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

          {/* Ventana oculta de rasterizado de PPTX (ver pptxRenderer/) */}
          <Route path={PPTX_RENDER_ROUTE} element={<PptxRenderHost />} />
        </Routes>
      </Suspense>
    </MainApp>
  )
}

function MainApp({ children }: PropsWithChildren) {
  return (
    <ApiProvider>
      <RemoteModeProvider>
        <MediaServerProvider>
          <FontsProvider>
            <DisplaysProvider>
              <ScreenSizeProvider>
                {children}
                <ClosingDialog />
                <UpdateNotification />
                <RemoteConnectionListener />
              </ScreenSizeProvider>
            </DisplaysProvider>
          </FontsProvider>
        </MediaServerProvider>
      </RemoteModeProvider>
    </ApiProvider>
  )
}

export default App
