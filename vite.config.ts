/// <reference types="vitest" />

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/vitest-setup.ts'],
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
