import { defineConfig } from '@playwright/test'

// E2E contra la app Electron real. Ver tests/e2e/fixtures.ts para los dos modos
// (conectar a `pnpm dev` por CDP, o lanzar el build con ECCLESIA_E2E_LAUNCH=1).
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  // Una sola instancia de la app: el servidor de medios usa un puerto fijo.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
})
