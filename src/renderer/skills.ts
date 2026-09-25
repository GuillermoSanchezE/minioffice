import { useEffect, useSyncExternalStore } from 'react'
import type { SkillOficina } from '../shared/acciones'
import { accion } from './tienda'

/** Lista de skills (catálogo, biblioteca y globales) compartida entre pantallas. */
let lista: SkillOficina[] | null = null
let pedido: Promise<void> | null = null
const oyentes = new Set<() => void>()

export function recargarSkills(): Promise<void> {
  pedido ??= accion({ tipo: 'skills:listar' })
    .then((r) => {
      if (r) {
        lista = r
        oyentes.forEach((o) => o())
      }
    })
    .finally(() => {
      pedido = null
    })
  return pedido
}

export function useSkills(): SkillOficina[] | null {
  const valor = useSyncExternalStore(
    (o) => {
      oyentes.add(o)
      return () => oyentes.delete(o)
    },
    () => lista
  )
  useEffect(() => {
    if (!lista) void recargarSkills()
  }, [])
  return valor
}

export const NOMBRE_FUENTE: Record<SkillOficina['fuente'], string> = {
  uiux: 'UI/UX Pro Max',
  ecc: 'ECC',
  anthropic: 'Anthropic',
  propia: 'tuya',
  global: 'global'
}
