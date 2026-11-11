import { test as base, chromium, _electron, type Browser, type Page } from '@playwright/test'
import { join } from 'path'

const CDP_URL = `http://localhost:${process.env.ECCLESIA_CDP_PORT ?? '9222'}`
const APP_DIR = join(__dirname, '../..')

/**
 * `mainWindow` es la ventana principal de Ecclesia.
 *
 * - Por defecto se conecta por CDP a la app de `pnpm dev` que ya está abierta
 *   (el proceso main abre el puerto 9222 cuando no está empaquetada). No la cierra.
 * - Con `ECCLESIA_E2E_LAUNCH=1` lanza el build de `out/` (`pnpm build:ci` antes).
 *   Requiere cerrar la app de dev: el servidor de medios usa el puerto 7777.
 */
export const test = base.extend<{ mainWindow: Page }>({
  // eslint-disable-next-line no-empty-pattern
  mainWindow: async ({}, use) => {
    if (process.env.ECCLESIA_E2E_LAUNCH === '1') {
      const app = await _electron.launch({ args: [APP_DIR], cwd: APP_DIR })
      const page = await waitForMainWindow(() => app.windows())
      await use(page)
      await app.close()
      return
    }

    let browser: Browser
    try {
      browser = await chromium.connectOverCDP(CDP_URL)
    } catch {
      throw new Error(`No hay app de Ecclesia escuchando en ${CDP_URL}. Arranca \`pnpm dev\` primero.`)
    }
    const page = await waitForMainWindow(() => browser.contexts().flatMap((c) => c.pages()))
    await use(page)
    // Solo soltar la conexión CDP; la app de dev sigue viva.
    await browser.close()
  }
})

async function waitForMainWindow(getPages: () => Page[], timeoutMs = 30_000): Promise<Page> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    // La principal es la única sin ruta hash ni splash (el resto: #/settings, #/song, ...).
    const page = getPages().find((p) => {
      const url = p.url()
      return !url.includes('#') && !url.includes('splash') && !url.startsWith('devtools:')
    })
    if (page) {
      await page.waitForLoadState('domcontentloaded')
      return page
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('No apareció la ventana principal de Ecclesia')
}

export { expect } from '@playwright/test'
