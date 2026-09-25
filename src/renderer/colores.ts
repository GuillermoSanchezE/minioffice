import type { AgentStatus } from '../shared/types'
import { aparienciaDe, colorPrincipal } from './oficina/personajes'

/** Color que identifica al personaje: el de su camisa, saco o cardigan. */
export function colorDeAgente(id: string): number {
  return colorPrincipal(aparienciaDe(id))
}

/** Texto oscuro sobre colores claros y claro sobre oscuros. */
export function colorTextoSobre(fondo: number): string {
  const r = (fondo >> 16) & 0xff
  const g = (fondo >> 8) & 0xff
  const b = fondo & 0xff
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111827' : '#f8fafc'
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/)
  return partes
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
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
  detenido: 'Dormido',
  iniciando: 'Llegando…',
  inactivo: 'En su escritorio',
  trabajando: 'Trabajando',
  error: 'Error'
}
