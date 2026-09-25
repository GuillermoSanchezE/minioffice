import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { AgenteConEstado } from '../../shared/api'
import type { HiveMessage } from '../../shared/types'
import { resolverDestino } from '../michael'
import { aCss, colorDeAgente } from '../colores'

interface Props {
  agentes: AgenteConEstado[]
  mensajes: HiveMessage[]
}

const formatoHora = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

export function ChatMichael({ agentes, mensajes }: Props): JSX.Element {
  const trabajadores = useMemo(() => agentes.filter((a) => !a.esCoordinador), [agentes])
  const porId = useMemo(() => new Map(agentes.map((a) => [a.id, a])), [agentes])
  const [destino, setDestino] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  const destinoEfectivo = destino || trabajadores[0]?.id || ''

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [mensajes.length])

  async function enviar(evento?: FormEvent): Promise<void> {
    evento?.preventDefault()
    const limpio = texto.trim()
    if (!limpio || enviando) return
    const { para, cuerpo } = resolverDestino(limpio, trabajadores, destinoEfectivo)
    if (!para || !cuerpo) return

    setEnviando(true)
    setError(null)
    try {
      await window.minioffice.asignarMichael(para, cuerpo)
      setTexto('')
    } catch {
      setError('Michael no pudo entregar el mensaje. Revisa que el agente exista.')
    } finally {
      setEnviando(false)
    }
  }

  function alPresionarTecla(evento: KeyboardEvent<HTMLTextAreaElement>): void {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault()
      void enviar()
    }
  }

  const nombreDe = (id: string): string => porId.get(id)?.nombre ?? id

  return (
    <section className="panel panel-chat">
      <header className="panel-cabecera">
        <div>
          <h2>Habla con Michael</h2>
          <span className="texto-suave">
            Michael reparte tus tareas. Escribe <code>@nombre</code> para elegir a quién va.
          </span>
        </div>
      </header>

      <div className="chat-feed" ref={feedRef}>
        {mensajes.length === 0 ? (
          <p className="chat-vacio">
            Todavía no hay mensajes. Pídele algo a Michael, por ejemplo: “@Ana revisa el README y propón mejoras”.
          </p>
        ) : (
          mensajes.map((msg) => (
            <article key={msg.id} className={`mensaje ${msg.de === 'michael' ? 'mensaje-michael' : ''}`}>
              <span
                className="mensaje-avatar"
                style={{ background: aCss(colorDeAgente(msg.de, porId.get(msg.de)?.esCoordinador)) }}
              >
                {nombreDe(msg.de).charAt(0).toUpperCase()}
              </span>
              <div className="mensaje-contenido">
                <div className="mensaje-meta">
                  <strong>{nombreDe(msg.de)}</strong>
                  <span className="texto-suave">→ {nombreDe(msg.para)}</span>
                  <time className="texto-suave">{formatoHora.format(msg.creadoEn)}</time>
                </div>
                <p>{msg.cuerpo}</p>
              </div>
            </article>
          ))
        )}
      </div>

      <form className="chat-formulario" onSubmit={enviar}>
        <select
          value={destinoEfectivo}
          onChange={(e) => setDestino(e.target.value)}
          aria-label="Asignar a"
          disabled={trabajadores.length === 0}
        >
          {trabajadores.map((a) => (
            <option key={a.id} value={a.id}>
              Para {a.nombre}
            </option>
          ))}
        </select>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={alPresionarTecla}
          placeholder="Escribe una tarea… (Enter envía, Shift+Enter salto de línea)"
          rows={2}
        />
        <button className="boton boton-primario" type="submit" disabled={enviando || !texto.trim()}>
          {enviando ? 'Enviando…' : 'Asignar'}
        </button>
      </form>
      {error && <p className="chat-error">{error}</p>}
    </section>
  )
}
