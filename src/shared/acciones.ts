import type { AjustesDictado, EstadoDictado, ModeloDictado, PermisoMicrofono } from './dictado'
import type { AreaSkill, FuenteSkill } from './skills'
import type {
  AgentDefinition,
  Ajustes,
  EstadoGit,
  HiveMessage,
  HoraConsumo,
  ProveedorId,
  Tarea,
  Temporal,
  Traza
} from './types'

export interface ResultadoMemoria {
  tipo: 'memoria' | 'pizarra' | 'mensaje' | 'tarea'
  agente?: string
  titulo: string
  fragmento: string
  puntaje: number
  ts?: number
}

export interface Capacidad {
  tipo: 'skill' | 'mcp' | 'motor'
  nombre: string
  descripcion: string
  origen: string
  /** Ids de agentes que la tienen disponible. */
  agentes: string[]
  instalada: boolean
}

export interface CatalogoItem {
  tipo: 'skill' | 'mcp' | 'motor'
  nombre: string
  descripcion: string
  autor: string
  categoria: string
  instalada: boolean
  comando: string
}

export interface SkillOficina {
  nombre: string
  /** De dónde viene: una fuente del catálogo, 'propia' (otra en la biblioteca) o 'global' (~/.claude/skills). */
  fuente: FuenteSkill | 'propia' | 'global'
  area: AreaSkill
  /** Para qué sirve, en español (vacío si aún no se ha explicado). */
  resumen: string
  /** Descripción original de su SKILL.md. */
  descripcion: string
  requiere?: string
  instalada: boolean
  /** Las globales las ven todos los agentes de Claude Code y no se asignan. */
  global: boolean
  /** Agentes que la tienen asignada. */
  agentes: string[]
  /** Agentes a los que se la sugerimos por su puesto. */
  sugeridaPara: string[]
}

export interface Captura {
  archivo: string
  ruta: string
  creada: number
  miniatura: string
}

/**
 * Todo lo que la interfaz le puede pedir al proceso principal. Cada accion
 * tiene su propio tipo de respuesta en `RespuestaDe`.
 */
export type Accion =
  | { tipo: 'agente:iniciar'; id: string }
  | { tipo: 'agente:detener'; id: string }
  | { tipo: 'agente:reiniciar'; id: string; continuar: boolean }
  | { tipo: 'agente:pausar'; id: string }
  | { tipo: 'agente:reanudar'; id: string }
  | { tipo: 'agente:interrumpir'; id: string }
  | { tipo: 'agente:enviar'; id: string; texto: string; modo: 'cola' | 'guiar' }
  | { tipo: 'agente:guardar'; agente: AgentDefinition; iniciar: boolean; anteriorId?: string }
  | { tipo: 'agente:eliminar'; id: string }
  | { tipo: 'agente:nota'; id: string; nota: string }
  | { tipo: 'agente:limite'; id: string; limite: number | null }
  | { tipo: 'agente:motor'; id: string; proveedor: ProveedorId; modelo: string; reiniciar: boolean }
  | { tipo: 'agente:ide'; id: string }
  | { tipo: 'agente:abrir'; id: string }
  | { tipo: 'agente:git'; id: string }
  | { tipo: 'agente:trazas'; id: string }
  | { tipo: 'agente:mensajes'; id: string }
  | { tipo: 'agente:comando'; id: string }
  | { tipo: 'terminal:historial'; id: string }
  | { tipo: 'equipo:iniciarTodos' }
  | { tipo: 'equipo:detenerTodos' }
  | { tipo: 'equipo:difundir'; texto: string; modo: 'cola' | 'guiar' }
  | { tipo: 'michael:despachar'; texto: string; dueno?: string }
  | { tipo: 'ajustes:guardar'; ajustes: Partial<Ajustes> }
  | { tipo: 'tarea:guardar'; tarea: Partial<Tarea> & { titulo: string } }
  | { tipo: 'tarea:eliminar'; id: string }
  | { tipo: 'pregunta:responder'; id: string; respuesta: string }
  | { tipo: 'pregunta:descartar'; id: string }
  | { tipo: 'horario:disparar'; id: string }
  | { tipo: 'memoria:buscar'; consulta: string; agentes: string[]; tipos: string[] }
  | { tipo: 'pizarra:leer' }
  | { tipo: 'pizarra:guardar'; texto: string }
  | { tipo: 'memoria:leer'; id: string }
  | { tipo: 'temporal:crear'; prompt: string; cwd: string; modelo: string }
  | { tipo: 'temporal:cancelar'; id: string }
  | { tipo: 'temporal:limpiar' }
  | { tipo: 'dialogo:carpeta'; inicial?: string }
  | { tipo: 'dialogo:archivos' }
  | { tipo: 'manifiesto:importar' }
  | { tipo: 'manifiesto:exportar'; agente: AgentDefinition }
  | { tipo: 'manifiesto:generar'; descripcion: string }
  | { tipo: 'proyectos' }
  | { tipo: 'capacidades:listar' }
  | { tipo: 'capacidades:catalogo' }
  | { tipo: 'capacidades:instalar'; nombre: string; tipoCapacidad: CatalogoItem['tipo'] }
  | { tipo: 'consumo:historial'; desde: number }
  | { tipo: 'skills:listar' }
  | { tipo: 'skills:instalar'; nombres: string[] }
  | { tipo: 'skills:desinstalar'; nombre: string }
  | { tipo: 'skills:asignar'; id: string; skills: string[] }
  | { tipo: 'skills:sugeridas'; agentes?: string[] }
  | { tipo: 'skills:explicar'; nombre: string }
  | { tipo: 'grapadora:captura'; enviarA?: string }
  | { tipo: 'grapadora:capturas' }
  | { tipo: 'grapadora:borrarCaptura'; archivo: string }
  | { tipo: 'grapadora:visible'; visible: boolean }
  | { tipo: 'grapadora:ajustes'; ajustes: AjustesGrapadora }
  | { tipo: 'grapadora:leerAjustes' }
  | { tipo: 'grapadora:mover'; dx: number; dy: number }
  | { tipo: 'grapadora:menu'; abierto: boolean }
  | { tipo: 'ventana:enfocar'; pestana?: string }
  | { tipo: 'proyecto:cambiar' }
  | { tipo: 'webhook:info' }
  | { tipo: 'dictado:estado' }
  | { tipo: 'dictado:ajustes'; ajustes: Partial<AjustesDictado> }
  | { tipo: 'dictado:borrar'; modelo: ModeloDictado }
  | { tipo: 'dictado:preparado'; modelo: ModeloDictado }
  | { tipo: 'dictado:permiso' }
  | { tipo: 'dictado:privacidad' }

export interface AjustesGrapadora {
  visible: boolean
  semilla: string
  forma: number
  expresion: number
  tamano: number
  color: string
  opacidad: number
  /** Acciones que aparecen en su menu, en orden. */
  acciones: AccionGrapadora[]
}

export type AccionGrapadora = 'captura' | 'captura-michael' | 'pedir' | 'abrir' | 'preguntas' | 'ocultar'

export interface InfoWebhook {
  activo: boolean
  urls: string[]
  clave: string
  puerto: number
}

export interface RespuestaDe {
  'agente:git': EstadoGit
  'agente:trazas': Traza[]
  'agente:mensajes': HiveMessage[]
  'agente:comando': string
  'terminal:historial': string
  'memoria:buscar': ResultadoMemoria[]
  'pizarra:leer': string
  'memoria:leer': string
  'temporal:crear': Temporal
  'dialogo:carpeta': string | null
  'dialogo:archivos': string[]
  'manifiesto:importar': AgentDefinition | null
  'manifiesto:exportar': string | null
  'manifiesto:generar': AgentDefinition
  proyectos: string[]
  'capacidades:listar': Capacidad[]
  'capacidades:catalogo': CatalogoItem[]
  'capacidades:instalar': string
  'consumo:historial': HoraConsumo[]
  'skills:listar': SkillOficina[]
  'skills:instalar': string
  'skills:sugeridas': string
  'skills:explicar': string
  'grapadora:captura': string | null
  'grapadora:capturas': Captura[]
  'grapadora:leerAjustes': AjustesGrapadora
  'webhook:info': InfoWebhook
  'dictado:estado': EstadoDictado
  'dictado:ajustes': EstadoDictado
  'dictado:borrar': EstadoDictado
  'dictado:permiso': PermisoMicrofono
}

export type Respuesta<A extends Accion> = A['tipo'] extends keyof RespuestaDe ? RespuestaDe[A['tipo']] : void
