import { useState } from 'react'
import type { Agente, ProveedorId } from '../../../shared/types'
import { MODELOS_CLAUDE, motoresVisibles } from '../../../shared/motores'
import { accion, intentar, useAgentes, useOficina } from '../../tienda'
import { seleccionar } from '../../ui'
import { dinero, tokens } from '../../formato'
import { Barra, ChipEstado, Retrato } from '../basicos'
import { BotonDictado } from '../BotonDictado'
import { juntarTexto } from '../../dictado/voz'

export function PestanaMonitor(): JSX.Element {
  const agentes = useAgentes()
  const [dueno, setDueno] = useState('')
  const [texto, setTexto] = useState('')
  const costo = agentes.reduce((s, a) => s + a.rt.costo, 0)

  async function despachar(): Promise<void> {
    if (!texto.trim()) return
    if (await intentar({ tipo: 'michael:despachar', texto, dueno: dueno || undefined })) setTexto('')
  }

  return (
    <div className="pestana-contenido">
      <section className="seccion">
        <h3 className="pixel">Despacho · vía Michael</h3>
        <div className="fila">
          <label className="pixel etiqueta-seccion" htmlFor="dueno">
            Dueño sugerido
          </label>
          <select id="dueno" value={dueno} onChange={(e) => setDueno(e.target.value)}>
            <option value="">Michael decide</option>
            {agentes
              .filter((a) => !a.esCoordinador)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
          </select>
        </div>
        <textarea
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Describe la tarea… (Michael la divide, escribe la tarjeta en el tablero y la asigna)"
        />
        <div className="fila">
          <BotonDictado alTexto={(t) => setTexto((x) => juntarTexto(x, t))} />
          <button className="boton boton-mostaza" onClick={() => void despachar()} disabled={!texto.trim()}>
            despachar
          </button>
        </div>
      </section>

      <section className="seccion">
        <div className="fila">
          <h3 className="pixel">Agentes</h3>
          <span className="espaciador" />
          <span className="suave pequeno">costo estimado de la sesión a precio de API: {dinero(costo)}</span>
        </div>
        {agentes.map((a) => (
          <FilaMonitor key={a.id} agente={a} />
        ))}
      </section>
    </div>
  )
}

function FilaMonitor({ agente }: { agente: Agente }): JSX.Element {
  const rt = agente.rt
  const [proveedor, setProveedor] = useState<ProveedorId>(agente.proveedor)
  const [modelo, setModelo] = useState(agente.modelo)
  const activos = useOficina((e) => e.ajustes.motores)
  const opciones = motoresVisibles(activos, agente.proveedor)
  const cambiado = proveedor !== agente.proveedor || modelo !== agente.modelo
  const activa = rt.estado !== 'detenido' && rt.estado !== 'error'
  const [editandoLimite, setEditandoLimite] = useState(false)
  const [valorLimite, setValorLimite] = useState('')

  function abrirLimite(): void {
    setValorLimite(agente.limiteTokens ? String(Math.round(agente.limiteTokens / 1000)) : '')
    setEditandoLimite(true)
  }

  async function guardarLimite(): Promise<void> {
    const n = Number(valorLimite.replace(/[^\d.]/g, ''))
    await accion({ tipo: 'agente:limite', id: agente.id, limite: valorLimite.trim() && n > 0 ? n * 1000 : null })
    setEditandoLimite(false)
  }

  return (
    <article className="tarjeta-monitor">
      <div className="fila">
        <button className="enlace-agente" onClick={() => seleccionar(agente.esCoordinador ? null : agente.id)}>
          <Retrato personaje={agente.personaje} tamano={24} />
          <strong>
            {agente.nombre}
            {agente.esCoordinador ? ' (jefe)' : ''}
          </strong>
        </button>
        <ChipEstado estado={rt.estado} />
        <span className="espaciador" />
        <span className="suave pequeno">{rt.llamadas} llamadas</span>
        {editandoLimite ? (
          <span className="fila-compacta">
            <input
              className="entrada-corta"
              autoFocus
              value={valorLimite}
              onChange={(e) => setValorLimite(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void guardarLimite()
                if (e.key === 'Escape') setEditandoLimite(false)
              }}
              placeholder="sin límite"
              aria-label="Límite en miles de tokens"
            />
            <span className="suave pequeno">k tokens</span>
            <button className="boton-mini" onClick={() => void guardarLimite()}>
              guardar
            </button>
          </span>
        ) : (
          <button className="boton-mini" onClick={abrirLimite}>
            {agente.limiteTokens ? `límite ${tokens(agente.limiteTokens)}` : 'poner límite'}
          </button>
        )}
      </div>
      <p className="suave mono pequeno ruta">{rt.cwdReal ?? agente.cwd}</p>
      <div className="metricas">
        <span className="etiqueta-herramienta mono">{rt.herramienta ?? '—'}</span>
        <span className="suave pequeno">presupuesto</span>
        <span className="mono pequeno">{tokens(rt.tokens)}</span>
        <Barra valor={rt.tokens} max={agente.limiteTokens ?? Math.max(rt.tokens, 1)} tono={agente.limiteTokens ? 'teal' : 'verde'} />
        <span className="mono pequeno">{agente.limiteTokens ? `${Math.round((rt.tokens / agente.limiteTokens) * 100)}%` : 'sin límite'}</span>
        <span />
        <span className="suave pequeno">contexto</span>
        <span className="mono pequeno">{tokens(rt.contexto)}</span>
        <Barra valor={rt.contexto} max={rt.ventana} />
        <span className="mono pequeno">{Math.round((rt.contexto / Math.max(1, rt.ventana)) * 100)}%</span>
      </div>
      {rt.limiteAlcanzado && <p className="alerta pequeno">Llegó a su límite: no recibe mensajes hasta que subas el límite.</p>}
      <div className="fila">
        <span className="suave pequeno">motor</span>
        {opciones.length > 1 ? (
          <select value={proveedor} onChange={(e) => setProveedor(e.target.value as ProveedorId)}>
            {opciones.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        ) : (
          <span className="pequeno">{opciones[0]?.nombre}</span>
        )}
        {proveedor === 'claude' ? (
          <select value={modelo} onChange={(e) => setModelo(e.target.value)}>
            {MODELOS_CLAUDE.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        ) : (
          <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="modelo (opcional)" />
        )}
        <span className="espaciador" />
        <button
          className="boton"
          disabled={!cambiado}
          onClick={() => void accion({ tipo: 'agente:motor', id: agente.id, proveedor, modelo, reiniciar: false })}
        >
          aplicar
        </button>
        <button
          className="boton"
          disabled={!activa}
          title="Reinicia la sesión con este motor y retoma la conversación"
          onClick={() => void accion({ tipo: 'agente:motor', id: agente.id, proveedor, modelo, reiniciar: true })}
        >
          reiniciar y continuar
        </button>
      </div>
    </article>
  )
}
