import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HiveStore } from '../../src/main/hive/hiveStore'

const nueva = (): string => mkdtempSync(join(tmpdir(), 'mo-hive-'))

describe('HiveStore', () => {
  it('no usa un .hive que sea un enlace simbólico', () => {
    const raiz = nueva()
    const otra = nueva()
    symlinkSync(otra, join(raiz, '.hive'))
    expect(() => new HiveStore(raiz)).toThrow(/enlace simbólico/)
  })

  it('las claves no se guardan en ajustes.json', () => {
    const raiz = nueva()
    const hive = new HiveStore(raiz)
    const ajustes = hive.leerAjustes()
    expect(ajustes.webhookClave.length).toBeGreaterThanOrEqual(24)
    hive.guardarAjustes({ ...ajustes, companeros: [{ id: 'o', nombre: 'Otra', url: 'http://x', clave: 'secreta' }] })
    const archivo = readFileSync(join(raiz, '.hive', 'ajustes.json'), 'utf8')
    expect(archivo).not.toContain(ajustes.webhookClave)
    expect(archivo).not.toContain('secreta')
    const releidos = hive.leerAjustes()
    expect(releidos.webhookClave).toBe(ajustes.webhookClave)
    expect(releidos.companeros[0].clave).toBe('secreta')
  })

  it('muda las claves de un ajustes.json antiguo', () => {
    const raiz = nueva()
    mkdirSync(join(raiz, '.hive'))
    writeFileSync(join(raiz, '.hive', 'ajustes.json'), JSON.stringify({ webhookClave: 'vieja-clave-de-24-caracteres' }))
    const hive = new HiveStore(raiz)
    expect(hive.leerAjustes().webhookClave).toBe('vieja-clave-de-24-caracteres')
    expect(readFileSync(join(raiz, '.hive', 'ajustes.json'), 'utf8')).not.toContain('vieja-clave')
  })

  it('un ajustes.json dañado se aparta en vez de perderse', () => {
    const raiz = nueva()
    mkdirSync(join(raiz, '.hive'))
    writeFileSync(join(raiz, '.hive', 'ajustes.json'), '{roto')
    new HiveStore(raiz).leerAjustes()
    expect(readdirSync(join(raiz, '.hive')).some((f) => f.startsWith('ajustes.json.danado-'))).toBe(true)
  })

  it('rechaza mensajes de un agente a destinos que no existen', () => {
    const raiz = nueva()
    const hive = new HiveStore(raiz)
    hive.registrar([
      { id: 'jim', nombre: 'Jim' },
      { id: 'pam', nombre: 'Pam' }
    ])
    hive.depositarSaliente({ de: 'jim', para: 'pam', cuerpo: 'hola' })
    hive.depositarSaliente({ de: 'jim', para: 'nadie', cuerpo: 'hola' })
    const pendientes = hive.listarPendientesDeEnvio('jim', () => false)
    expect(pendientes.map((p) => p.mensaje.para)).toEqual(['pam'])
    expect(existsSync(join(raiz, '.hive', 'agentes', 'jim', 'buzon', 'rechazados'))).toBe(true)
  })

  it('las tareas se releen cuando cambian', () => {
    const raiz = nueva()
    const hive = new HiveStore(raiz)
    mkdirSync(hive.rutaTareas, { recursive: true })
    writeFileSync(join(hive.rutaTareas, 't1.json'), JSON.stringify({ titulo: 'uno', actualizada: 1 }))
    expect(hive.listarTareas()[0].titulo).toBe('uno')
    writeFileSync(join(hive.rutaTareas, 't1.json'), JSON.stringify({ titulo: 'uno cambiado', actualizada: 2 }))
    expect(hive.listarTareas()[0].titulo).toBe('uno cambiado')
  })

  it('el historial puede leer solo los mensajes más recientes', () => {
    const raiz = nueva()
    const hive = new HiveStore(raiz)
    hive.registrar([{ id: 'jim', nombre: 'Jim' }])
    for (let i = 0; i < 5; i++) hive.guardarEnEntrada({ ...hive.nuevoMensaje('usuario', 'jim', `m${i}`), creadoEn: i })
    expect(hive.historialCompleto().length).toBe(5)
    expect(hive.historialCompleto(2).length).toBe(2)
  })
})
