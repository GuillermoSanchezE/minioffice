import { useState } from 'react'
import type { ComandoGuardado } from '../../../shared/types'
import { accion, avisar, intentar, useAgentes, useOficina } from '../../tienda'
import { Icono, Modal } from '../basicos'

const RAPIDOS: Array<{ texto: string; detalle: string }> = [
  { texto: '/compact', detalle: 'resume la conversación y libera contexto' },
  { texto: '/clear', detalle: 'empieza una conversación limpia' },
  { texto: '/cost', detalle: 'muestra lo gastado en la sesión' },
  { texto: '/context', detalle: 'muestra qué ocupa el contexto' }
]

export function PestanaComandos(): JSX.Element {
  const agentes = useAgentes()
  const ajustes = useOficina((e) => e.ajustes)
  const [texto, setTexto] = useState('')
  const [modo, setModo] = useState<'cola' | 'guiar'>('cola')
  const [editando, setEditando] = useState<ComandoGuardado | null>(null)
  const activos = agentes.filter((a) => a.rt.estado !== 'detenido' && a.rt.estado !== 'error').length
  const comandos = ajustes?.comandos ?? []

  async function difundir(t: string, m: 'cola' | 'guiar' = modo): Promise<void> {
    if (!t.trim()) return
    if (activos === 0) {
      avisar('No hay agentes activos que lo reciban.', 'error')
      return
    }
    if (await intentar({ tipo: 'equipo:difundir', texto: t, modo: m })) avisar(`Enviado a ${activos} agentes`)
  }

  async function ejecutar(c: ComandoGuardado): Promise<void> {
    if (c.para === 'todos') return difundir(c.texto, 'cola')
    if (await intentar({ tipo: 'agente:enviar', id: c.para, texto: c.texto, modo: 'cola' })) {
      avisar(`«${c.nombre}» enviado a ${agentes.find((a) => a.id === c.para)?.nombre ?? c.para}`)
    }
  }

  const guardarComandos = (lista: ComandoGuardado[]): Promise<boolean> => intentar({ tipo: 'ajustes:guardar', ajustes: { comandos: lista } })

  return (
    <div className="pestana-contenido">
      <section className="seccion">
        <div className="fila">
          <h3 className="pixel">Toda la oficina</h3>
          <span className="suave pequeno">
            {activos} de {agentes.length} con sesión
          </span>
          <span className="espaciador" />
          <button className="boton" onClick={() => void accion({ tipo: 'equipo:iniciarTodos' })}>
            <Icono nombre="play" /> iniciar a todos
          </button>
          <button className="boton" onClick={() => void accion({ tipo: 'equipo:detenerTodos' })}>
            <Icono nombre="stop" /> detener a todos
          </button>
        </div>
        <textarea
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Mensaje para todos los agentes activos…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void difundir(texto).then(() => setTexto(''))
            }
          }}
        />
        <div className="fila">
          <div className="segmentado">
            <button className={modo === 'cola' ? 'activo' : ''} onClick={() => setModo('cola')} title="Se entrega cuando cada uno quede libre">
              en cola
            </button>
            <button className={modo === 'guiar' ? 'activo' : ''} onClick={() => setModo('guiar')} title="Se escribe ya, aunque estén trabajando">
              guiar
            </button>
          </div>
          <span className="suave pequeno">{modo === 'cola' ? 'llega cuando cada uno quede libre' : 'se escribe ya, aunque estén a mitad de algo'}</span>
          <span className="espaciador" />
          <button className="boton boton-mostaza" disabled={!texto.trim()} onClick={() => void difundir(texto).then(() => setTexto(''))}>
            difundir <Icono nombre="enviar" />
          </button>
        </div>
        <div className="chips">
          {RAPIDOS.map((r) => (
            <button key={r.texto} className="chip mono" title={r.detalle} onClick={() => void difundir(r.texto, 'guiar')}>
              {r.texto}
            </button>
          ))}
          <span className="suave pequeno">comandos de Claude Code para todos</span>
        </div>
      </section>

      <section className="seccion">
        <div className="fila">
          <h3 className="pixel">Comandos guardados</h3>
          <span className="espaciador" />
          <button
            className="boton"
            onClick={() => setEditando({ id: `cmd-${Date.now().toString(36)}`, nombre: '', para: 'todos', texto: '' })}
          >
            <Icono nombre="mas" /> nuevo
          </button>
        </div>
        {comandos.length === 0 && <p className="suave">Guarda aquí lo que le pides seguido a la oficina.</p>}
        <div className="rejilla-comandos">
          {comandos.map((c) => (
            <article key={c.id} className="tarjeta-comando">
              <div className="fila">
                <strong className="crece">{c.nombre}</strong>
                <span className="suave pequeno">→ {c.para === 'todos' ? 'todos' : (agentes.find((a) => a.id === c.para)?.nombre ?? c.para)}</span>
              </div>
              <p className="suave pequeno recorte-3">{c.texto}</p>
              <div className="fila">
                <button className="boton boton-mostaza" onClick={() => void ejecutar(c)}>
                  <Icono nombre="play" /> ejecutar
                </button>
                <span className="espaciador" />
                <button className="boton-icono" onClick={() => setEditando(c)} aria-label="Editar">
                  <Icono nombre="lapiz" />
                </button>
                <button
                  className="boton-icono"
                  onClick={() => void guardarComandos(comandos.filter((x) => x.id !== c.id))}
                  aria-label="Eliminar"
                >
                  <Icono nombre="papelera" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {editando && (
        <EditorComando
          comando={editando}
          onCerrar={() => setEditando(null)}
          onGuardar={(c) =>
            void guardarComandos(comandos.some((x) => x.id === c.id) ? comandos.map((x) => (x.id === c.id ? c : x)) : [...comandos, c]).then(
              (ok) => ok && setEditando(null)
            )
          }
        />
      )}
    </div>
  )
}

function EditorComando({
  comando,
  onCerrar,
  onGuardar
}: {
  comando: ComandoGuardado
  onCerrar: () => void
  onGuardar: (c: ComandoGuardado) => void
}): JSX.Element {
  const agentes = useAgentes()
  const [c, setC] = useState(comando)
  const valido = c.nombre.trim() && c.texto.trim()
  return (
    <Modal
      titulo="Comando guardado"
      onCerrar={onCerrar}
      ancho={560}
      pie={
        <>
          <span className="espaciador" />
          <button className="boton" onClick={onCerrar}>
            cancelar
          </button>
          <button className="boton boton-oscuro" disabled={!valido} onClick={() => onGuardar({ ...c, nombre: c.nombre.trim() })}>
            guardar
          </button>
        </>
      }
    >
      <div className="formulario">
        <label>
          Nombre
          <input autoFocus value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} placeholder="Reporte del día" />
        </label>
        <label>
          Para
          <select value={c.para} onChange={(e) => setC({ ...c, para: e.target.value })}>
            <option value="todos">Todos los activos</option>
            {agentes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mensaje
          <textarea rows={5} value={c.texto} onChange={(e) => setC({ ...c, texto: e.target.value })} />
        </label>
      </div>
    </Modal>
  )
}
