import { closeSync, existsSync, openSync, readSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { EventEmitter } from 'node:events'
import type { Traza } from '../shared/types'
import { costoDe, type Uso } from '../shared/motores'

const INTERVALO_MS = 700
const MAX_TRAZAS = 300
const TROZO = 1024 * 1024

export function carpetaClaude(): string {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
}

/** Claude Code guarda cada proyecto en una carpeta con la ruta aplanada. */
export function rutaTranscripcion(cwd: string, sesionId: string): string {
  return join(carpetaClaude(), 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'), `${sesionId}.jsonl`)
}

export interface ResumenSesion {
  herramienta?: string
  detalle?: string
  llamadas: number
  tokens: number
  contexto: number
  costo: number
  modelo?: string
  turnoActivo: boolean
  ultimoTexto?: string
  /** Desde cuando hay una herramienta sin resultado (posible permiso pendiente). */
  pendienteDesde?: number
  mensajesUsuario: number
}

function detalleDe(herramienta: string, entrada: Record<string, unknown> | undefined): string {
  if (!entrada) return ''
  const texto = (v: unknown): string => (typeof v === 'string' ? v : '')
  switch (herramienta) {
    case 'Bash':
      return texto(entrada.command).split('\n')[0].slice(0, 80)
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return basename(texto(entrada.file_path))
    case 'NotebookEdit':
      return basename(texto(entrada.notebook_path))
    case 'Grep':
    case 'Glob':
      return texto(entrada.pattern).slice(0, 60)
    case 'WebFetch':
      try {
        return new URL(texto(entrada.url)).host
      } catch {
        return ''
      }
    case 'WebSearch':
      return texto(entrada.query).slice(0, 60)
    case 'Task':
    case 'Agent':
      return texto(entrada.description).slice(0, 60)
    default:
      return ''
  }
}

interface Bloque {
  type?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  text?: string
  tool_use_id?: string
  is_error?: boolean
}

/**
 * Sigue el archivo .jsonl de una sesion de Claude Code y resume lo que esta
 * haciendo el agente: herramienta en curso, llamadas, tokens, contexto y costo.
 * Emite 'cambio' cada vez que el resumen cambia.
 */
export class SeguidorTranscripcion extends EventEmitter {
  private ruta: string
  private desplazamiento = 0
  private resto = ''
  private temporizador: NodeJS.Timeout | null = null
  private ultimaBusqueda = 0

  private trazas = new Map<string, Traza>()
  private pendientes = new Set<string>()
  private usos = new Map<string, Uso & { modelo?: string }>()
  private llamadas = 0
  private contexto = 0
  private modelo?: string
  private turnoActivo = false
  private ultimoTexto?: string
  private mensajesUsuario = 0

  constructor(
    cwd: string,
    private readonly sesionId: string
  ) {
    super()
    this.ruta = rutaTranscripcion(cwd, sesionId)
    this.temporizador = setInterval(() => this.leer(), INTERVALO_MS)
  }

  detener(): void {
    if (this.temporizador) clearInterval(this.temporizador)
    this.temporizador = null
  }

  /** Si la carpeta calculada no existe (rutas con simbolos raros), se busca el archivo por su id. */
  private buscarArchivo(): void {
    if (existsSync(this.ruta) || Date.now() - this.ultimaBusqueda < 3000) return
    this.ultimaBusqueda = Date.now()
    const proyectos = join(carpetaClaude(), 'projects')
    if (!existsSync(proyectos)) return
    for (const carpeta of readdirSync(proyectos)) {
      const candidata = join(proyectos, carpeta, `${this.sesionId}.jsonl`)
      if (existsSync(candidata)) {
        this.ruta = candidata
        return
      }
    }
  }

  private leer(): void {
    this.buscarArchivo()
    if (!existsSync(this.ruta)) return
    let tamano: number
    try {
      tamano = statSync(this.ruta).size
    } catch {
      return
    }
    if (tamano <= this.desplazamiento) return
    const fd = openSync(this.ruta, 'r')
    let cambio = false
    try {
      while (this.desplazamiento < tamano) {
        const largo = Math.min(TROZO, tamano - this.desplazamiento)
        const buffer = Buffer.alloc(largo)
        const leidos = readSync(fd, buffer, 0, largo, this.desplazamiento)
        if (leidos <= 0) break
        this.desplazamiento += leidos
        const texto = this.resto + buffer.subarray(0, leidos).toString('utf-8')
        const lineas = texto.split('\n')
        this.resto = lineas.pop() ?? ''
        for (const linea of lineas) if (linea.trim() && this.procesar(linea)) cambio = true
      }
    } finally {
      closeSync(fd)
    }
    if (cambio) this.emit('cambio', this.resumen())
  }

  private procesar(linea: string): boolean {
    let o: {
      type?: string
      isMeta?: boolean
      timestamp?: string
      message?: { id?: string; model?: string; content?: unknown; stop_reason?: string | null; usage?: Uso }
    }
    try {
      o = JSON.parse(linea)
    } catch {
      return false
    }
    const ts = o.timestamp ? Date.parse(o.timestamp) : Date.now()
    const mensaje = o.message
    if (!mensaje) return false

    if (o.type === 'assistant') {
      if (mensaje.model && mensaje.model !== '<synthetic>') this.modelo = mensaje.model
      if (mensaje.usage && mensaje.id) {
        this.usos.set(mensaje.id, { ...mensaje.usage, modelo: this.modelo })
        const u = mensaje.usage
        this.contexto =
          (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.output_tokens ?? 0)
      }
      const bloques = Array.isArray(mensaje.content) ? (mensaje.content as Bloque[]) : []
      for (const b of bloques) {
        if (b.type === 'tool_use' && b.id && b.name) {
          if (!this.trazas.has(b.id)) this.llamadas++
          this.trazas.set(b.id, { id: b.id, herramienta: b.name, detalle: detalleDe(b.name, b.input), ts, estado: 'pendiente' })
          this.pendientes.add(b.id)
          this.turnoActivo = true
        } else if (b.type === 'text' && b.text?.trim()) {
          this.ultimoTexto = b.text.trim().slice(0, 400)
        }
      }
      const fin = mensaje.stop_reason
      if (fin === 'tool_use') this.turnoActivo = true
      else if (fin && this.pendientes.size === 0) this.turnoActivo = false
      this.recortar()
      return true
    }

    if (o.type === 'user') {
      const contenido = mensaje.content
      if (typeof contenido === 'string') {
        if (o.isMeta) return false
        if (contenido.includes('Request interrupted by user')) {
          this.turnoActivo = false
          this.pendientes.clear()
        } else if (!contenido.startsWith('<command-') && !contenido.startsWith('<local-command')) {
          this.turnoActivo = true
          this.mensajesUsuario++
        }
        return true
      }
      if (Array.isArray(contenido)) {
        for (const b of contenido as Bloque[]) {
          if (b.type === 'tool_result' && b.tool_use_id) {
            const traza = this.trazas.get(b.tool_use_id)
            if (traza) traza.estado = b.is_error ? 'error' : 'ok'
            this.pendientes.delete(b.tool_use_id)
          } else if (b.type === 'text' && typeof b.text === 'string') {
            if (b.text.includes('Request interrupted by user')) {
              this.turnoActivo = false
              this.pendientes.clear()
            } else if (!o.isMeta) {
              this.turnoActivo = true
              this.mensajesUsuario++
            }
          }
        }
        return true
      }
    }
    return false
  }

  private recortar(): void {
    if (this.trazas.size <= MAX_TRAZAS) return
    const sobran = this.trazas.size - MAX_TRAZAS
    let i = 0
    for (const id of this.trazas.keys()) {
      if (i++ >= sobran) break
      this.trazas.delete(id)
    }
  }

  resumen(): ResumenSesion {
    let tokens = 0
    let costo = 0
    for (const uso of this.usos.values()) {
      tokens += (uso.input_tokens ?? 0) + (uso.cache_creation_input_tokens ?? 0) + (uso.output_tokens ?? 0)
      costo += costoDe(uso.modelo, uso)
    }
    let actual: Traza | undefined
    for (const id of this.pendientes) {
      const t = this.trazas.get(id)
      if (t && (!actual || t.ts >= actual.ts)) actual = t
    }
    return {
      herramienta: actual?.herramienta,
      detalle: actual?.detalle,
      llamadas: this.llamadas,
      tokens,
      contexto: this.contexto,
      costo,
      modelo: this.modelo,
      turnoActivo: this.turnoActivo,
      ultimoTexto: this.ultimoTexto,
      pendienteDesde: actual?.ts,
      mensajesUsuario: this.mensajesUsuario
    }
  }

  listaTrazas(): Traza[] {
    return [...this.trazas.values()].sort((a, b) => b.ts - a.ts)
  }
}
