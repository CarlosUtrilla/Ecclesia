import './assets/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Api, initializeApi } from '@ecclesia/queries'

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

export const queryClient = new QueryClient()

// Pre-carga el chunk de la ruta activa antes de renderizar React.
// Como Electron sirve desde el ASAR local, los imports resuelven en ~0ms y
// el módulo queda en caché. Cuando React.lazy() lo pide, ya está listo y
// renderiza sin mostrar el Suspense fallback (sin pantalla negra).
const ROUTE_PRELOADS: [string, () => Promise<unknown>][] = [
  ['/', () => import('./screens/main-route')],
  ['/song', () => import('./screens/editors/songEditor')],
  ['/theme', () => import('./screens/editors/themesEditor')],
  ['/tagSongEditor', () => import('./screens/editors/tagSongsEditor.tsx')],
  ['/settings', () => import('./screens/settings')],
  ['/presentation', () => import('./screens/editors/presentationEditor')],
  ['/live-screen', () => import('./screens/live-screen')],
  ['/stage-screen', () => import('./screens/stage-screen')],
  ['/stage-control', () => import('./screens/stage-control')],
  ['/stage-layout', () => import('./screens/stage-layout')]
]

async function preloadCurrentRoute(): Promise<void> {
  const hash = window.location.hash.replace('#', '') || '/'
  for (const [prefix, load] of ROUTE_PRELOADS) {
    if (hash === prefix || hash.startsWith(prefix + '/')) {
      await load()
      break
    }
  }
}

// Inicializar SDK de la API antes de montar React para que
// `Api.fetch.xxx()` y `Api.query.xxx()` estén disponibles desde el primer render.
// Luego disparar el preload en paralelo con el montaje:
// - preloadCurrentRoute() carga el chunk en la caché ESM mientras React ya monta
// - Suspense muestra el Spinner inmediatamente en vez de ventana oscura vacía
// - React.lazy() comparte la misma Promise del import() → resuelve en cuanto el chunk está listo
// Aviso en el DOM (sin React, que aun no esta montado) cuando el backend local
// tarda en responder. Sin esto la ventana se queda negra y parece que la app
// no arranca; pasa sobre todo sin conexion de red, cuando algun paso previo del
// proceso principal tarda mas de lo normal.
const BOOTSTRAP_NOTICE_DELAY_MS = 2500
let bootstrapNoticeTimer: number | undefined = window.setTimeout(() => {
  const root = document.getElementById('root')
  if (!root || root.childElementCount > 0) return
  root.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:center;height:100vh;' +
    'font-family:system-ui,sans-serif;font-size:14px;opacity:.7;text-align:center;padding:24px">' +
    'Conectando con el servidor local...</div>'
}, BOOTSTRAP_NOTICE_DELAY_MS)

const clearBootstrapNotice = () => {
  if (bootstrapNoticeTimer !== undefined) {
    clearTimeout(bootstrapNoticeTimer)
    bootstrapNoticeTimer = undefined
  }
  const root = document.getElementById('root')
  if (root) root.innerHTML = ''
}

initializeApi(queryClient, undefined, undefined, {
  onRetry: (attempt, error) => {
    console.warn(`[bootstrap] El backend local no responde (intento ${attempt}):`, error)
  }
}).then(() => {
  clearBootstrapNotice()
  preloadCurrentRoute()
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
})
