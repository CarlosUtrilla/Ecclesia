import './assets/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const COLOR_THEME_KEY = 'ecclesia-color-theme'
type ThemeMode = 'light' | 'dark' | 'system'

const getThemeMode = (): ThemeMode => {
  const savedMode = localStorage.getItem(COLOR_THEME_KEY)
  if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
    return savedMode
  }
  return 'system'
}

const applyThemeMode = (mode: ThemeMode) => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const shouldUseDark = mode === 'dark' || (mode === 'system' && prefersDark)

  document.documentElement.classList.toggle('dark', shouldUseDark)
}

const applyStoredThemeMode = () => {
  applyThemeMode(getThemeMode())
}

applyStoredThemeMode()

window.addEventListener('storage', (event) => {
  if (event.key === COLOR_THEME_KEY) {
    applyStoredThemeMode()
  }
})

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
mediaQuery.addEventListener('change', () => {
  if (getThemeMode() === 'system') {
    applyStoredThemeMode()
  }
})

const queryClient = new QueryClient()

// Cuando el sync pull aplica filas nuevas, invalidar todas las queries para que la UI refresque.
window.electron.ipcRenderer.on('sync-data-applied', () => {
  queryClient.invalidateQueries()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>
)
