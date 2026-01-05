import { Routes, Route } from 'react-router-dom'
import LibraryPanel from './components/panels/library'
import SongEditor from './components/songEditor'

function App() {
  return (
    <Routes>
      {/* Ruta principal con el panel de biblioteca */}
      <Route
        path="/"
        element={
          <div className="grid grid-cols-4 h-svh">
            <LibraryPanel />
          </div>
        }
      />

      {/* Rutas para crear/editar canción (ventana modal) */}
      <Route path="/song/new" element={<SongEditor />} />
      <Route path="/song/:id" element={<SongEditor />} />
    </Routes>
  )
}

export default App
