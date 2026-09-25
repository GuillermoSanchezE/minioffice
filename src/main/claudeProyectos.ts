import { closeSync, existsSync, openSync, readSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { ConversacionClaude, ProyectoClaude } from '../shared/types'
import { carpetaClaude } from './transcripcion'

const CABECERA = 256 * 1024
const COLA = 128 * 1024
const MAX_PROYECTOS = 60
const MAX_CONVERSACIONES = 30

/** Lee un trozo de un archivo sin cargarlo entero (las transcripciones pesan decenas de MB). */
function leerTrozo(ruta: string, desde: 'inicio' | 'final', bytes: number): string {
  let fd: number | null = null
  try {
    const tamano = statSync(ruta).size
    const largo = Math.min(bytes, tamano)
    const buffer = Buffer.alloc(largo)
    fd = openSync(ruta, 'r')
    readSync(fd, buffer, 0, largo, desde === 'inicio' ? 0 : tamano - largo)
    const texto = buffer.toString('utf8')
    // La primera línea de la cola suele venir cortada.
    return desde === 'final' && largo < tamano ? texto.slice(texto.indexOf('\n') + 1) : texto
  } catch {
    return ''
  } finally {
    if (fd !== null) closeSync(fd)
  }
}

function registros(texto: string): Array<Record<string, unknown>> {
  const lista: Array<Record<string, unknown>> = []
  for (const linea of texto.split('\n')) {
    if (!linea.startsWith('{')) continue
    try {
      lista.push(JSON.parse(linea) as Record<string, unknown>)
    } catch {
      // línea cortada al final del trozo
    }
  }
  return lista
}

/** El texto de un mensaje del usuario, sin los envoltorios que añade Claude Code (<command-name>, avisos…). */
function textoDeUsuario(r: Record<string, unknown>): string | null {
  if (r['type'] !== 'user' || r['isMeta'] || r['isSidechain']) return null
  const mensaje = r['message'] as { content?: unknown } | undefined
  const contenido = mensaje?.content
  let texto = ''
  if (typeof contenido === 'string') texto = contenido
  else if (Array.isArray(contenido)) {
    const bloque = contenido.find((b) => (b as { type?: string }).type === 'text') as { text?: string } | undefined
    texto = bloque?.text ?? ''
  }
  texto = texto.trim()
  if (!texto || texto.startsWith('<')) return null
  return texto
}

function resumir(texto: string, largo = 90): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  return limpio.length > largo ? `${limpio.slice(0, largo - 1)}…` : limpio
}

function transcripciones(dir: string): Array<{ ruta: string; id: string; mtime: number; tamano: number }> {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => {
        const ruta = join(dir, f)
        const s = statSync(ruta)
        return { ruta, id: f.slice(0, -'.jsonl'.length), mtime: s.mtimeMs, tamano: s.size }
      })
      .sort((a, b) => b.mtime - a.mtime)
  } catch {
    return []
  }
}

function cwdDe(ruta: string): string | undefined {
  for (const r of registros(leerTrozo(ruta, 'inicio', CABECERA))) {
    if (typeof r['cwd'] === 'string') return r['cwd']
  }
  return undefined
}

/** Carpetas donde ya trabajaste con Claude Code, la más reciente primero. */
export function listarProyectosClaude(): ProyectoClaude[] {
  const base = join(carpetaClaude(), 'projects')
  let carpetas: string[] = []
  try {
    carpetas = readdirSync(base)
  } catch {
    return []
  }
  const proyectos = new Map<string, ProyectoClaude>()
  for (const carpeta of carpetas) {
    const lista = transcripciones(join(base, carpeta))
    if (lista.length === 0) continue
    let cwd: string | undefined
    for (const t of lista.slice(0, 3)) {
      cwd = cwdDe(t.ruta)
      if (cwd) break
    }
    if (!cwd || !existsSync(cwd)) continue
    const previo = proyectos.get(cwd)
    const ultimo = Math.max(lista[0].mtime, previo?.ultimo ?? 0)
    proyectos.set(cwd, { ruta: cwd, nombre: basename(cwd) || cwd, ultimo, conversaciones: lista.length + (previo?.conversaciones ?? 0) })
  }
  return [...proyectos.values()].sort((a, b) => b.ultimo - a.ultimo).slice(0, MAX_PROYECTOS)
}

/** Conversaciones de Claude Code en una carpeta, para retomarlas con un agente. */
export function listarConversaciones(cwd: string): ConversacionClaude[] {
  const dir = join(carpetaClaude(), 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'))
  if (!existsSync(dir)) return []
  const lista: ConversacionClaude[] = []
  for (const t of transcripciones(dir)) {
    if (lista.length >= MAX_CONVERSACIONES) break
    const inicio = registros(leerTrozo(t.ruta, 'inicio', CABECERA))
    let primerPedido: string | null = null
    let rama: string | undefined
    let desde: number | undefined
    for (const r of inicio) {
      if (!rama && typeof r['gitBranch'] === 'string' && r['gitBranch']) rama = r['gitBranch']
      if (!desde && typeof r['timestamp'] === 'string') desde = Date.parse(r['timestamp'])
      if (!primerPedido) primerPedido = textoDeUsuario(r)
      if (primerPedido && rama && desde) break
    }
    // Sin ningún pedido tuyo no hay nada que retomar.
    if (!primerPedido) continue
    let titulo: string | undefined
    for (const r of registros(leerTrozo(t.ruta, 'final', COLA)).reverse()) {
      const candidato = r['customTitle'] ?? r['aiTitle'] ?? (r['type'] === 'summary' ? r['summary'] : undefined)
      if (typeof candidato === 'string' && candidato.trim()) {
        titulo = candidato
        break
      }
    }
    lista.push({
      id: t.id,
      titulo: resumir(titulo ?? primerPedido),
      primerPedido: resumir(primerPedido, 160),
      inicio: desde,
      ultimo: t.mtime,
      rama,
      megas: Math.max(0.1, Math.round(t.tamano / 1e5) / 10),
      deMinioffice: /^Mensaje de |Confirma en una línea que leíste esto/.test(primerPedido)
    })
  }
  return lista
}
