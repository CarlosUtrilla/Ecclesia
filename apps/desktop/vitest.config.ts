import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'app'),
      '@locales': resolve(__dirname, 'locales/index.ts'),
      '@ecclesia/api': resolve(__dirname, '../../apps/api'),
      '@ecclesia/queries': resolve(__dirname, '../../packages/queries/src')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup/vitest.setup.ts'],
    include: [
      'app/**/*.test.{ts,tsx}',
      'electron/**/*.test.{ts,tsx}',
      'tests/**/*.test.{ts,tsx}',
      '../../apps/api/src/**/*.test.{ts,tsx}',
      '../../packages/queries/src/**/*.test.{ts,tsx}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['app/**/*.{ts,tsx}', 'electron/**/*.{ts,tsx}'],
      exclude: ['**/*.d.ts', '**/agents.md', '**/*.test.{ts,tsx}']
    }
  }
})
