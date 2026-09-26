import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { format } from 'node:util'
import { app, crashReporter } from 'electron'

const MAX_BYTES = 1_000_000

let archivo: string | null = null
let alFallar: ((texto: string) => void) | null = null
let ultimoAviso = 0

function escribir(nivel: string, partes: unknown[]): void {
  if (!archivo) return
  try {
    try {
      if (statSync(archivo).size > MAX_BYTES) renameSync(archivo, `${archivo}.1`)
    } catch {
      // aún no existe
    }
    appendFileSync(archivo, `${new Date().toISOString()} ${nivel} ${format(...partes)}\n`)
  } catch {
    // disco lleno o sin permiso: no hay dónde anotarlo
  }
}

/**
 * Registro de errores en ~/Library/Logs/minioffice/main.log (1 MB, con una copia
 * anterior) e informes de cierre inesperado en local (no se envían a nadie).
 * Un error no previsto ya no abre un diálogo con la traza: se anota y se avisa
 * en la actividad, como mucho una vez por minuto.
 */
export function iniciarRegistro(): void {
  crashReporter.start({ uploadToServer: false })
  try {
    app.setAppLogsPath()
    const carpeta = app.getPath('logs')
    mkdirSync(carpeta, { recursive: true })
    archivo = join(carpeta, 'main.log')
  } catch {
    archivo = null
  }
  const error = console.error.bind(console)
  const aviso = console.warn.bind(console)
  console.error = (...partes: unknown[]) => {
    error(...partes)
    escribir('ERROR', partes)
  }
  console.warn = (...partes: unknown[]) => {
    aviso(...partes)
    escribir('AVISO', partes)
  }
  const inesperado = (err: unknown): void => {
    console.error('Error no previsto:', err)
    if (alFallar && Date.now() - ultimoAviso > 60_000) {
      ultimoAviso = Date.now()
      alFallar(`Error interno: ${(err as Error)?.message ?? String(err)}. Detalles en ${carpetaRegistro()}`)
    }
  }
  process.on('uncaughtException', inesperado)
  process.on('unhandledRejection', inesperado)
}

/** Quién avisa en la oficina de un error no previsto. */
export function avisarErroresEn(fn: (texto: string) => void): void {
  alFallar = fn
}

export function carpetaRegistro(): string {
  return archivo ? join(archivo, '..') : ''
}
