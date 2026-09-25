export type AgentStatus = 'detenido' | 'iniciando' | 'inactivo' | 'trabajando' | 'esperando' | 'pausado' | 'error'

export type ProveedorId =
  | 'claude'
  | 'codex'
  | 'gemini'
  | 'grok'
  | 'kimi'
  | 'qwen'
  | 'opencode'
  | 'crush'
  | 'pi'
  | 'copilot'
  | 'personalizado'

/** Cuanto permiso tienen los agentes para actuar sin preguntar. */
export type ModoPermisos = 'manual' | 'auto' | 'ediciones' | 'total'

export interface AgentDefinition {
  id: string
  nombre: string
  rol: string
  personalidad?: string
  /** Id del reparto que define su aspecto (por defecto, el propio id). */
  personaje: string
  /** Color de acento, '#rrggbb'. */
  color: string
  proveedor: ProveedorId
  /** Valor para --model; vacio usa el predeterminado de la CLI. */
  modelo: string
  /** Linea de comando completa, solo para el proveedor personalizado. */
  comando?: string
  args: string[]
  cwd: string
  aislamientoGit?: boolean
  /** Id de sesion de Claude Code a continuar al iniciar. */
  reanudar?: string
  descripcion?: string
  objetivo?: string
  nota?: string
  limiteTokens?: number
  esCoordinador?: boolean
  /** Skills de la biblioteca de minioffice que se le cargan a su sesión (solo Claude Code). */
  skills?: string[]
}

export interface AgentRuntime {
  estado: AgentStatus
  herramienta?: string
  detalleHerramienta?: string
  llamadas: number
  /** Tokens procesados en la sesion (entrada + escritura de cache + salida). */
  tokens: number
  /** Tokens que ocupa ahora el contexto. */
  contexto: number
  ventana: number
  /** Costo estimado en USD a precio de API. */
  costo: number
  modeloReal?: string
  sesionId?: string
  /** Carpeta real donde corre (distinta de cwd si usa worktree). */
  cwdReal?: string
  pendientes: number
  limiteAlcanzado?: boolean
  ultimoTexto?: string
  inicio?: number
  ultimaActividad?: number
}

export interface Agente extends AgentDefinition {
  rt: AgentRuntime
}

export interface HiveMessage {
  id: string
  de: string
  para: string
  cuerpo: string
  creadoEn: number
}

export type EstadoTarea = 'pendiente' | 'en_curso' | 'bloqueada' | 'hecha'

export interface Tarea {
  id: string
  titulo: string
  descripcion: string
  estado: EstadoTarea
  dueno?: string
  creadaPor: string
  prioridad: 1 | 2 | 3
  creada: number
  actualizada: number
  archivada?: boolean
}

export interface Pregunta {
  id: string
  de: string
  pregunta: string
  opciones?: string[]
  creada: number
  respuesta?: string
  respondida?: number
}

export type TipoEvento = 'mensaje' | 'sesion' | 'contratacion' | 'archivo' | 'disparador' | 'pregunta' | 'tarea' | 'sistema' | 'temporal'

export interface EventoActividad {
  ts: number
  tipo: TipoEvento
  texto: string
  agente?: string
}

export interface Traza {
  id: string
  herramienta: string
  detalle: string
  ts: number
  estado: 'pendiente' | 'ok' | 'error'
}

export interface Horario {
  id: string
  nombre: string
  /** Cada cuantos minutos se dispara. */
  cadaMinutos: number
  para: string
  prompt: string
  activo: boolean
  ultimo?: number
}

export interface Companero {
  id: string
  nombre: string
  url: string
  clave: string
}

export interface ComandoGuardado {
  id: string
  nombre: string
  /** Id de un agente o 'todos'. */
  para: string
  texto: string
}

export interface Ajustes {
  modoPermisos: ModoPermisos
  comandos: ComandoGuardado[]
  michaelAlIniciar: boolean
  verNombres: boolean
  paseos: boolean
  horarios: Horario[]
  compactarAuto: boolean
  compactarUmbral: number
  webhooks: boolean
  webhookPuerto: number
  webhookClave: string
  webhookRed: boolean
  companeros: Companero[]
  maxTemporales: number
  /** A qué se dedica la oficina; lo leen todos los agentes. */
  enfoque: string
}

export type EstadoTemporal = 'corriendo' | 'hecho' | 'error' | 'cancelado'

export interface Temporal {
  id: string
  prompt: string
  cwd: string
  modelo: string
  estado: EstadoTemporal
  salida: string
  inicio: number
  fin?: number
  origen: string
}

export interface EstadoGit {
  esRepo: boolean
  rama?: string
  cambios: string[]
  log: string[]
  diffstat: string
  error?: string
}

export interface PtyOutputPayload {
  agentId: string
  data: string
}

export interface Instantanea {
  version: string
  raiz: string
  agentes: Agente[]
  mensajes: HiveMessage[]
  tareas: Tarea[]
  preguntas: Pregunta[]
  actividad: EventoActividad[]
  ajustes: Ajustes
  temporales: Temporal[]
}

export type Dominio = Exclude<keyof Instantanea, 'version' | 'raiz'>

export type Parche = { [D in Dominio]: { dominio: D; datos: Instantanea[D] } }[Dominio]
