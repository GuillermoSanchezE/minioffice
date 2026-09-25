import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { AgentDefinition } from '../shared/types'

export const ID_MICHAEL = 'michael'

const MICHAEL: AgentDefinition = {
  id: ID_MICHAEL,
  nombre: 'Michael',
  rol: 'Coordinador',
  comando: '',
  args: [],
  cwd: '.',
  escritorio: { x: 10, y: 1 },
  esCoordinador: true
}

const AGENTES_POR_DEFECTO: Array<Partial<AgentDefinition>> = [
  { id: 'ana', nombre: 'Ana', rol: 'Desarrolladora', escritorio: { x: 2, y: 2 } },
  { id: 'beto', nombre: 'Beto', rol: 'Revisor de codigo', escritorio: { x: 5, y: 2 } }
]

interface ConfigCruda {
  agentes?: Array<Partial<AgentDefinition>>
}

function normalizar(crudo: Partial<AgentDefinition>, cwdBase: string): AgentDefinition | null {
  const id = typeof crudo.id === 'string' ? crudo.id.trim().toLowerCase() : ''
  if (!/^[a-z0-9_-]+$/.test(id) || id === ID_MICHAEL) return null
  return {
    id,
    nombre: crudo.nombre?.trim() || id,
    rol: crudo.rol?.trim() || 'Agente',
    comando: crudo.comando?.trim() || 'claude',
    args: Array.isArray(crudo.args) ? crudo.args.map(String) : [],
    cwd: resolve(cwdBase, crudo.cwd ?? '.'),
    escritorio: {
      x: Number(crudo.escritorio?.x ?? 0),
      y: Number(crudo.escritorio?.y ?? 0)
    }
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
      console.error('No se pudo leer minioffice.config.json; se usan los agentes por defecto:', err)
    }
  }

  const agentes: AgentDefinition[] = []
  for (const crudo of crudos) {
    const agente = normalizar(crudo, cwdBase)
    if (agente && !agentes.some((a) => a.id === agente.id)) agentes.push(agente)
  }

  return { agentes: [{ ...MICHAEL, cwd: cwdBase }, ...agentes] }
}
