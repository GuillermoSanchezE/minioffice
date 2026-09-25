export type AgentStatus = 'detenido' | 'iniciando' | 'inactivo' | 'trabajando' | 'error'

export interface DeskPosition {
  x: number
  y: number
}

export interface AgentDefinition {
  id: string
  nombre: string
  rol: string
  comando: string
  args: string[]
  cwd: string
  escritorio: DeskPosition
  esCoordinador?: boolean
}

export interface AgentRuntimeState {
  id: string
  estado: AgentStatus
  ultimaActividad: number
}

export interface HiveMessage {
  id: string
  de: string
  para: string
  cuerpo: string
  creadoEn: number
}

export interface PtyOutputPayload {
  agentId: string
  data: string
}

export interface PtyExitPayload {
  agentId: string
  exitCode: number
}
