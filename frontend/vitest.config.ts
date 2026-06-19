import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals:     false,
    include:     ['tests/**/*.test.ts'],
    coverage: {
      provider:  'v8',
      reporter:  ['text', 'lcov'],
      include:   ['lib/**/*.ts', 'types/**/*.ts'],
      exclude:   ['lib/ai-gateway/providers/**'],  // Require live API keys
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
