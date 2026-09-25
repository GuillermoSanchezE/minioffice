import type { Accion, Respuesta } from './acciones'
import type { Instantanea, Parche, PtyOutputPayload } from './types'

export interface MiniofficeApi {
  estadoInicial(): Promise<Instantanea>
  onParche(cb: (parche: Parche) => void): () => void
  accion<A extends Accion>(accion: A): Promise<Respuesta<A>>
  enviarEntrada(agentId: string, data: string): void
  redimensionar(agentId: string, cols: number, rows: number): void
  onSalida(cb: (payload: PtyOutputPayload) => void): () => void
  onSobre(cb: (de: string, para: string) => void): () => void
  /** El proceso principal pide mostrar una pestaña (p. ej. desde la grapadora). */
  onNavegar(cb: (pestana: string) => void): () => void
}
