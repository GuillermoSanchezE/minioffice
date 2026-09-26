import { existsSync, readFileSync } from 'node:fs'
import { escribirJson } from './archivos'
import { isAbsolute, join, relative, resolve } from 'node:path'
import type { AgentDefinition, ProveedorId } from '../shared/types'
import { ID_MICHAEL, REPARTO, personajeDe } from '../shared/reparto'
import { ID_CONVERSACION, NOMBRE_MODELO, PROVEEDORES } from '../shared/motores'
import { NOMBRE_SKILL_VALIDO, puestoDe } from '../shared/skills'

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

/** El archivo del equipo puede traer cualquier cosa: solo se aceptan textos. */
function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function proveedorValido(p: unknown): p is ProveedorId {
  return typeof p === 'string' && PROVEEDORES.some((x) => x.id === p)
}

export function normalizar(crudo: Cruda, raiz: string, coordinador = false): AgentDefinition | null {
  const id = coordinador ? ID_MICHAEL : texto(crudo.id).toLowerCase()
  if (!coordinador && (!idValido(id) || id === ID_MICHAEL)) return null
  const personaje = texto(crudo.personaje) || id
  const base = personajeDe(personaje) ?? personajeDe(id)
  // Configs anteriores guardaban el binario en `comando` sin proveedor.
  let proveedor: ProveedorId = proveedorValido(crudo.proveedor) ? crudo.proveedor : 'claude'
  let comando: string | undefined = texto(crudo.comando) || undefined
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
  // Estos dos llegan a la línea de comandos: un valor que empiece por guion sería otra opción.
  const modelo = texto(crudo.modelo)
  const reanudar = texto(crudo.reanudar)
  return {
    id,
    nombre: texto(crudo.nombre) || base?.nombre || id,
    rol: texto(crudo.rol) || puestoDe(personaje, base?.rol) || 'Agente',
    personalidad: texto(crudo.personalidad) || base?.personalidad,
    personaje,
    color: /^#[0-9a-f]{6}$/i.test(texto(crudo.color)) ? texto(crudo.color) : colorPorDefecto(id),
    proveedor,
    modelo: NOMBRE_MODELO.test(modelo) ? modelo : '',
    comando,
    args: Array.isArray(crudo.args) ? crudo.args.map(String) : [],
    cwd: resolve(raiz, texto(crudo.cwd) || '.'),
    aislamientoGit: crudo.aislamientoGit === true,
    reanudar: ID_CONVERSACION.test(reanudar) ? reanudar : undefined,
    descripcion: texto(crudo.descripcion) || undefined,
    objetivo: texto(crudo.objetivo) || undefined,
    nota: texto(crudo.nota) || undefined,
    limiteTokens: Number.isFinite(limite) && limite > 0 ? limite : undefined,
    esCoordinador: coordinador || undefined,
    skills: Array.isArray(crudo.skills)
      ? [...new Set(crudo.skills.map(String).filter((x) => NOMBRE_SKILL_VALIDO.test(x)))]
      : undefined
  }
}

export function cargarEquipo(raiz: string): AgentDefinition[] {
  const ruta = join(raiz, ARCHIVO)
  let config: ConfigCruda = {}
  if (existsSync(ruta)) {
    try {
      const leida = JSON.parse(readFileSync(ruta, 'utf-8')) as unknown
      if (leida && typeof leida === 'object') config = leida as ConfigCruda
    } catch (err) {
      console.error(`No se pudo leer ${ARCHIVO}; se usa el reparto completo:`, err)
    }
  }
  const esObjeto = (x: unknown): x is Cruda => !!x && typeof x === 'object' && !Array.isArray(x)
  const crudos = Array.isArray(config.agentes) && config.agentes.length > 0
    ? config.agentes.filter(esObjeto)
    : REPARTO.filter((p) => p.id !== ID_MICHAEL).map((p) => ({ id: p.id }))

  const agentes: AgentDefinition[] = []
  for (const crudo of crudos) {
    const agente = normalizar(crudo, raiz)
    if (agente && !agentes.some((a) => a.id === agente.id)) agentes.push(agente)
  }
  const michael = normalizar(esObjeto(config.coordinador) ? config.coordinador : {}, raiz, true)!
  return [michael, ...agentes]
}

/** Solo guarda lo que difiere de los valores por defecto, para que el archivo siga siendo legible. */
function compactar(a: AgentDefinition, raiz: string): Cruda {
  const base = personajeDe(a.personaje) ?? personajeDe(a.id)
  const cwd = relative(raiz, a.cwd)
  const salida: Cruda = a.esCoordinador ? {} : { id: a.id }
  if (a.nombre !== (base?.nombre ?? a.id)) salida.nombre = a.nombre
  if (a.rol !== (puestoDe(a.personaje, base?.rol) ?? 'Agente')) salida.rol = a.rol
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
  if (a.skills?.length) salida.skills = a.skills
  return salida
}

export function guardarEquipo(raiz: string, agentes: AgentDefinition[]): void {
  const michael = agentes.find((a) => a.esCoordinador)
  const config: ConfigCruda = {
    coordinador: michael ? compactar(michael, raiz) : undefined,
    agentes: agentes.filter((a) => !a.esCoordinador).map((a) => compactar(a, raiz))
  }
  escribirJson(join(raiz, ARCHIVO), config)
}
