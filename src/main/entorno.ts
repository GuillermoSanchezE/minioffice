import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { escribirJson } from './archivos'
import { homedir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { app, dialog } from 'electron'

/**
 * Una app abierta desde el Finder no hereda el PATH de tu terminal, así que no
 * encontraría `claude`, `git` ni `node`. Se lo pedimos a tu shell de inicio y
 * se añaden las carpetas donde suelen instalarse.
 */
export async function heredarPathDeLaShell(): Promise<void> {
  if (process.platform === 'win32') return
  const actual = (process.env['PATH'] ?? '').split(delimiter).filter(Boolean)
  const shell = process.env['SHELL'] || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
  // Sin bloquear el arranque: la shell puede tardar (nvm, oh-my-zsh…).
  const salida = await new Promise<string>((resolver) => {
    execFile(shell, ['-ilc', 'printf "__MO__%s__MO__" "$PATH"'], { encoding: 'utf8', timeout: 5000 }, (err, stdout) => resolver(err ? '' : stdout))
  })
  const deLaShell = (/__MO__(.*)__MO__/.exec(salida)?.[1] ?? '').split(delimiter).filter(Boolean)
  const casa = homedir()
  const conocidas = [
    join(casa, '.local', 'bin'),
    join(casa, '.claude', 'local'),
    join(casa, '.npm-global', 'bin'),
    join(casa, '.volta', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin'
  ].filter((d) => existsSync(d))
  process.env['PATH'] = [...new Set([...deLaShell, ...actual, ...conocidas])].join(delimiter)
}

function archivoPreferencias(): string {
  return join(app.getPath('userData'), 'proyecto.json')
}

function ultimoProyecto(): string | null {
  try {
    const { ultimo } = JSON.parse(readFileSync(archivoPreferencias(), 'utf8')) as { ultimo?: string }
    return ultimo && existsSync(ultimo) ? ultimo : null
  } catch {
    return null
  }
}

export function recordarProyecto(ruta: string): void {
  escribirJson(archivoPreferencias(), { ultimo: ruta })
}

export async function pedirCarpeta(titulo: string, inicial?: string): Promise<string | null> {
  const r = await dialog.showOpenDialog({
    title: titulo,
    message: titulo,
    buttonLabel: 'Trabajar aquí',
    defaultPath: inicial ?? homedir(),
    properties: ['openDirectory', 'createDirectory']
  })
  return r.canceled ? null : (r.filePaths[0] ?? null)
}

/**
 * La carpeta donde trabaja la oficina: la que se pasó con --proyecto, la de la
 * terminal en desarrollo, la última usada o, la primera vez, la que elijas.
 */
export async function carpetaDelProyecto(): Promise<string | null> {
  const argumento = process.argv.find((a) => a.startsWith('--proyecto='))
  if (argumento) return resolve(argumento.slice('--proyecto='.length))
  if (!app.isPackaged) return process.cwd()
  const ultimo = ultimoProyecto()
  if (ultimo) return ultimo
  await dialog.showMessageBox({
    type: 'info',
    message: 'Bienvenido a minioffice',
    detail:
      'Elige la carpeta del proyecto donde va a trabajar la oficina (tu repositorio o una carpeta nueva). Ahí se guardan el equipo (minioffice.config.json) y la memoria compartida (.hive). Puedes cambiarla después en Ajustes.',
    buttons: ['Elegir carpeta']
  })
  return pedirCarpeta('Carpeta del proyecto')
}

/**
 * Carpeta vacía para lo que ejecuta `claude -p` sin necesitar el proyecto:
 * así no carga la configuración de un repositorio en el que no confías.
 */
export function carpetaNeutra(): string {
  const carpeta = join(app.getPath('userData'), 'sin-proyecto')
  mkdirSync(carpeta, { recursive: true })
  return carpeta
}

/**
 * Reabre la app en otra carpeta de proyecto. Se recuerda como "último proyecto"
 * solo cuando abre bien (si no, la app volvería una y otra vez a una carpeta rota).
 */
export function reabrirEn(ruta: string): void {
  const args = process.argv.slice(1).filter((a) => !a.startsWith('--proyecto='))
  app.relaunch({ args: [...args, `--proyecto=${ruta}`] })
  app.exit(0)
}
