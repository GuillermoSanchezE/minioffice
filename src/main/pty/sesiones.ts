import * as pty from 'node-pty'
import { EventEmitter } from 'node:events'

const MAX_HISTORIAL = 400_000
const MAX_TEXTO_RECIENTE = 4000

interface Sesion {
  proceso: pty.IPty
  historial: string
  /** Salida reciente sin codigos ANSI, para detectar preguntas de permiso. */
  reciente: string
  ultimaSalida: number
  inicio: number
  pausada: boolean
  pegadoEntreCorchetes: boolean
}

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*(\x07|\x1b\\)|\x1b[@-Z\\-_]/g

export interface OpcionesSesion {
  comando: string
  args: string[]
  cwd: string
  env?: Record<string, string>
}

/**
 * Terminales reales (node-pty), una por agente. Eventos:
 * 'salida' (id, data) · 'salio' (id, codigo)
 */
export class Sesiones extends EventEmitter {
  private sesiones = new Map<string, Sesion>()

  activa(id: string): boolean {
    return this.sesiones.has(id)
  }

  pausada(id: string): boolean {
    return this.sesiones.get(id)?.pausada ?? false
  }

  /** Milisegundos desde la ultima salida de la terminal. */
  silencio(id: string): number {
    const s = this.sesiones.get(id)
    return s ? Date.now() - s.ultimaSalida : Infinity
  }

  edad(id: string): number {
    const s = this.sesiones.get(id)
    return s ? Date.now() - s.inicio : 0
  }

  reciente(id: string): string {
    return this.sesiones.get(id)?.reciente ?? ''
  }

  historial(id: string): string {
    return this.sesiones.get(id)?.historial ?? ''
  }

  iniciar(id: string, opciones: OpcionesSesion): string | null {
    if (this.sesiones.has(id)) return null
    const entorno: Record<string, string> = { ...(process.env as Record<string, string>), ...opciones.env }
    // Cada agente es una sesion independiente aunque minioffice se lance desde Claude Code.
    delete entorno.CLAUDECODE
    delete entorno.CLAUDE_CODE_ENTRYPOINT
    entorno.TERM = 'xterm-256color'
    entorno.COLORTERM = 'truecolor'
    let proceso: pty.IPty
    try {
      proceso = pty.spawn(opciones.comando, opciones.args, {
        name: 'xterm-256color',
        cols: 110,
        rows: 32,
        cwd: opciones.cwd,
        env: entorno
      })
    } catch (err) {
      return (err as Error).message
    }
    const sesion: Sesion = {
      proceso,
      historial: '',
      reciente: '',
      ultimaSalida: Date.now(),
      inicio: Date.now(),
      pausada: false,
      pegadoEntreCorchetes: false
    }
    this.sesiones.set(id, sesion)

    proceso.onData((data) => {
      if (data.includes('\x1b[?2004h')) sesion.pegadoEntreCorchetes = true
      if (data.includes('\x1b[?2004l')) sesion.pegadoEntreCorchetes = false
      sesion.ultimaSalida = Date.now()
      sesion.historial = (sesion.historial + data).slice(-MAX_HISTORIAL)
      sesion.reciente = (sesion.reciente + data.replace(ANSI, '')).slice(-MAX_TEXTO_RECIENTE)
      this.emit('salida', id, data)
    })
    proceso.onExit(({ exitCode }) => {
      if (this.sesiones.get(id)?.proceso !== proceso) return
      this.sesiones.delete(id)
      this.emit('salio', id, exitCode)
    })
    return null
  }

  detener(id: string): void {
    const s = this.sesiones.get(id)
    if (!s) return
    if (s.pausada) this.reanudar(id)
    s.proceso.kill()
  }

  detenerTodo(): void {
    for (const id of [...this.sesiones.keys()]) this.detener(id)
  }

  /** Congela el proceso (SIGSTOP). En Windows no hay equivalente. */
  pausar(id: string): boolean {
    const s = this.sesiones.get(id)
    if (!s || s.pausada || process.platform === 'win32') return false
    try {
      process.kill(s.proceso.pid, 'SIGSTOP')
      s.pausada = true
      return true
    } catch {
      return false
    }
  }

  reanudar(id: string): boolean {
    const s = this.sesiones.get(id)
    if (!s || !s.pausada) return false
    try {
      process.kill(s.proceso.pid, 'SIGCONT')
    } catch {
      // el proceso pudo haber muerto mientras estaba pausado
    }
    s.pausada = false
    return true
  }

  /** Escape: Claude Code corta el paso en curso sin cerrar la sesion. */
  interrumpir(id: string): void {
    this.sesiones.get(id)?.proceso.write('\x1b')
  }

  escribir(id: string, data: string): void {
    this.sesiones.get(id)?.proceso.write(data)
  }

  /** Teclea un prompt completo y lo envia, respetando saltos de linea si la TUI admite pegado. */
  escribirPrompt(id: string, texto: string): void {
    const s = this.sesiones.get(id)
    if (!s) return
    const cuerpo = s.pegadoEntreCorchetes ? `\x1b[200~${texto}\x1b[201~` : texto.replace(/\r?\n/g, ' ')
    s.proceso.write(cuerpo)
    // Enter por separado: si llega junto al texto, la TUI lo toma como parte del pegado.
    setTimeout(() => this.sesiones.get(id)?.proceso.write('\r'), 150)
  }

  redimensionar(id: string, cols: number, rows: number): void {
    if (cols > 0 && rows > 0) this.sesiones.get(id)?.proceso.resize(cols, rows)
  }
}
