import LibraryPanel from './components/panels/library'

function App() {
  // Si no, envuelve con layouts automáticos anidados
  return (
    <div className="grid grid-cols-4 h-svh">
      <LibraryPanel />
    </div>
  )
}

export default App
