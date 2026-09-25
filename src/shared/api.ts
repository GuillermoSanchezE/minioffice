import type { AgentDefinition, AgentStatus, HiveMessage, PtyOutputPayload } from './types'

export type AgenteConEstado = AgentDefinition & { estado: AgentStatus }

export interface MiniofficeApi {
  listarAgentes(): Promise<AgenteConEstado[]>
  iniciarAgente(agentId: string): Promise<void>
  detenerAgente(agentId: string): Promise<void>
  enviarEntrada(agentId: string, data: string): void
  redimensionar(agentId: string, cols: number, rows: number): void
  onSalida(cb: (payload: PtyOutputPayload) => void): () => void
  onEstado(cb: (agentId: string, estado: AgentStatus) => void): () => void
  historialHive(): Promise<HiveMessage[]>
  onMensajeHive(cb: (msg: HiveMessage) => void): () => void
  asignarMichael(paraAgentId: string, texto: string): Promise<HiveMessage>
}
