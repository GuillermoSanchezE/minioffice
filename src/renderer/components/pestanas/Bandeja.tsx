import { useEffect, useMemo, useRef, useState } from 'react'
import { intentar, useAgentes, useOficina } from '../../tienda'
import { fecha } from '../../formato'
import { Icono, Retrato, Vacio } from '../basicos'
import { BotonDictado } from '../BotonDictado'
import { juntarTexto } from '../../dictado/voz'

export function PestanaBandeja(): JSX.Element {
  const mensajes = useOficina((e) => e.mensajes) ?? []
  const agentes = useAgentes()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<string | null>(null)
  const [para, setPara] = useState('michael')
  const [texto, setTexto] = useState('')
  const lista = useRef<HTMLDivElement>(null)

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return mensajes.filter(
      (m) => (!filtro || m.de === filtro || m.para === filtro) && (!q || m.cuerpo.toLowerCase().includes(q))
    )
  }, [mensajes, busqueda, filtro])

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight })
  }, [visibles.length])

  const agente = (id: string): (typeof agentes)[number] | undefined => agentes.find((a) => a.id === id)
  const nombre = (id: string): string => (id === 'usuario' ? 'Tú' : (agente(id)?.nombre ?? id))

  async function enviar(): Promise<void> {
    if (!texto.trim()) return
    if (await intentar({ tipo: 'agente:enviar', id: para, texto, modo: 'cola' })) setTexto('')
  }

  return (
    <div className="pestana-contenido bandeja">
      <div className="barra-herramientas">
        <strong className="pixel">Todos los mensajes</strong>
        <span className="suave pequeno">cada mensaje entre agentes, contigo y de fuera</span>
        <span className="espaciador" />
        <div className="buscador">
          <Icono nombre="buscar" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar mensajes" />
        </div>
      </div>
      <div className="chips">
        <button className={`chip ${!filtro ? 'activo' : ''}`} onClick={() => setFiltro(null)}>
          Todos
        </button>
        <button className={`chip ${filtro === 'usuario' ? 'activo' : ''}`} onClick={() => setFiltro(filtro === 'usuario' ? null : 'usuario')}>
          Contigo
        </button>
        {agentes.map((a) => (
          <button key={a.id} className={`chip ${filtro === a.id ? 'activo' : ''}`} onClick={() => setFiltro(filtro === a.id ? null : a.id)}>
            {a.nombre.split(' ')[0]}
          </button>
        ))}
      </div>
      <div className="lista-mensajes crece" ref={lista}>
        {visibles.length === 0 ? (
          <Vacio>Todavía no hay mensajes entre agentes.</Vacio>
        ) : (
          visibles.map((m) => {
            const a = agente(m.de)
            return (
              <article key={m.id} className={`mensaje ${m.de === 'usuario' ? 'mensaje-usuario' : ''}`}>
                <div className="mensaje-meta">
                  {a && <Retrato personaje={a.personaje} tamano={20} />}
                  <strong>{nombre(m.de)}</strong>
                  <span className="suave">→ {nombre(m.para)}</span>
                  <time className="suave">{fecha(m.creadoEn)}</time>
                </div>
                <p>{m.cuerpo}</p>
              </article>
            )
          })
        )}
      </div>
      <div className="redactar">
        <select value={para} onChange={(e) => setPara(e.target.value)} aria-label="Para">
          {agentes.map((a) => (
            <option key={a.id} value={a.id}>
              Para: {a.nombre}
              {a.esCoordinador ? ' (lo reparte)' : ''}
            </option>
          ))}
        </select>
        <textarea
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void enviar()
            }
          }}
          placeholder="Escribe un mensaje…"
        />
        <div className="redactar-botones">
          <BotonDictado alTexto={(t) => setTexto((x) => juntarTexto(x, t))} />
          <button className="boton boton-primario" disabled={!texto.trim()} onClick={() => void enviar()}>
            enviar <Icono nombre="enviar" />
          </button>
        </div>
      </div>
    </div>
  )
}
