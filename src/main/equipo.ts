import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import type { AgentDefinition, ProveedorId } from '../shared/types'
import { ID_MICHAEL, REPARTO, personajeDe } from '../shared/reparto'
import { PROVEEDORES } from '../shared/motores'

export const COLORES = ['#d9534f', '#4f9d69', '#3c8a99', '#d9a441', '#8a6fd1', '#d98a5c']

const ARCHIVO = 'minioffice.config.json'

type Cruda = Partial<AgentDefinition>

interface ConfigCruda {
  coordinador?: Cruda
  agentes?: Cruda[]
}

function colorPorDefecto(id: string): string {
  let h = 0
  for (const letra of id) h = (h * 31 + letra.charCodeAt(0)) >>> 0
  return COLORES[h % COLORES.length]
}

const idValido = (id: string): boolean => /^[a-z0-9_-]{1,40}$/.test(id)

function proveedorValido(p: unknown): p is ProveedorId {
  return typeof p === 'string' && PROVEEDORES.some((x) => x.id === p)
}

export function normalizar(crudo: Cruda, raiz: string, coordinador = false): AgentDefinition | null {
  const id = coordinador ? ID_MICHAEL : typeof crudo.id === 'string' ? crudo.id.trim().toLowerCase() : ''
  if (!coordinador && (!idValido(id) || id === ID_MICHAEL)) return null
  const personaje = typeof crudo.personaje === 'string' && crudo.personaje ? crudo.personaje : id
  const base = personajeDe(personaje) ?? personajeDe(id)
  // Configs anteriores guardaban el binario en `comando` sin proveedor.
  let proveedor: ProveedorId = proveedorValido(crudo.proveedor) ? crudo.proveedor : 'claude'
  let comando = typeof crudo.comando === 'string' ? crudo.comando.trim() : undefined
  if (!crudo.proveedor && comando && comando !== 'claude') {
    const conocido = PROVEEDORES.find((p) => p.binario === comando)
    if (conocido) {
      proveedor = conocido.id
      comando = undefined
    } else {
      proveedor = 'personalizado'
    }
  }
  if (proveedor !== 'personalizado') comando = undefined
  const limite = Number(crudo.limiteTokens)
  return {
    id,
    nombre: crudo.nombre?.trim() || base?.nombre || id,
    rol: crudo.rol?.trim() || base?.rol || 'Agente',
    personalidad: crudo.personalidad?.trim() || base?.personalidad,
    personaje,
    color: typeof crudo.color === 'string' && /^#[0-9a-f]{6}$/i.test(crudo.color) ? crudo.color : colorPorDefecto(id),
    proveedor,
    modelo: typeof crudo.modelo === 'string' ? crudo.modelo.trim() : '',
    comando,
    args: Array.isArray(crudo.args) ? crudo.args.map(String) : [],
    cwd: resolve(raiz, typeof crudo.cwd === 'string' && crudo.cwd ? crudo.cwd : '.'),
    aislamientoGit: !!crudo.aislamientoGit,
    reanudar: crudo.reanudar?.trim() || undefined,
    descripcion: crudo.descripcion?.trim() || undefined,
    objetivo: crudo.objetivo?.trim() || undefined,
    nota: crudo.nota?.trim() || undefined,
    limiteTokens: Number.isFinite(limite) && limite > 0 ? limite : undefined,
    esCoordinador: coordinador || undefined
  }
}

export function cargarEquipo(raiz: string): AgentDefinition[] {
  const ruta = join(raiz, ARCHIVO)
  let config: ConfigCruda = {}
  if (existsSync(ruta)) {
    try {
      config = JSON.parse(readFileSync(ruta, 'utf-8')) as ConfigCruda
    } catch (err) {
      console.error(`No se pudo leer ${ARCHIVO}; se usa el reparto completo:`, err)
    }
  }
  const crudos = Array.isArray(config.agentes) && config.agentes.length > 0
    ? config.agentes
    : REPARTO.filter((p) => p.id !== ID_MICHAEL).map((p) => ({ id: p.id }))

  const agentes: AgentDefinition[] = []
  for (const crudo of crudos) {
    const agente = normalizar(crudo, raiz)
    if (agente && !agentes.some((a) => a.id === agente.id)) agentes.push(agente)
  }
  const michael = normalizar(config.coordinador ?? {}, raiz, true)!
  return [michael, ...agentes]
}

/** Solo guarda lo que difiere de los valores por defecto, para que el archivo siga siendo legible. */
function compactar(a: AgentDefinition, raiz: string): Cruda {
  const base = personajeDe(a.personaje) ?? personajeDe(a.id)
  const cwd = relative(raiz, a.cwd)
  const salida: Cruda = a.esCoordinador ? {} : { id: a.id }
  if (a.nombre !== (base?.nombre ?? a.id)) salida.nombre = a.nombre
  if (a.rol !== (base?.rol ?? 'Agente')) salida.rol = a.rol
  if (a.personalidad && a.personalidad !== base?.personalidad) salida.personalidad = a.personalidad
  if (a.personaje !== a.id) salida.personaje = a.personaje
  if (a.color !== colorPorDefecto(a.id)) salida.color = a.color
  if (a.proveedor !== 'claude') salida.proveedor = a.proveedor
  if (a.modelo) salida.modelo = a.modelo
  if (a.comando) salida.comando = a.comando
  if (a.args.length) salida.args = a.args
  salida.cwd = cwd === '' ? '.' : cwd.startsWith('..') || isAbsolute(cwd) ? a.cwd : cwd
  if (a.aislamientoGit) salida.aislamientoGit = true
  if (a.reanudar) salida.reanudar = a.reanudar
  if (a.descripcion) salida.descripcion = a.descripcion
  if (a.objetivo) salida.objetivo = a.objetivo
  if (a.nota) salida.nota = a.nota
  if (a.limiteTokens) salida.limiteTokens = a.limiteTokens
  return salida
}

export function guardarEquipo(raiz: string, agentes: AgentDefinition[]): void {
  const michael = agentes.find((a) => a.esCoordinador)
  const config: ConfigCruda = {
    coordinador: michael ? compactar(michael, raiz) : undefined,
    agentes: agentes.filter((a) => !a.esCoordinador).map((a) => compactar(a, raiz))
  }
  const ruta = join(raiz, ARCHIVO)
  const temporal = `${ruta}.tmp`
  writeFileSync(temporal, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
  renameSync(temporal, ruta)
}
