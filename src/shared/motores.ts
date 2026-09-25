import type { AgentDefinition, ModoPermisos, ProveedorId } from './types'

export interface ModeloClaude {
  id: string
  nombre: string
  ventana: number
}

/** Modelos de Claude para Claude Code. El sufijo [1m] pide la ventana de 1M tokens. */
export const MODELOS_CLAUDE: ModeloClaude[] = [
  { id: '', nombre: 'Predeterminado', ventana: 200_000 },
  { id: 'claude-fable-5-1', nombre: 'Fable 5.1', ventana: 1_000_000 },
  { id: 'claude-fable-5', nombre: 'Fable 5', ventana: 1_000_000 },
  { id: 'claude-opus-5-5', nombre: 'Opus 5.5', ventana: 1_000_000 },
  { id: 'claude-opus-5', nombre: 'Opus 5', ventana: 200_000 },
  { id: 'claude-opus-5[1m]', nombre: 'Opus 5 · 1M', ventana: 1_000_000 },
  { id: 'claude-opus-4-8', nombre: 'Opus 4.8', ventana: 200_000 },
  { id: 'claude-opus-4-8[1m]', nombre: 'Opus 4.8 · 1M', ventana: 1_000_000 },
  { id: 'claude-sonnet-5', nombre: 'Sonnet 5', ventana: 200_000 },
  { id: 'claude-sonnet-4-6', nombre: 'Sonnet 4.6', ventana: 200_000 },
  { id: 'claude-sonnet-4-6[1m]', nombre: 'Sonnet 4.6 · 1M', ventana: 1_000_000 },
  { id: 'claude-haiku-4-5', nombre: 'Haiku 4.5', ventana: 200_000 }
]

export interface Proveedor {
  id: ProveedorId
  nombre: string
  binario: string
  /** Paquete npm para instalarlo, si lo tiene. */
  instalar?: string
  /** Como se le pasa el modelo. */
  argsModelo?: (modelo: string) => string[]
  /** Argumentos segun el modo de permisos. */
  argsPermisos?: Partial<Record<ModoPermisos, string[]>>
  /** Solo Claude Code recibe instrucciones por system prompt y se sigue por su transcripcion. */
  integracionCompleta: boolean
}

export const PROVEEDORES: Proveedor[] = [
  {
    id: 'claude',
    nombre: 'Claude Code',
    binario: 'claude',
    instalar: '@anthropic-ai/claude-code',
    argsModelo: (m) => ['--model', m],
    argsPermisos: {
      auto: ['--permission-mode', 'auto'],
      ediciones: ['--permission-mode', 'acceptEdits'],
      total: ['--permission-mode', 'bypassPermissions']
    },
    integracionCompleta: true
  },
  {
    id: 'codex',
    nombre: 'Codex · GPT',
    binario: 'codex',
    instalar: '@openai/codex',
    argsModelo: (m) => ['--model', m],
    argsPermisos: { auto: ['--full-auto'], ediciones: ['--full-auto'], total: ['--dangerously-bypass-approvals-and-sandbox'] },
    integracionCompleta: false
  },
  {
    id: 'gemini',
    nombre: 'Gemini CLI',
    binario: 'gemini',
    instalar: '@google/gemini-cli',
    argsModelo: (m) => ['--model', m],
    argsPermisos: { auto: ['--yolo'], total: ['--yolo'] },
    integracionCompleta: false
  },
  { id: 'grok', nombre: 'Grok · xAI', binario: 'grok', argsModelo: (m) => ['--model', m], integracionCompleta: false },
  { id: 'kimi', nombre: 'Kimi Code', binario: 'kimi', integracionCompleta: false },
  {
    id: 'qwen',
    nombre: 'Qwen Code',
    binario: 'qwen',
    instalar: '@qwen-code/qwen-code',
    argsModelo: (m) => ['--model', m],
    argsPermisos: { auto: ['--yolo'], total: ['--yolo'] },
    integracionCompleta: false
  },
  { id: 'opencode', nombre: 'OpenCode', binario: 'opencode', instalar: 'opencode-ai', argsModelo: (m) => ['--model', m], integracionCompleta: false },
  { id: 'crush', nombre: 'Crush · Charm', binario: 'crush', argsPermisos: { total: ['--yolo'] }, integracionCompleta: false },
  { id: 'pi', nombre: 'Pi', binario: 'pi', argsModelo: (m) => ['--model', m], integracionCompleta: false },
  {
    id: 'copilot',
    nombre: 'Copilot',
    binario: 'copilot',
    instalar: '@github/copilot',
    argsModelo: (m) => ['--model', m],
    argsPermisos: { auto: ['--allow-all-tools'], total: ['--allow-all-tools'] },
    integracionCompleta: false
  },
  { id: 'personalizado', nombre: 'Personalizado', binario: '', integracionCompleta: false }
]

export function proveedorDe(id: ProveedorId): Proveedor {
  return PROVEEDORES.find((p) => p.id === id) ?? PROVEEDORES[0]
}

export const MODOS_PERMISOS: Array<{ id: ModoPermisos; nombre: string; detalle: string }> = [
  { id: 'manual', nombre: 'Manual', detalle: 'Cada agente te pide permiso en su terminal.' },
  { id: 'auto', nombre: 'Auto', detalle: 'Claude Code aprueba lo seguro y pregunta lo delicado.' },
  { id: 'ediciones', nombre: 'Aceptar ediciones', detalle: 'Edita archivos sin preguntar; pide permiso para comandos.' },
  { id: 'total', nombre: 'Sin permisos', detalle: 'Hace todo sin preguntar. Úsalo solo en carpetas desechables.' }
]

/** Divide una linea de comando respetando comillas simples y dobles. */
export function partirComando(linea: string): string[] {
  const partes: string[] = []
  let actual = ''
  let comilla: string | null = null
  let hay = false
  for (const letra of linea) {
    if (comilla) {
      if (letra === comilla) comilla = null
      else actual += letra
    } else if (letra === '"' || letra === "'") {
      comilla = letra
      hay = true
    } else if (/\s/.test(letra)) {
      if (hay || actual) partes.push(actual)
      actual = ''
      hay = false
    } else {
      actual += letra
    }
  }
  if (hay || actual) partes.push(actual)
  return partes
}

function citar(arg: string): string {
  return /^[\w@%+=:,./[\]-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '\\"')}"`
}

export function unirComando(partes: string[]): string {
  return partes.map(citar).join(' ')
}

/** Comando base del agente (sin las instrucciones de minioffice), como se ve en el asistente. */
export function comandoBase(agente: Pick<AgentDefinition, 'proveedor' | 'modelo' | 'comando' | 'args'>, modo: ModoPermisos): string[] {
  if (agente.proveedor === 'personalizado') return [...partirComando(agente.comando ?? ''), ...agente.args]
  const p = proveedorDe(agente.proveedor)
  const partes = [p.binario]
  if (agente.modelo && p.argsModelo) partes.push(...p.argsModelo(agente.modelo))
  partes.push(...(p.argsPermisos?.[modo] ?? []))
  partes.push(...agente.args)
  return partes
}

export function ventanaDe(modelo: string | undefined): number {
  if (!modelo) return 200_000
  if (modelo.includes('[1m]') || modelo.includes('fable')) return 1_000_000
  return MODELOS_CLAUDE.find((m) => m.id === modelo)?.ventana ?? 200_000
}

interface Precio {
  entrada: number
  salida: number
  lecturaCache?: number
}

/** Precios de API por millon de tokens, para estimar costo. */
const PRECIOS: Array<[string, Precio]> = [
  ['fable-5-1', { entrada: 10, salida: 50, lecturaCache: 0.25 }],
  ['fable', { entrada: 10, salida: 50 }],
  ['mythos', { entrada: 10, salida: 50 }],
  ['opus-5-5', { entrada: 4, salida: 20, lecturaCache: 0.2 }],
  ['opus', { entrada: 5, salida: 25 }],
  ['sonnet-5', { entrada: 2, salida: 10 }],
  ['sonnet', { entrada: 3, salida: 15 }],
  ['haiku', { entrada: 1, salida: 5 }]
]

export interface Uso {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export function costoDe(modelo: string | undefined, uso: Uso): number {
  const precio = PRECIOS.find(([clave]) => (modelo ?? '').includes(clave))?.[1] ?? PRECIOS[4][1]
  const millon = 1_000_000
  const entrada = uso.input_tokens ?? 0
  const escritura = uso.cache_creation_input_tokens ?? 0
  const lectura = uso.cache_read_input_tokens ?? 0
  const salida = uso.output_tokens ?? 0
  return (
    (entrada * precio.entrada +
      escritura * precio.entrada * 1.25 +
      lectura * (precio.lecturaCache ?? precio.entrada * 0.1) +
      salida * precio.salida) /
    millon
  )
}
