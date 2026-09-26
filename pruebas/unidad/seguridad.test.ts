import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { electronSimulado } from './electron-simulado'

vi.mock('electron', () => electronSimulado)
const { esUrlPropia, urlDesarrollo } = await import('../../src/main/seguridad')
const entorno = process.env as Record<string, string | undefined>

afterEach(() => {
  electronSimulado.app.isPackaged = false
  delete entorno['ELECTRON_RENDERER_URL']
})

describe('páginas propias', () => {
  it('la app instalada ignora ELECTRON_RENDERER_URL', () => {
    entorno['ELECTRON_RENDERER_URL'] = 'http://atacante.test'
    electronSimulado.app.isPackaged = true
    expect(urlDesarrollo()).toBeUndefined()
    expect(esUrlPropia('http://atacante.test/index.html')).toBe(false)
  })

  it('en desarrollo acepta el servidor de Vite', () => {
    entorno['ELECTRON_RENDERER_URL'] = 'http://localhost:5173'
    expect(esUrlPropia('http://localhost:5173/index.html')).toBe(true)
    expect(esUrlPropia('http://localhost:5174/index.html')).toBe(false)
  })

  it('solo son propias las páginas de out/renderer', () => {
    electronSimulado.app.isPackaged = true
    const propia = pathToFileURL(join(__dirname, '../../src/renderer/index.html')).href
    expect(esUrlPropia(propia)).toBe(true)
    expect(esUrlPropia('file:///etc/passwd')).toBe(false)
    expect(esUrlPropia(undefined)).toBe(false)
  })
})
