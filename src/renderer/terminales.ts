import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

/**
 * Una terminal xterm por agente, viva durante toda la sesion de la app. Asi
 * al cambiar de agente no se pierde el historial ni el estado de la pantalla:
 * el panel solo mueve el elemento de una terminal a otra en el DOM.
 */
interface TerminalAgente {
  terminal: Terminal
  elemento: HTMLDivElement
  montar(contenedor: HTMLElement): void
  ajustar(): void
}

const registro = new Map<string, TerminalAgente>()
let suscrito = false

const TEMA = {
  background: '#11141b',
  foreground: '#d7dce5',
  cursor: '#34d399',
  selectionBackground: '#34507a'
}

function crear(agentId: string): TerminalAgente {
  const terminal = new Terminal({
    fontFamily: 'ui-monospace, "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace',
    fontSize: 13,
    cursorBlink: true,
    scrollback: 5000,
    theme: TEMA
  })
  const fit = new FitAddon()
  terminal.loadAddon(fit)
  terminal.onData((data) => window.minioffice.enviarEntrada(agentId, data))

  const elemento = document.createElement('div')
  elemento.className = 'terminal-xterm'
  let abierta = false

  const ajustar = (): void => {
    if (!elemento.isConnected || elemento.clientWidth === 0 || elemento.clientHeight === 0) return
    fit.fit()
    window.minioffice.redimensionar(agentId, terminal.cols, terminal.rows)
  }

  return {
    terminal,
    elemento,
    ajustar,
    montar(contenedor) {
      contenedor.appendChild(elemento)
      // xterm necesita medir fuentes en un elemento visible, por eso se abre
      // recien la primera vez que se monta; lo escrito antes queda en el buffer.
      if (!abierta) {
        terminal.open(elemento)
        abierta = true
      }
      ajustar()
    }
  }
}

export function terminalDe(agentId: string): TerminalAgente {
  if (!suscrito) {
    suscrito = true
    window.minioffice.onSalida(({ agentId: id, data }) => terminalDe(id).terminal.write(data))
  }
  let entrada = registro.get(agentId)
  if (!entrada) {
    entrada = crear(agentId)
    registro.set(agentId, entrada)
  }
  return entrada
}
