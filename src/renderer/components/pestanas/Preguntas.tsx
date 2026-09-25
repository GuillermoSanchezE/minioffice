import { useState } from 'react'
import type { Pregunta } from '../../../shared/types'
import { accion, intentar, useAgentes, useOficina } from '../../tienda'
import { hace } from '../../formato'
import { Retrato, Vacio } from '../basicos'

export function PestanaPreguntas(): JSX.Element {
  const preguntas = useOficina((e) => e.preguntas) ?? []
  const abiertas = preguntas.filter((p) => !p.respuesta)
  const respondidas = preguntas.filter((p) => p.respuesta).slice(0, 20)

  return (
    <div className="pestana-contenido">
      <p className="suave">
        Lo que los agentes necesitan que decidas tú. Te preguntan escribiendo a <code>"para": "usuario"</code>; tu respuesta les llega como
        mensaje.
      </p>
      {abiertas.length === 0 ? (
        <Vacio>Nadie te está esperando. 🙂</Vacio>
      ) : (
        abiertas.map((p) => <TarjetaPregunta key={p.id} pregunta={p} />)
      )}
      {respondidas.length > 0 && (
        <>
          <h3 className="pixel">Respondidas</h3>
          {respondidas.map((p) => (
            <TarjetaPregunta key={p.id} pregunta={p} />
          ))}
        </>
      )}
    </div>
  )
}

function TarjetaPregunta({ pregunta }: { pregunta: Pregunta }): JSX.Element {
  const agentes = useAgentes()
  const de = agentes.find((a) => a.id === pregunta.de)
  const [respuesta, setRespuesta] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function responder(texto: string): Promise<void> {
    if (!texto.trim()) return
    setEnviando(true)
    if (await intentar({ tipo: 'pregunta:responder', id: pregunta.id, respuesta: texto })) setRespuesta('')
    setEnviando(false)
  }

  return (
    <article className={`tarjeta-pregunta ${pregunta.respuesta ? 'respondida' : ''}`}>
      <div className="fila">
        {de && <Retrato personaje={de.personaje} tamano={28} />}
        <strong>{de?.nombre ?? pregunta.de}</strong>
        <span className="suave pequeno">{hace(pregunta.creada)}</span>
        <span className="espaciador" />
        <button className="boton-mini" onClick={() => void accion({ tipo: 'pregunta:descartar', id: pregunta.id })}>
          descartar
        </button>
      </div>
      <p className="pregunta-texto">{pregunta.pregunta}</p>
      {pregunta.respuesta ? (
        <p className="respuesta">
          <strong>Tu respuesta:</strong> {pregunta.respuesta}
        </p>
      ) : (
        <>
          {pregunta.opciones && (
            <div className="chips">
              {pregunta.opciones.map((o) => (
                <button key={o} className="chip" disabled={enviando} onClick={() => void responder(o)}>
                  {o}
                </button>
              ))}
            </div>
          )}
          <div className="fila">
            <input
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void responder(respuesta)}
              placeholder="Tu respuesta…"
            />
            <button className="boton boton-oscuro" disabled={enviando || !respuesta.trim()} onClick={() => void responder(respuesta)}>
              responder
            </button>
          </div>
        </>
      )}
    </article>
  )
}
