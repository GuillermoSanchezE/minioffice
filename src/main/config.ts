import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { AgentDefinition } from '../shared/types'
import { ID_MICHAEL, REPARTO, personajeDe } from '../shared/reparto'

interface ConfigCruda {
  agentes?: Array<Partial<AgentDefinition>>
}

// Sin config, trabajan todos los empleados del reparto.
const AGENTES_POR_DEFECTO: Array<Partial<AgentDefinition>> = REPARTO.filter((p) => p.id !== ID_MICHAEL).map(
  (p) => ({ id: p.id })
)

/** Completa un agente de la config con los datos del reparto si su id coincide con un personaje. */
function normalizar(crudo: Partial<AgentDefinition>, cwdBase: string): AgentDefinition | null {
  const id = typeof crudo.id === 'string' ? crudo.id.trim().toLowerCase() : ''
  if (!/^[a-z0-9_-]+$/.test(id) || id === ID_MICHAEL) return null
  const personaje = personajeDe(id)
  return {
    id,
    nombre: crudo.nombre?.trim() || personaje?.nombre || id,
    rol: crudo.rol?.trim() || personaje?.rol || 'Agente',
    personalidad: crudo.personalidad?.trim() || personaje?.personalidad,
    comando: crudo.comando?.trim() || 'claude',
    args: Array.isArray(crudo.args) ? crudo.args.map(String) : [],
    cwd: resolve(cwdBase, crudo.cwd ?? '.')
  }
}

export function cargarConfig(cwdBase: string): { agentes: AgentDefinition[] } {
  const ruta = join(cwdBase, 'minioffice.config.json')
  let crudos = AGENTES_POR_DEFECTO

  if (existsSync(ruta)) {
    try {
      const config = JSON.parse(readFileSync(ruta, 'utf-8')) as ConfigCruda
      if (Array.isArray(config.agentes) && config.agentes.length > 0) crudos = config.agentes
    } catch (err) {
      console.error('No se pudo leer minioffice.config.json; se usa el reparto completo:', err)
    }
  }

  const agentes: AgentDefinition[] = []
  for (const crudo of crudos) {
    const agente = normalizar(crudo, cwdBase)
    if (agente && !agentes.some((a) => a.id === agente.id)) agentes.push(agente)
  }

  const michael = personajeDe(ID_MICHAEL)!
  const coordinador: AgentDefinition = {
    id: ID_MICHAEL,
    nombre: michael.nombre,
    rol: michael.rol,
    personalidad: michael.personalidad,
    comando: '',
    args: [],
    cwd: cwdBase,
    esCoordinador: true
  }
  return { agentes: [coordinador, ...agentes] }
}
