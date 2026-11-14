import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Real-Windows tests: run with `npm run test:windows` on a Windows machine.
export default defineConfig({
  resolve: { alias: { '@shared': resolve(import.meta.dirname, 'shared') } },
  test: { include: ['tests/windows/**/*.win.ts'], environment: 'node', testTimeout: 120_000, hookTimeout: 60_000, maxConcurrency: 4 }
})
