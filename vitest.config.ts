import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'app'),
      '@api': resolve(__dirname, 'database/api.ts'),
      '@queries': resolve(__dirname, 'queries'),
      '@locales': resolve(__dirname, 'locales/index.ts')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup/vitest.setup.ts'],
    include: [
      'app/**/*.test.{ts,tsx}',
      'database/**/*.test.{ts,tsx}',
      'electron/**/*.test.{ts,tsx}',
      'tests/**/*.test.{ts,tsx}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['app/**/*.{ts,tsx}', 'database/**/*.{ts,tsx}', 'electron/**/*.{ts,tsx}'],
      exclude: ['**/*.d.ts', '**/agents.md', '**/*.test.{ts,tsx}']
    }
  }
})
