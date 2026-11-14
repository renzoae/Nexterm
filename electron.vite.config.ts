import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const alias = { '@shared': resolve(__dirname, 'shared') }

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      outDir: 'out/main',
      rollupOptions: { input: { index: resolve(__dirname, 'electron/main/index.ts') } }
    }
  },
  preload: {
    resolve: { alias },
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/preload/index.ts') },
        // Sandboxed preloads must be a single CommonJS file.
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    root: '.',
    resolve: { alias: { ...alias, '@': resolve(__dirname, 'src') } },
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: { index: resolve(__dirname, 'index.html') } }
    }
  }
})
