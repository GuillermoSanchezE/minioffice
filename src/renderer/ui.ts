import { useSyncExternalStore } from 'react'
import type { AgentDefinition } from '../shared/types'

export type Pestana =
  | 'terminal'
  | 'monitor'
  | 'tareas'
  | 'preguntas'
  | 'bandeja'
  | 'disparadores'
  | 'memoria'
  | 'grafo'
  | 'actividad'
  | 'comandos'
  | 'temporales'
  | 'capacidades'
  | 'equipo'
  | 'grapadora'

export type Tema = 'claro' | 'oscuro'

export interface EstadoUi {
  seleccionado: string | null
  pestana: Pestana
  pantallaCompleta: boolean
  barraLateral: boolean
  tema: Tema
  anchoPanel: number
  /** Agente en edicion, 'nuevo' para contratar o null si el asistente esta cerrado. */
  asistente: AgentDefinition | 'nuevo' | null
  ajustesAbiertos: boolean
}

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const v = localStorage.getItem(`minioffice:${clave}`)
    return v === null ? porDefecto : (JSON.parse(v) as T)
  } catch {
    return porDefecto
  }
}

function escribir(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(`minioffice:${clave}`, JSON.stringify(valor))
  } catch {
    // almacenamiento no disponible: se pierde solo la preferencia
  }
}

let estado: EstadoUi = {
  seleccionado: null,
  pestana: 'terminal',
  pantallaCompleta: leer('pantallaCompleta', false),
  barraLateral: true,
  tema: leer<Tema>('tema', 'claro'),
  anchoPanel: leer('anchoPanel', 560),
  asistente: null,
  ajustesAbiertos: false
}

const oyentes = new Set<() => void>()

export function cambiarUi(cambios: Partial<EstadoUi>): void {
  estado = { ...estado, ...cambios }
  if (cambios.tema) escribir('tema', cambios.tema)
  if (cambios.anchoPanel) escribir('anchoPanel', cambios.anchoPanel)
  if (cambios.pantallaCompleta !== undefined) escribir('pantallaCompleta', cambios.pantallaCompleta)
  oyentes.forEach((o) => o())
}

export function useUi(): EstadoUi {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o)
      return () => oyentes.delete(o)
    },
    () => estado
  )
}

export function seleccionar(id: string | null): void {
  cambiarUi({ seleccionado: id })
}

export function preferencia<T>(clave: string, porDefecto: T): T {
  return leer(clave, porDefecto)
}

export function guardarPreferencia(clave: string, valor: unknown): void {
  escribir(clave, valor)
}
