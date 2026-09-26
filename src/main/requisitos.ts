import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path'

/** Ruta del ejecutable en el PATH (o relativo a `cwd` si trae carpeta), o null. */
export function rutaEjecutable(binario: string, cwd?: string): string | null {
  if (!binario) return null
  if (binario.includes('/') || binario.includes('\\')) {
    const ruta = isAbsolute(binario) ? binario : resolve(cwd ?? process.cwd(), binario)
    return esArchivo(ruta) ? ruta : null
  }
  const extensiones = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : ['']
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    if (!dir) continue
    for (const ext of extensiones) {
      const ruta = join(dir, binario + ext)
      if (esArchivo(ruta)) return ruta
    }
  }
  return null
}

function esArchivo(ruta: string): boolean {
  try {
    return statSync(ruta).isFile()
  } catch {
    return false
  }
}

let git: boolean | null = null

/**
 * ¿Hay un git de verdad? En un Mac sin las herramientas de línea de comandos,
 * /usr/bin/git es un envoltorio que abre el instalador de Xcode al usarlo.
 */
export function gitDisponible(): boolean {
  if (git !== null) return git
  const ruta = rutaEjecutable('git')
  if (!ruta) return (git = false)
  if (process.platform === 'darwin') {
    let real = ruta
    try {
      real = realpathSync(ruta)
    } catch {
      // se queda la del PATH
    }
    if (real === '/usr/bin/git') {
      try {
        execFileSync('/usr/bin/xcode-select', ['-p'], { stdio: 'ignore', timeout: 3000 })
      } catch {
        return (git = false)
      }
    }
  }
  return (git = true)
}

/** Para las pruebas: vuelve a mirar el PATH. */
export function olvidarRequisitos(): void {
  git = null
}

export interface Requisitos {
  claude: boolean
  git: boolean
}

export function requisitos(): Requisitos {
  return { claude: !!rutaEjecutable('claude'), git: gitDisponible() }
}

function configClaude(): Record<string, unknown> | null {
  const dir = process.env['CLAUDE_CONFIG_DIR']
  const ruta = dir ? join(dir, '.claude.json') : join(homedir(), '.claude.json')
  if (!existsSync(ruta)) return null
  try {
    return JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * ¿Aceptaste en Claude Code la confianza de esta carpeta (o de una que la
 * contiene)? `claude -p` se salta esa pregunta, así que solo se usa donde ya
 * la aceptaste.
 */
export function claudeConfiaEn(carpeta: string): boolean {
  const proyectos = configClaude()?.['projects']
  if (!proyectos || typeof proyectos !== 'object') return false
  let actual = resolve(carpeta)
  for (;;) {
    const p = (proyectos as Record<string, { hasTrustDialogAccepted?: unknown }>)[actual]
    if (p?.hasTrustDialogAccepted === true) return true
    const padre = dirname(actual)
    if (padre === actual) return false
    actual = padre
  }
}
