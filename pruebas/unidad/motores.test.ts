import { describe, expect, it } from 'vitest'
import { ID_CONVERSACION, NOMBRE_MODELO, comandoBase, partirComando } from '../../src/shared/motores'

describe('motores', () => {
  it('arma el comando de Claude Code con modelo y permisos', () => {
    const partes = comandoBase({ proveedor: 'claude', modelo: 'claude-opus-5', comando: undefined, args: [] }, 'auto')
    expect(partes).toEqual(['claude', '--model', 'claude-opus-5', '--permission-mode', 'auto'])
  })

  it('valida ids de conversación y nombres de modelo', () => {
    expect(ID_CONVERSACION.test('1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d')).toBe(true)
    expect(ID_CONVERSACION.test('--resume')).toBe(false)
    expect(NOMBRE_MODELO.test('gpt-5.1-codex')).toBe(true)
    expect(NOMBRE_MODELO.test('-m')).toBe(false)
  })

  it('parte una línea de comando respetando comillas', () => {
    expect(partirComando(`mi-cli --modo "dos palabras" 'tres  espacios'`)).toEqual(['mi-cli', '--modo', 'dos palabras', 'tres  espacios'])
  })
})
