export type AgentStatus = 'detenido' | 'iniciando' | 'inactivo' | 'trabajando' | 'esperando' | 'pausado' | 'error'

export interface AgentDefinition {
  id: string
  nombre: string
  rol: string
  personalidad?: string
  comando: string
  args: string[]
  cwd: string
  esCoordinador?: boolean
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
