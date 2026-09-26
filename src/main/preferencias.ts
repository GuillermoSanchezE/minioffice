import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { ProveedorId } from '../shared/types'
import { PROVEEDORES } from '../shared/motores'
import { escribirJson } from './archivos'

/** Preferencias de tu Mac, las mismas en todos los proyectos. */
export interface Preferencias {
  /** Otras IA que agregaste (Claude Code siempre está). */
  motores?: ProveedorId[]
}

function archivo(): string {
  return join(app.getPath('userData'), 'preferencias.json')
}

export function leerPreferencias(): Preferencias {
  try {
    const p = JSON.parse(readFileSync(archivo(), 'utf8')) as Preferencias
    return { motores: Array.isArray(p.motores) ? p.motores.filter((m) => PROVEEDORES.some((x) => x.id === m)) : undefined }
  } catch {
    return {}
  }
}

export function guardarPreferencias(cambios: Preferencias): void {
  escribirJson(archivo(), { ...leerPreferencias(), ...cambios })
}
