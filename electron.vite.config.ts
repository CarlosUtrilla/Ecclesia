import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import Pages from 'vite-plugin-pages'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __GH_TOKEN__: JSON.stringify(process.env['GH_TOKEN'] ?? ''),
      __GOOGLE_CLIENT_ID__: JSON.stringify(process.env['GOOGLE_DRIVE_CLIENT_ID'] ?? ''),
      __GOOGLE_CLIENT_SECRET__: JSON.stringify(process.env['GOOGLE_DRIVE_CLIENT_SECRET'] ?? '')
    },
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
    server: {
      fs: {
        allow: ['..']
      }
    },
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
          index: resolve('app/index.html'),
          splash: resolve('app/splash.html')
        }
      }
    }
  }
})
