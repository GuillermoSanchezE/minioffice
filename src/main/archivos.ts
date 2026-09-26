import { chmodSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'

/**
 * Escribe en un temporal y lo renombra: si la app se cierra o el disco se llena
 * a mitad, el archivo anterior sigue entero.
 */
export function escribirAtomico(ruta: string, contenido: string, modo?: number): void {
  mkdirSync(dirname(ruta), { recursive: true })
  const temporal = `${ruta}.${randomUUID().slice(0, 8)}.tmp`
  try {
    writeFileSync(temporal, contenido, modo === undefined ? undefined : { mode: modo })
    if (modo !== undefined) chmodSync(temporal, modo)
    renameSync(temporal, ruta)
  } catch (err) {
    rmSync(temporal, { force: true })
    throw err
  }
}

export function escribirJson(ruta: string, datos: unknown, modo?: number): void {
  escribirAtomico(ruta, `${JSON.stringify(datos, null, 2)}\n`, modo)
}
