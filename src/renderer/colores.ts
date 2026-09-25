import type { AgentStatus } from '../shared/types'
import { aparienciaDe, colorPrincipal } from './pixel/personajes'

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
  detenido: 0x9a8f86,
  iniciando: 0xe0b020,
  inactivo: 0x8a8fb8,
  trabajando: 0xd9a441,
  esperando: 0xe07a3a,
  pausado: 0x7d8699,
  error: 0xd0584e
}

export const ETIQUETA_ESTADO: Record<AgentStatus, string> = {
  detenido: 'dormido',
  iniciando: 'iniciando',
  inactivo: 'inactivo',
  trabajando: 'trabajando',
  esperando: 'esperando',
  pausado: 'en pausa',
  error: 'error'
}
