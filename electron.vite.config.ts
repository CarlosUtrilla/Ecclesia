import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import Pages from 'vite-plugin-pages'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'electron/main/index.ts'
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'electron/preload/index.ts'
      }
    }
  },
  renderer: {
    root: resolve('app'),
    resolve: {
      alias: {
        '@': resolve('app'),
        '@api': resolve('./database/api.ts'),
        '@queries': resolve('./queries'),
        '@locales': resolve('./locales/index.ts')
      }
    },
    plugins: [
      react(),
      tailwindcss(),
      Pages({
        dirs: resolve('app/routes'),
        extensions: ['tsx', 'ts']
      })
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve('app/index.html')
        }
      }
    }
  }
})
