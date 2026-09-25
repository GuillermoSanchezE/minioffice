import { useSyncExternalStore } from 'react'
import type { Accion, Respuesta } from '../shared/acciones'
import type { Agente, Instantanea } from '../shared/types'

type Oyente = () => void

/** Estado de la oficina tal como lo manda el proceso principal, con parches en vivo. */
class Tienda {
  estado: Instantanea | null = null
  private oyentes = new Set<Oyente>()
  private iniciada = false

  iniciar(): void {
    if (this.iniciada) return
    this.iniciada = true
    window.minioffice.onParche((p) => {
      if (!this.estado) return
      this.estado = { ...this.estado, [p.dominio]: p.datos }
      this.avisar()
    })
    void window.minioffice.estadoInicial().then((e) => {
      this.estado = e
      this.avisar()
    })
  }

  suscribir = (oyente: Oyente): (() => void) => {
    this.oyentes.add(oyente)
    return () => this.oyentes.delete(oyente)
  }

  private avisar(): void {
    for (const o of this.oyentes) o()
  }
}

export const tienda = new Tienda()

export function useOficina<T>(selector: (e: Instantanea) => T): T | undefined {
  return useSyncExternalStore(tienda.suscribir, () => (tienda.estado ? selector(tienda.estado) : undefined))
}

export function useAgentes(): Agente[] {
  return useOficina((e) => e.agentes) ?? SIN_AGENTES
}

const SIN_AGENTES: Agente[] = []

// ------------------------------------------------------------------ avisos

export interface Aviso {
  id: number
  texto: string
  tipo: 'error' | 'ok'
}

let avisos: Aviso[] = []
const oyentesAvisos = new Set<Oyente>()
let siguienteAviso = 1

export function avisar(texto: string, tipo: Aviso['tipo'] = 'ok'): void {
  const aviso = { id: siguienteAviso++, texto, tipo }
  avisos = [...avisos, aviso]
  oyentesAvisos.forEach((o) => o())
  setTimeout(() => {
    avisos = avisos.filter((a) => a.id !== aviso.id)
    oyentesAvisos.forEach((o) => o())
  }, tipo === 'error' ? 6000 : 3000)
}

export function useAvisos(): Aviso[] {
  return useSyncExternalStore(
    (o) => {
      oyentesAvisos.add(o)
      return () => oyentesAvisos.delete(o)
    },
    () => avisos
  )
}

function mensajeDeError(err: unknown): string {
  return (err as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/** Ejecuta una accion en el proceso principal y muestra el error si falla. */
export async function accion<A extends Accion>(a: A): Promise<Respuesta<A> | undefined> {
  try {
    return await window.minioffice.accion(a)
  } catch (err) {
    avisar(mensajeDeError(err), 'error')
    return undefined
  }
}

/** Como `accion`, pero dice si salio bien (para acciones que no devuelven nada). */
export async function intentar(a: Accion): Promise<boolean> {
  try {
    await window.minioffice.accion(a)
    return true
  } catch (err) {
    avisar(mensajeDeError(err), 'error')
    return false
  }
}
