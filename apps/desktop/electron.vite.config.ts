import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import Pages from 'vite-plugin-pages'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@ecclesia/api', '@ecclesia/queries']
      })
    ],
    define: {
      __GH_TOKEN__: JSON.stringify(process.env['GH_TOKEN'] ?? ''),
      __GOOGLE_CLIENT_ID__: JSON.stringify(process.env['GOOGLE_DRIVE_CLIENT_ID'] ?? ''),
      __GOOGLE_CLIENT_SECRET__: JSON.stringify(process.env['GOOGLE_DRIVE_CLIENT_SECRET'] ?? '')
    },
    build: {
      lib: {
        entry: 'electron/main/index.ts',
        formats: ['cjs']
      },
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info'],
          passes: 2
        },
        mangle: true,
        format: {
          comments: false
        }
      },
      rollupOptions: {
        output: {
          sourcemap: false
        }
      }
    }
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@ecclesia/api', '@ecclesia/queries']
      })
    ],
    build: {
      lib: {
        entry: 'electron/preload/index.ts',
        formats: ['cjs']
      },
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log'],
          passes: 2
        },
        mangle: true,
        format: {
          comments: false
        }
      },
      rollupOptions: {
        output: {
          sourcemap: false
        }
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
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
          passes: 2,
          toplevel: true
        },
        mangle: {
          toplevel: true
        },
        format: {
          comments: false
        }
      },
      sourcemap: false,
      rollupOptions: {
        input: {
          index: resolve('app/index.html'),
          splash: resolve('app/splash.html')
        },
        output: {
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return undefined

            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'react'
            }

            if (id.includes('/node_modules/react-router')) {
              return 'router'
            }

            if (id.includes('/node_modules/@tiptap/') || id.includes('/node_modules/prosemirror')) {
              return 'editor'
            }

            if (id.includes('/node_modules/framer-motion/')) {
              return 'motion'
            }

            if (id.includes('/node_modules/@radix-ui/')) {
              return 'radix'
            }

            if (id.includes('/node_modules/@tanstack/')) {
              return 'tanstack'
            }

            if (id.includes('/node_modules/@dnd-kit/')) {
              return 'dnd'
            }

            if (
              id.includes('/node_modules/zod/') ||
              id.includes('/node_modules/react-hook-form/') ||
              id.includes('/node_modules/@hookform/')
            ) {
              return 'forms'
            }

            return 'vendor'
          }
        },
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false
        }
      }
    }
  }
})
