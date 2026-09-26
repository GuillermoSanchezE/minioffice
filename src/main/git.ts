import { existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import simpleGit from 'simple-git'
import type { EstadoGit } from '../shared/types'
import { gitDisponible } from './requisitos'

const SIN_GIT = 'git no está instalado en esta Mac (instala las herramientas de desarrollo de Apple con «xcode-select --install»).'

export async function estadoGit(cwd: string): Promise<EstadoGit> {
  if (!existsSync(cwd)) return { esRepo: false, cambios: [], log: [], diffstat: '', error: 'La carpeta no existe.' }
  if (!gitDisponible()) return { esRepo: false, cambios: [], log: [], diffstat: '', error: SIN_GIT }
  const git = simpleGit(cwd)
  try {
    if (!(await git.checkIsRepo())) return { esRepo: false, cambios: [], log: [], diffstat: '' }
    const [estado, log, diffstat] = await Promise.all([
      git.raw(['status', '--short', '--branch']),
      git.raw(['log', '--oneline', '--decorate', '-n', '20']).catch(() => ''),
      git.raw(['diff', '--stat', 'HEAD']).catch(() => '')
    ])
    const lineas = estado.split('\n').filter(Boolean)
    const rama = lineas[0]?.startsWith('## ') ? lineas.shift()!.slice(3) : undefined
    return { esRepo: true, rama, cambios: lineas, log: log.split('\n').filter(Boolean), diffstat: diffstat.trim() }
  } catch (err) {
    return { esRepo: false, cambios: [], log: [], diffstat: '', error: (err as Error).message }
  }
}

/**
 * Crea (o reutiliza) un worktree propio para el agente junto al repositorio,
 * en la rama minioffice/<id>. Devuelve la carpeta donde debe trabajar.
 */
export async function worktreePara(cwd: string, agentId: string): Promise<string> {
  if (!gitDisponible()) throw new Error(SIN_GIT)
  const git = simpleGit(cwd)
  if (!(await git.checkIsRepo())) throw new Error('La carpeta no es un repositorio git.')
  const raiz = (await git.revparse(['--show-toplevel'])).trim()
  const destino = join(dirname(raiz), `${basename(raiz)}-minioffice`, agentId)
  // Si el agente trabaja en una subcarpeta del repo, sigue en la misma subcarpeta del worktree.
  const subcarpeta = relative(raiz, cwd)
  if (!existsSync(join(destino, '.git'))) {
    mkdirSync(dirname(destino), { recursive: true })
    const rama = `minioffice/${agentId}`
    const ramas = await git.branchLocal()
    const args = ramas.all.includes(rama) ? ['worktree', 'add', destino, rama] : ['worktree', 'add', '-b', rama, destino]
    await simpleGit(raiz).raw(args)
  }
  return subcarpeta && !subcarpeta.startsWith('..') ? join(destino, subcarpeta) : destino
}
