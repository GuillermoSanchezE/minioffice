import { defineConfig } from 'vitest/config'

// Pruebas unitarias del proceso principal y del código compartido (sin Electron: se simula).
export default defineConfig({
  test: {
    include: ['pruebas/unidad/**/*.test.ts'],
    environment: 'node'
  }
})
