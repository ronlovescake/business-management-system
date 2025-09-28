import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**/*'],
  },
})