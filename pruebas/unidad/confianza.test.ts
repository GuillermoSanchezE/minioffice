import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { electronSimulado } from './electron-simulado'

vi.mock('electron', () => electronSimulado)
const { riesgosDe, sanearAjustes, sanearEquipo } = await import('../../src/main/confianza')
const { AJUSTES_POR_DEFECTO } = await import('../../src/main/hive/hiveStore')
const { normalizar } = await import('../../src/main/equipo')

function proyecto(config?: unknown, ajustes?: unknown): string {
  const raiz = mkdtempSync(join(tmpdir(), 'mo-conf-'))
  if (config) writeFileSync(join(raiz, 'minioffice.config.json'), JSON.stringify(config))
  if (ajustes) {
    mkdirSync(join(raiz, '.hive'))
    writeFileSync(join(raiz, '.hive', 'ajustes.json'), JSON.stringify(ajustes))
  }
  return raiz
}

describe('confianza de un proyecto', () => {
  it('un proyecto sin nada raro no tiene riesgos', () => {
    expect(riesgosDe(proyecto({ agentes: [{ id: 'jim' }] })).riesgos).toEqual([])
  })

  it('detecta comandos, argumentos, carpetas fuera y ajustes peligrosos', () => {
    const raiz = proyecto(
      { agentes: [{ id: 'jim', proveedor: 'personalizado', comando: 'x' }, { id: 'pam', args: ['--y'] }, { id: 'kevin', cwd: '/tmp' }] },
      { webhooks: true, webhookRed: true, companeros: [{ url: 'http://otra' }], horarios: [{ activo: true, nombre: 'h', prompt: 'p' }], modoPermisos: 'total' }
    )
    const { riesgos } = riesgosDe(raiz)
    expect(riesgos.length).toBe(7)
  })

  it('la firma cambia si cambia algo que ejecuta', () => {
    const a = riesgosDe(proyecto({ agentes: [{ id: 'jim', args: ['--a'] }] })).firma
    const b = riesgosDe(proyecto({ agentes: [{ id: 'jim', args: ['--b'] }] })).firma
    expect(a).not.toBe(b)
  })

  it('el modo seguro quita comandos, argumentos, webhook, horarios y otras oficinas', () => {
    const raiz = proyecto()
    const def = normalizar({ id: 'jim', proveedor: 'personalizado', comando: 'x', args: ['--y'], cwd: '/tmp' }, raiz)!
    const [limpio] = sanearEquipo([def], raiz)
    expect(limpio.proveedor).toBe('claude')
    expect(limpio.args).toEqual([])
    expect(limpio.cwd).toBe(raiz)
    const ajustes = sanearAjustes({
      ...AJUSTES_POR_DEFECTO,
      webhooks: true,
      webhookRed: true,
      companeros: [{ id: 'a', nombre: 'a', url: 'u', clave: 'k' }],
      modoPermisos: 'total',
      horarios: AJUSTES_POR_DEFECTO.horarios.map((h) => ({ ...h, activo: true }))
    })
    expect(ajustes.webhooks || ajustes.webhookRed || ajustes.michaelAlIniciar).toBe(false)
    expect(ajustes.companeros).toEqual([])
    expect(ajustes.modoPermisos).toBe('auto')
    expect(ajustes.horarios.every((h) => !h.activo)).toBe(true)
  })
})
