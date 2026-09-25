import { useEffect, useRef } from 'react'
import type { AgenteConEstado } from '../../shared/api'
import { terminalDe } from '../terminales'
import { ETIQUETA_ESTADO } from '../colores'

interface Props {
  agente: AgenteConEstado
}

export function PanelTerminal({ agente }: Props): JSX.Element {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const activo = agente.estado !== 'detenido' && agente.estado !== 'error'

  useEffect(() => {
    const contenedor = contenedorRef.current
    if (!contenedor) return
    const term = terminalDe(agente.id)
    term.montar(contenedor)
    term.terminal.focus()

    const observador = new ResizeObserver(() => term.ajustar())
    observador.observe(contenedor)
    return () => {
      observador.disconnect()
      if (term.elemento.parentElement === contenedor) contenedor.removeChild(term.elemento)
    }
  }, [agente.id])

  return (
    <section className="panel panel-terminal">
      <header className="panel-cabecera">
        <div>
          <h2>Terminal de {agente.nombre}</h2>
          <span className="texto-suave">
            {agente.rol} · {ETIQUETA_ESTADO[agente.estado]}
          </span>
        </div>
        {activo ? (
          <button className="boton boton-peligro" onClick={() => window.minioffice.detenerAgente(agente.id)}>
            Detener
          </button>
        ) : (
          <button className="boton boton-primario" onClick={() => window.minioffice.iniciarAgente(agente.id)}>
            Iniciar sesión
          </button>
        )}
      </header>
      <div className="terminal-contenedor" ref={contenedorRef} />
      {!activo && (
        <p className="terminal-aviso">
          {agente.nombre} está en la sala de descanso. Inicia su sesión o asígnale una tarea desde el chat con
          Michael.
        </p>
      )}
    </section>
  )
}
