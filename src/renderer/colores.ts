import type { AgentStatus } from '../shared/types'

const PALETA = [0x4f8cff, 0xff8a4f, 0x3fcf8e, 0xc77dff, 0xffc94f, 0x4fd6ff, 0xff5f8f]
const COLOR_MICHAEL = 0x8e9ab3

export function colorDeAgente(id: string, esCoordinador = false): number {
  if (esCoordinador) return COLOR_MICHAEL
  let hash = 0
  for (const letra of id) hash = (hash * 31 + letra.charCodeAt(0)) >>> 0
  return PALETA[hash % PALETA.length]
}

export function aCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

export const COLOR_ESTADO: Record<AgentStatus, number> = {
  detenido: 0x6b7280,
  iniciando: 0xfacc15,
  inactivo: 0x60a5fa,
  trabajando: 0x34d399,
  error: 0xef4444
}

export const ETIQUETA_ESTADO: Record<AgentStatus, string> = {
  detenido: 'Detenido',
  iniciando: 'Iniciando…',
  inactivo: 'En su escritorio',
  trabajando: 'Trabajando',
  error: 'Error'
}
