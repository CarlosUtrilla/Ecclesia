import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

const appDir = resolve(__dirname, '../desktop/app')

export default defineConfig({
  root: appDir,
  base: './',
  resolve: {
    alias: {
      '@': appDir,
      '@locales': resolve(__dirname, '../desktop/locales/index.ts'),
      '@ecclesia/api': resolve(__dirname, '../api'),
      '@ecclesia/queries': resolve(__dirname, '../../packages/queries'),
      '@tauri-apps/api': resolve(__dirname, 'node_modules/@tauri-apps/api'),
      '@tauri-apps/plugin-dialog': resolve(
        __dirname,
        'node_modules/@tauri-apps/plugin-dialog',
      ),
      '@tauri-apps/plugin-fs': resolve(
        __dirname,
        'node_modules/@tauri-apps/plugin-fs',
      ),
    }
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(appDir, 'index.html'),
        splash: resolve(appDir, 'splash.html')
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
