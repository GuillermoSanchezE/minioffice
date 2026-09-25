import { useEffect, useRef, useState } from 'react'
import type { Agente } from '../../shared/types'
import { terminalDe } from '../terminales'
import { preferencia } from '../ui'
import { accion } from '../tienda'
import { Icono } from './basicos'

export function VistaTerminal({ agente }: { agente: Agente }): JSX.Element {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const [fuente, setFuente] = useState(() => preferencia(`fuente:${agente.id}`, 12))
  const activa = agente.rt.estado !== 'detenido' && agente.rt.estado !== 'error'

  useEffect(() => {
    const contenedor = contenedorRef.current
    if (!contenedor) return
    const term = terminalDe(agente.id)
    term.montar(contenedor)
    setFuente(term.terminal.options.fontSize ?? 12)
    const observador = new ResizeObserver(() => term.ajustar())
    observador.observe(contenedor)
    return () => {
      observador.disconnect()
      if (term.elemento.parentElement === contenedor) contenedor.removeChild(term.elemento)
    }
  }, [agente.id])

  return (
    <div className="vista-terminal">
      <div className="terminal-barra">
        <span className={`vivo ${activa ? 'vivo-on' : ''}`} />
        <span className="mono suave">
          {activa ? 'en vivo' : 'sin sesión'} · pty {agente.id}
          {agente.rt.sesionId ? ` · ${agente.rt.sesionId.slice(0, 8)}` : ''}
        </span>
        <span className="espaciador" />
        <div className="grupo-fuente">
          <button className="boton-mini" onClick={() => setFuente(terminalDe(agente.id).tamanoFuente(-1))} aria-label="Letra más pequeña">
            −
          </button>
          <span className="mono">{fuente}px</span>
          <button className="boton-mini" onClick={() => setFuente(terminalDe(agente.id).tamanoFuente(1))} aria-label="Letra más grande">
            +
          </button>
        </div>
      </div>
      <div className="terminal-contenedor" ref={contenedorRef} onClick={() => terminalDe(agente.id).terminal.focus()} />
      {!activa && (
        <div className="terminal-aviso">
          <p>
            {agente.nombre.split(' ')[0]} está {agente.rt.estado === 'error' ? 'con un error' : 'dormido'}. Inicia su sesión o mándale un
            mensaje: se despierta con él.
          </p>
          <button className="boton boton-oscuro" onClick={() => void accion({ tipo: 'agente:iniciar', id: agente.id })}>
            <Icono nombre="play" /> Iniciar sesión
          </button>
        </div>
      )}
    </div>
  )
}
