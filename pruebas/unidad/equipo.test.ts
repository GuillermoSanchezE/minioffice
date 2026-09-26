import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cargarEquipo, normalizar } from '../../src/main/equipo'

const raiz = mkdtempSync(join(tmpdir(), 'mo-equipo-'))
const UUID = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d'

describe('normalizar: lo que llega a la línea de comandos', () => {
  it('acepta un id de conversación válido', () => {
    expect(normalizar({ id: 'jim', reanudar: UUID }, raiz)?.reanudar).toBe(UUID)
  })

  it('descarta un "reanudar" que no es un UUID (p. ej. que empieza por guion)', () => {
    for (const malo of ['--version', '-x', `${UUID} --algo`, 'abc', '']) {
      expect(normalizar({ id: 'jim', reanudar: malo }, raiz)?.reanudar).toBeUndefined()
    }
  })

  it('descarta un modelo que empieza por guion o trae espacios', () => {
    expect(normalizar({ id: 'jim', modelo: '--settings' }, raiz)?.modelo).toBe('')
    expect(normalizar({ id: 'jim', modelo: 'claude-opus-5 --x' }, raiz)?.modelo).toBe('')
    expect(normalizar({ id: 'jim', modelo: 'claude-opus-5[1m]' }, raiz)?.modelo).toBe('claude-opus-5[1m]')
  })

  it('no falla si el archivo trae campos que no son texto', () => {
    const crudo = { id: 'jim', nombre: 123, rol: {}, reanudar: 5, modelo: [], cwd: 7, color: null } as unknown as Parameters<typeof normalizar>[0]
    const a = normalizar(crudo, raiz)
    expect(a?.id).toBe('jim')
    expect(a?.cwd).toBe(raiz)
    expect(a?.reanudar).toBeUndefined()
  })

  it('solo el motor personalizado conserva un comando propio', () => {
    expect(normalizar({ id: 'jim', proveedor: 'claude', comando: 'rm' }, raiz)?.comando).toBeUndefined()
    expect(normalizar({ id: 'jim', proveedor: 'personalizado', comando: 'mi-cli' }, raiz)?.comando).toBe('mi-cli')
  })
})

describe('cargarEquipo con archivos raros', () => {
  it('JSON que no es un objeto: usa el reparto completo', () => {
    const r = mkdtempSync(join(tmpdir(), 'mo-equipo-'))
    writeFileSync(join(r, 'minioffice.config.json'), 'null')
    expect(cargarEquipo(r).length).toBeGreaterThan(1)
  })

  it('ignora entradas que no son objetos', () => {
    const r = mkdtempSync(join(tmpdir(), 'mo-equipo-'))
    writeFileSync(join(r, 'minioffice.config.json'), JSON.stringify({ coordinador: 'x', agentes: [null, 3, { id: 'dwight' }] }))
    const equipo = cargarEquipo(r)
    expect(equipo.map((a) => a.id)).toEqual(['michael', 'dwight'])
  })
})
