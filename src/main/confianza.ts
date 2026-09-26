import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { app, dialog } from 'electron'
import type { AgentDefinition, Ajustes } from '../shared/types'
import { escribirJson } from './archivos'

/**
 * El equipo (minioffice.config.json) y los ajustes (.hive/ajustes.json) viven
 * dentro del proyecto, así que pueden venir de un repositorio clonado. Si traen
 * algo que ejecuta comandos o abre la oficina a la red y no lo escribió
 * minioffice en esta Mac, se pregunta antes de abrir el proyecto.
 */

interface AgenteCrudo {
  id?: unknown
  nombre?: unknown
  proveedor?: unknown
  comando?: unknown
  args?: unknown
  cwd?: unknown
}

interface AjustesCrudos {
  webhooks?: unknown
  webhookRed?: unknown
  companeros?: unknown
  horarios?: unknown
  modoPermisos?: unknown
}

export type Decision = 'normal' | 'seguro' | 'cancelar'

function leerJson<T>(ruta: string): T | null {
  try {
    return JSON.parse(readFileSync(ruta, 'utf8')) as T
  } catch {
    return null
  }
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function fuera(raiz: string, cwd: string): boolean {
  const rel = relative(raiz, resolve(raiz, cwd))
  return rel.startsWith('..') || resolve(rel) === rel
}

/** Lo que puede ejecutar algo o exponer la oficina, y su firma (para saber si cambió). */
export function riesgosDe(raiz: string): { firma: string; riesgos: string[] } {
  const config = leerJson<{ coordinador?: AgenteCrudo; agentes?: AgenteCrudo[] }>(join(raiz, 'minioffice.config.json')) ?? {}
  const ajustes = leerJson<AjustesCrudos>(join(raiz, '.hive', 'ajustes.json')) ?? {}
  const agentes: AgenteCrudo[] = [{ ...(config.coordinador ?? {}), id: 'michael' }, ...(Array.isArray(config.agentes) ? config.agentes : [])]

  const riesgos: string[] = []
  const firma: unknown[] = []
  for (const a of agentes) {
    const nombre = texto(a.nombre) || texto(a.id) || 'un agente'
    const comando = texto(a.comando)
    const args = Array.isArray(a.args) ? a.args.map(String) : []
    const cwd = texto(a.cwd)
    if (a.proveedor === 'personalizado' || (comando && comando !== 'claude')) riesgos.push(`${nombre} ejecuta un comando propio: ${comando || '(vacío)'}`)
    if (args.length) riesgos.push(`${nombre} arranca con argumentos extra: ${args.join(' ')}`)
    if (cwd && fuera(raiz, cwd)) riesgos.push(`${nombre} trabaja fuera del proyecto: ${cwd}`)
    firma.push([texto(a.id), a.proveedor ?? '', comando, args, cwd])
  }

  if (ajustes.webhooks === true) {
    riesgos.push(ajustes.webhookRed === true ? 'El webhook está activado y abierto a tu red local' : 'El webhook está activado')
  }
  const companeros = Array.isArray(ajustes.companeros) ? (ajustes.companeros as Array<{ url?: unknown }>) : []
  if (companeros.length) riesgos.push(`Manda mensajes a otras oficinas: ${companeros.map((c) => texto(c.url)).join(', ')}`)
  const horarios = Array.isArray(ajustes.horarios) ? (ajustes.horarios as Array<Record<string, unknown>>) : []
  const activos = horarios.filter((h) => h.activo === true)
  for (const h of activos) riesgos.push(`Horario activo «${texto(h.nombre)}»: ${texto(h.prompt).slice(0, 80)}`)
  if (ajustes.modoPermisos === 'total') riesgos.push('Modo «Sin permisos»: los agentes hacen todo sin preguntar')
  firma.push(
    ajustes.webhooks === true,
    ajustes.webhookRed === true,
    companeros.map((c) => texto(c.url)),
    activos.map((h) => [h.para, h.prompt, h.cadaMinutos]),
    ajustes.modoPermisos === 'total'
  )

  return { firma: createHash('sha256').update(JSON.stringify(firma)).digest('hex'), riesgos }
}

function archivoConfianza(): string {
  return join(app.getPath('userData'), 'confianza.json')
}

function leerConfiados(): Record<string, string> {
  return leerJson<Record<string, string>>(archivoConfianza()) ?? {}
}

/** minioffice acaba de escribir el equipo o los ajustes: lo que hay ahora es de confianza. */
export function recordarConfianza(raiz: string): void {
  try {
    const confiados = leerConfiados()
    confiados[raiz] = riesgosDe(raiz).firma
    escribirJson(archivoConfianza(), confiados)
  } catch (err) {
    console.error('No se pudo guardar la confianza del proyecto:', err)
  }
}

export async function revisarConfianza(raiz: string): Promise<Decision> {
  const { firma, riesgos } = riesgosDe(raiz)
  if (riesgos.length === 0 || leerConfiados()[raiz] === firma) return 'normal'
  // Solo para las pruebas automáticas (nunca en la app instalada).
  const forzada = app.isPackaged ? undefined : process.env['MINIOFFICE_CONFIANZA']
  if (forzada === 'seguro') return 'seguro'
  if (forzada === 'confiar') {
    recordarConfianza(raiz)
    return 'normal'
  }
  const r = await dialog.showMessageBox({
    type: 'warning',
    message: 'Este proyecto trae ajustes que pueden ejecutar cosas en tu Mac',
    detail:
      `${raiz}\n\nNo los escribió minioffice en esta Mac (o cambiaron desde la última vez):\n\n• ${riesgos.join('\n• ')}\n\n` +
      'Si no sabes de dónde vienen, ábrelo en modo seguro: los agentes usan Claude Code sin comandos ni argumentos extra, y se apagan el webhook, los horarios y las otras oficinas.',
    buttons: ['Abrir en modo seguro', 'Confío en este proyecto', 'Cancelar'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  })
  if (r.response === 2) return 'cancelar'
  if (r.response === 1) {
    recordarConfianza(raiz)
    return 'normal'
  }
  return 'seguro'
}

/** Modo seguro: Claude Code sin comandos ni argumentos propios y dentro del proyecto. */
export function sanearEquipo(defs: AgentDefinition[], raiz: string): AgentDefinition[] {
  return defs.map((d) => ({
    ...d,
    proveedor: d.proveedor === 'personalizado' ? 'claude' : d.proveedor,
    comando: undefined,
    args: [],
    cwd: fuera(raiz, d.cwd) ? raiz : d.cwd
  }))
}

export function sanearAjustes(a: Ajustes): Ajustes {
  return {
    ...a,
    webhooks: false,
    webhookRed: false,
    companeros: [],
    horarios: a.horarios.map((h) => ({ ...h, activo: false })),
    modoPermisos: a.modoPermisos === 'total' ? 'auto' : a.modoPermisos,
    michaelAlIniciar: false
  }
}
