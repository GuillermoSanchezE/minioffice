import { describe, expect, it, vi } from 'vitest'
import { electronSimulado } from './electron-simulado'

vi.mock('electron', () => electronSimulado)
const { compararVersiones } = await import('../../src/main/actualizaciones')

describe('versiones', () => {
  it('compara x.y.z como números', () => {
    expect(compararVersiones('0.10.0', '0.9.9')).toBeGreaterThan(0)
    expect(compararVersiones('0.3.0', '0.3.0')).toBe(0)
    expect(compararVersiones('0.3.0', '1.0.0')).toBeLessThan(0)
  })
})
