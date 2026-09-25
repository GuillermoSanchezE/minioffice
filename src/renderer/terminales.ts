import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { guardarPreferencia, preferencia } from './ui'

/**
 * Una terminal xterm por agente, creada la primera vez que se abre. Al crearse
 * pide el historial al proceso principal, asi se ve todo lo que el agente hizo
 * aunque su terminal no estuviera abierta. Despues sigue en vivo.
 */
export interface TerminalAgente {
  terminal: Terminal
  elemento: HTMLDivElement
  montar(contenedor: HTMLElement): void
  ajustar(): void
  tamanoFuente(delta: number): number
}

const registro = new Map<string, TerminalAgente>()
const cargando = new Set<string>()
let suscrito = false

const TEMA_OSCURO = {
  background: '#1f1a24',
  foreground: '#efe6d8',
  cursor: '#d9a441',
  cursorAccent: '#1f1a24',
  selectionBackground: '#4a3f5c',
  black: '#2a2230',
  brightBlack: '#6f6478'
}

/** Terminal crema como la del original; blancos oscurecidos para que se lean sobre fondo claro. */
const TEMA_CLARO = {
  background: '#fdf9f1',
  foreground: '#2b2530',
  cursor: '#c0504d',
  cursorAccent: '#fdf9f1',
  selectionBackground: '#ecd9ad',
  black: '#2b2530',
  red: '#b3413e',
  green: '#3f7f4e',
  yellow: '#946a12',
  blue: '#2f6690',
  magenta: '#8a3f7a',
  cyan: '#2f7a8a',
  white: '#6b6470',
  brightBlack: '#8a8190',
  brightRed: '#c0504d',
  brightGreen: '#4f9a5f',
  brightYellow: '#a87a1a',
  brightBlue: '#3b7bb0',
  brightMagenta: '#a0508f',
  brightCyan: '#3b93a6',
  brightWhite: '#3a3340'
}

let temaActual: 'claro' | 'oscuro' = 'claro'

function tema(): typeof TEMA_CLARO | typeof TEMA_OSCURO {
  return temaActual === 'claro' ? TEMA_CLARO : TEMA_OSCURO
}

export function temaTerminales(t: 'claro' | 'oscuro'): void {
  temaActual = t
  for (const { terminal } of registro.values()) terminal.options.theme = tema()
}

function crear(agentId: string): TerminalAgente {
  const terminal = new Terminal({
    fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
    fontSize: preferencia(`fuente:${agentId}`, 12),
    cursorBlink: true,
    scrollback: 8000,
    allowProposedApi: true,
    theme: tema()
  })
  const fit = new FitAddon()
  terminal.loadAddon(fit)
  terminal.onData((data) => window.minioffice.enviarEntrada(agentId, data))

  const elemento = document.createElement('div')
  elemento.className = 'terminal-xterm'
  let abierta = false

  const ajustar = (): void => {
    if (!elemento.isConnected || elemento.clientWidth === 0 || elemento.clientHeight === 0) return
    try {
      fit.fit()
      window.minioffice.redimensionar(agentId, terminal.cols, terminal.rows)
    } catch {
      // xterm aun no midio la fuente
    }
  }

  cargando.add(agentId)
  void window.minioffice.accion({ tipo: 'terminal:historial', id: agentId }).then((historial) => {
    if (historial) terminal.write(historial as string)
    cargando.delete(agentId)
  })

  return {
    terminal,
    elemento,
    ajustar,
    montar(contenedor) {
      contenedor.appendChild(elemento)
      if (!abierta) {
        terminal.open(elemento)
        abierta = true
      }
      requestAnimationFrame(ajustar)
    },
    tamanoFuente(delta) {
      const nuevo = Math.min(22, Math.max(9, (terminal.options.fontSize ?? 12) + delta))
      terminal.options.fontSize = nuevo
      guardarPreferencia(`fuente:${agentId}`, nuevo)
      requestAnimationFrame(ajustar)
      return nuevo
    }
  }
}

export function terminalDe(agentId: string): TerminalAgente {
  if (!suscrito) {
    suscrito = true
    window.minioffice.onSalida(({ agentId: id, data }) => {
      // Mientras llega el historial, lo que llegue en vivo ya viene incluido en el.
      if (cargando.has(id)) return
      registro.get(id)?.terminal.write(data)
    })
  }
  let entrada = registro.get(agentId)
  if (!entrada) {
    entrada = crear(agentId)
    registro.set(agentId, entrada)
  }
  return entrada
}
