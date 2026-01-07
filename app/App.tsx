import { Routes, Route } from 'react-router-dom'
import LibraryPanel from './components/panels/library'
import SongEditor from './components/songEditor'
import ThemesEditor from './components/themesEditor'
import PreviewPanel from './components/panels/preview'

function App() {
  return (
    <Routes>
      {/* Ruta principal con el panel de biblioteca */}
      <Route
        path="/"
        element={
          <div className="grid grid-cols-4 h-svh">
            <LibraryPanel />
            <PreviewPanel />
          </div>
        }
      />

      {/* Rutas para crear/editar canción (ventana modal) */}
      <Route path="/song/new" element={<SongEditor />} />
      <Route path="/song/:id" element={<SongEditor />} />

      {/* Rutas para crear/editar tema (ventana modal) */}
      <Route path="/theme/new" element={<ThemesEditor />} />
      <Route path="/theme/:id" element={<ThemesEditor />} />
    </Routes>
  )
}

export default App
