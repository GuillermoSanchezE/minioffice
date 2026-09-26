import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import { escribirJson } from './archivos'

export interface ClavesProyecto {
  webhookClave?: string
  /** Clave de cada oficina compañera, por su id. */
  companeros: Record<string, string>
}

export interface AlmacenSecretos {
  leer(): ClavesProyecto
  guardar(claves: ClavesProyecto): void
}

const PREFIJO = 'llavero:'

/**
 * Las claves del webhook y de las otras oficinas, fuera de la carpeta del
 * proyecto (que puede compartirse o acabar en un commit): en
 * ~/Library/Application Support/minioffice/secretos.json, legible solo por tu
 * usuario. Si la app va firmada con un Developer ID, además cifradas con el
 * Llavero de macOS (con firma ad hoc, el Llavero pediría permiso en cada versión).
 */
export class Secretos implements AlmacenSecretos {
  constructor(private proyecto: string) {}

  private archivo(): string {
    return join(app.getPath('userData'), 'secretos.json')
  }

  private todos(): Record<string, Record<string, string>> {
    try {
      const d = JSON.parse(readFileSync(this.archivo(), 'utf8')) as unknown
      return d && typeof d === 'object' ? (d as Record<string, Record<string, string>>) : {}
    } catch {
      return {}
    }
  }

  private llavero(): boolean {
    return import.meta.env.MAIN_VITE_FIRMADA === '1' && safeStorage.isEncryptionAvailable()
  }

  private cifrar(valor: string): string {
    return this.llavero() ? `${PREFIJO}${safeStorage.encryptString(valor).toString('base64')}` : valor
  }

  private descifrar(valor: unknown): string | undefined {
    if (typeof valor !== 'string') return undefined
    if (!valor.startsWith(PREFIJO)) return valor
    try {
      return safeStorage.decryptString(Buffer.from(valor.slice(PREFIJO.length), 'base64'))
    } catch {
      return undefined
    }
  }

  leer(): ClavesProyecto {
    const guardadas = this.todos()[this.proyecto] ?? {}
    const claves: ClavesProyecto = { webhookClave: this.descifrar(guardadas['webhook']), companeros: {} }
    for (const [campo, valor] of Object.entries(guardadas)) {
      const clave = campo.startsWith('companero:') ? this.descifrar(valor) : undefined
      if (clave !== undefined) claves.companeros[campo.slice('companero:'.length)] = clave
    }
    return claves
  }

  guardar(claves: ClavesProyecto): void {
    const todos = this.todos()
    const propias: Record<string, string> = {}
    if (claves.webhookClave) propias['webhook'] = this.cifrar(claves.webhookClave)
    for (const [id, clave] of Object.entries(claves.companeros)) if (clave) propias[`companero:${id}`] = this.cifrar(clave)
    todos[this.proyecto] = propias
    escribirJson(this.archivo(), todos, 0o600)
  }
}
