import { useEffect, useState } from 'react'
import type { ConversacionClaude } from '../../shared/types'
import { accion, useAgentes } from '../tienda'
import { hace } from '../formato'

/**
 * Elegir una conversación de Claude Code de esa carpeta para que el agente la
 * retome (en vez de escribir su id). Solo sirve con Claude Code.
 */
export function SelectorConversacion({
  cwd,
  valor,
  agenteId,
  alCambiar
}: {
  cwd: string
  valor?: string
  agenteId?: string
  alCambiar: (id: string | undefined) => void
}): JSX.Element {
  const agentes = useAgentes()
  const [lista, setLista] = useState<ConversacionClaude[] | null>(null)
  const [manual, setManual] = useState(false)

  useEffect(() => {
    setLista(null)
    const t = setTimeout(() => {
      void accion({ tipo: 'claude:conversaciones', cwd }).then((l) => setLista(l ?? []))
    }, 300)
    return () => clearTimeout(t)
  }, [cwd])

  // Una conversación abierta por otro agente no se puede retomar a la vez.
  const enUso = (id: string): string | undefined =>
    agentes.find((a) => a.id !== agenteId && (a.rt.sesionId === id || a.reanudar === id))?.nombre.split(' ')[0]
  const conocida = !valor || !!lista?.some((c) => c.id === valor)

  return (
    <div className="formulario">
      <span className="etiqueta-campo">Retomar una conversación de Claude Code</span>
      <p className="suave pequeno">
        Si ya trabajaste en esta carpeta con Claude Code, el agente puede seguir esa conversación con todo su contexto. Solo funciona con el motor
        Claude Code.
      </p>
      {lista === null ? (
        <p className="suave pequeno">Buscando conversaciones…</p>
      ) : (
        <div className="lista-conversaciones">
          <label className={`opcion-conversacion ${!valor ? 'activa' : ''}`}>
            <input type="radio" name="conversacion" checked={!valor} onChange={() => alCambiar(undefined)} />
            <span>
              <strong>Empezar una conversación nueva</strong>
            </span>
          </label>
          {lista.map((c) => {
            const ocupada = enUso(c.id)
            return (
              <label key={c.id} className={`opcion-conversacion ${valor === c.id ? 'activa' : ''}`} title={c.primerPedido}>
                <input type="radio" name="conversacion" checked={valor === c.id} disabled={!!ocupada} onChange={() => alCambiar(c.id)} />
                <span className="crece" style={{ minWidth: 0 }}>
                  <strong className="recorte" style={{ display: 'block' }}>
                    {c.titulo}
                  </strong>
                  <span className="suave pequeno">
                    {hace(c.ultimo)}
                    {c.rama ? ` · rama ${c.rama}` : ''} · {c.megas} MB{c.deMinioffice ? ' · de minioffice' : ''}
                    {ocupada ? ` · la usa ${ocupada}` : ''}
                  </span>
                </span>
              </label>
            )
          })}
          {lista.length === 0 && <p className="suave pequeno">No hay conversaciones de Claude Code en esta carpeta.</p>}
        </div>
      )}
      {manual || !conocida ? (
        <label>
          Id de la conversación
          <input className="mono" value={valor ?? ''} onChange={(e) => alCambiar(e.target.value.trim() || undefined)} placeholder="id de sesión" />
        </label>
      ) : (
        <button className="boton-mini" style={{ alignSelf: 'flex-start' }} onClick={() => setManual(true)}>
          pegar un id
        </button>
      )}
    </div>
  )
}
