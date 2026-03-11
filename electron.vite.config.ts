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
        },
        output: {
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return undefined

            // React core — siempre necesario, chunk pequeño y cacheable
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'react'
            }

            // Router — cargado en todas las ventanas
            if (id.includes('/node_modules/react-router')) {
              return 'router'
            }

            // TipTap/ProseMirror — solo rutas de editores (/song, /theme, /presentation)
            if (
              id.includes('/node_modules/@tiptap/') ||
              id.includes('/node_modules/prosemirror')
            ) {
              return 'editor'
            }

            // Framer Motion — live screen + vista principal
            if (id.includes('/node_modules/framer-motion/')) {
              return 'motion'
            }

            // Radix UI — componentes UI, solo ventanas con UI compleja
            if (id.includes('/node_modules/@radix-ui/')) {
              return 'radix'
            }

            // TanStack — react-query, react-table, react-virtual
            if (id.includes('/node_modules/@tanstack/')) {
              return 'tanstack'
            }

            // DnD Kit — solo ventana principal (cronograma)
            if (id.includes('/node_modules/@dnd-kit/')) {
              return 'dnd'
            }

            // Zod + react-hook-form — solo editores y formularios
            if (
              id.includes('/node_modules/zod/') ||
              id.includes('/node_modules/react-hook-form/') ||
              id.includes('/node_modules/@hookform/')
            ) {
              return 'forms'
            }

            // Resto de dependencias de node_modules
            return 'vendor'
          }
        }
      }
    }
  }
})
