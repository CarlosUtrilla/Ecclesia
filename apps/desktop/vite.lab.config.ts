// Config temporal: sirve solo `transition-lab.html` sin arrancar Electron,
// para poder medir las transiciones en un navegador de verdad.
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: resolve(__dirname, 'app'),
  server: {
    port: 5199,
    fs: { allow: ['../..'] }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'app'),
      '@locales': resolve(__dirname, 'locales/index.ts'),
      '@ecclesia/api': resolve(__dirname, '../../apps/api'),
      '@ecclesia/queries': resolve(__dirname, '../../packages/queries')
    }
  },
  plugins: [react(), tailwindcss()]
})
