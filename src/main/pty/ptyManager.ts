import * as pty from 'node-pty'
import { EventEmitter } from 'node:events'
import type { AgentDefinition, AgentStatus } from '../../shared/types'

interface SesionAgente {
  proceso: pty.IPty
  estado: AgentStatus
  temporizadorInactivo?: NodeJS.Timeout
  pegadoEntreCorchetes: boolean
}

const MS_HASTA_INACTIVO = 2500
const SHELL_POR_DEFECTO = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL ?? 'bash')

/**
 * Eventos: 'salida' (agentId, data) y 'estado' (agentId, AgentStatus).
 */
export class PtyManager extends EventEmitter {
  private sesiones = new Map<string, SesionAgente>()

  estaActivo(agentId: string): boolean {
    return this.sesiones.has(agentId)
  }

  estadoDe(agentId: string): AgentStatus {
    return this.sesiones.get(agentId)?.estado ?? 'detenido'
  }

  iniciar(agente: AgentDefinition, argsExtra: string[] = []): void {
    if (this.sesiones.has(agente.id) || agente.esCoordinador) return

    const comando = agente.comando || SHELL_POR_DEFECTO
    // Cada agente es una sesion independiente; si minioffice se lanzo desde una
    // terminal de Claude Code, esta variable haria que claude se niegue a arrancar.
    const entorno = { ...process.env }
    delete entorno.CLAUDECODE
    let proceso: pty.IPty
    try {
      proceso = pty.spawn(comando, [...agente.args, ...argsExtra], {
        name: 'xterm-256color',
        cols: 100,
        rows: 30,
        cwd: agente.cwd,
        env: { ...entorno, TERM: 'xterm-256color', COLORTERM: 'truecolor' } as Record<string, string>
      })
    } catch (err) {
      this.emit('estado', agente.id, 'error' satisfies AgentStatus)
      this.emit('salida', agente.id, `\r\n[minioffice] No se pudo iniciar "${comando}": ${(err as Error).message}\r\n`)
      return
    }

    const sesion: SesionAgente = { proceso, estado: 'iniciando', pegadoEntreCorchetes: false }
    this.sesiones.set(agente.id, sesion)
    this.emit('estado', agente.id, 'iniciando' satisfies AgentStatus)

    proceso.onData((data) => {
      if (data.includes('\x1b[?2004h')) sesion.pegadoEntreCorchetes = true
      if (data.includes('\x1b[?2004l')) sesion.pegadoEntreCorchetes = false
      this.marcarActividad(agente.id)
      this.emit('salida', agente.id, data)
    })

    proceso.onExit(({ exitCode }) => {
      // Si el agente ya se reinicio, este onExit pertenece al proceso viejo.
      if (this.sesiones.get(agente.id)?.proceso !== proceso) return
      this.limpiar(agente.id)
      this.emit('salida', agente.id, `\r\n[minioffice] El proceso termino (codigo ${exitCode}).\r\n`)
    })
  }

  detener(agentId: string): void {
    const sesion = this.sesiones.get(agentId)
    if (!sesion) return
    this.limpiar(agentId)
    sesion.proceso.kill()
  }

  enviarEntrada(agentId: string, data: string): void {
    this.sesiones.get(agentId)?.proceso.write(data)
  }

  /** Teclea un prompt completo y lo envia, respetando saltos de linea si la TUI admite pegado. */
  escribirPrompt(agentId: string, texto: string): void {
    const sesion = this.sesiones.get(agentId)
    if (!sesion) return
    const cuerpo = sesion.pegadoEntreCorchetes ? `\x1b[200~${texto}\x1b[201~` : texto.replace(/\r?\n/g, ' ')
    sesion.proceso.write(cuerpo)
    // Enter por separado: si llega junto al texto, la TUI lo toma como parte del pegado.
    setTimeout(() => this.sesiones.get(agentId)?.proceso.write('\r'), 150)
  }

  redimensionar(agentId: string, cols: number, rows: number): void {
    if (cols > 0 && rows > 0) this.sesiones.get(agentId)?.proceso.resize(cols, rows)
  }

  detenerTodo(): void {
    for (const id of [...this.sesiones.keys()]) this.detener(id)
  }

  private marcarActividad(agentId: string): void {
    const sesion = this.sesiones.get(agentId)
    if (!sesion) return
    if (sesion.estado !== 'trabajando') this.cambiarEstado(agentId, 'trabajando')
    if (sesion.temporizadorInactivo) clearTimeout(sesion.temporizadorInactivo)
    sesion.temporizadorInactivo = setTimeout(() => this.cambiarEstado(agentId, 'inactivo'), MS_HASTA_INACTIVO)
  }

  private cambiarEstado(agentId: string, estado: AgentStatus): void {
    const sesion = this.sesiones.get(agentId)
    if (!sesion) return
    sesion.estado = estado
    this.emit('estado', agentId, estado)
  }

  private limpiar(agentId: string): void {
    const sesion = this.sesiones.get(agentId)
    if (sesion?.temporizadorInactivo) clearTimeout(sesion.temporizadorInactivo)
    this.sesiones.delete(agentId)
    this.emit('estado', agentId, 'detenido' satisfies AgentStatus)
  }
}
