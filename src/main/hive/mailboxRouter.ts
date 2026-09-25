import { EventEmitter } from 'node:events'
import type { AgentDefinition, HiveMessage } from '../../shared/types'
import type { HiveStore } from './hiveStore'

const INTERVALO_MS = 500

/**
 * Revisa la bandeja de salida de cada agente y entrega los mensajes en la
 * bandeja de entrada del destinatario. Es el unico que mueve mensajes entre
 * buzones y el unico que hace commit, asi no hay carreras en el hive.
 * Evento: 'mensaje' (HiveMessage) por cada entrega.
 */
export class MailboxRouter extends EventEmitter {
  private temporizador: NodeJS.Timeout | null = null
  private revisando = false

  constructor(
    private hive: HiveStore,
    private agentes: AgentDefinition[]
  ) {
    super()
  }

  iniciar(): void {
    if (this.temporizador) return
    this.temporizador = setInterval(() => void this.revisar(), INTERVALO_MS)
  }

  detener(): void {
    if (this.temporizador) clearInterval(this.temporizador)
    this.temporizador = null
  }

  private async revisar(): Promise<void> {
    // El commit es asincrono; sin este candado dos ciclos podrian solaparse.
    if (this.revisando) return
    this.revisando = true
    try {
      let entregados = 0
      for (const agente of this.agentes) {
        for (const pendiente of this.hive.listarPendientesDeEnvio(agente.id)) {
          this.hive.entregar(pendiente)
          this.emit('mensaje', pendiente.mensaje satisfies HiveMessage)
          entregados++
        }
      }
      if (entregados > 0) await this.hive.commit(`Entregar ${entregados} mensaje(s)`)
    } catch (err) {
      console.error('Error en el router de buzones:', err)
    } finally {
      this.revisando = false
    }
  }
}
