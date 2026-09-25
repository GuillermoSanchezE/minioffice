import { useMemo, useState } from 'react'
import type { EstadoTarea, Tarea } from '../../../shared/types'
import { accion, intentar, useAgentes, useOficina } from '../../tienda'
import { hace } from '../../formato'
import { Icono, Modal, Retrato, Vacio } from '../basicos'

const COLUMNAS: Array<{ id: EstadoTarea; nombre: string }> = [
  { id: 'pendiente', nombre: 'Por hacer' },
  { id: 'en_curso', nombre: 'En curso' },
  { id: 'bloqueada', nombre: 'Bloqueada' },
  { id: 'hecha', nombre: 'Hecha' }
]

type Vista = 'tablero' | 'lista'

export function PestanaTareas(): JSX.Element {
  const tareas = useOficina((e) => e.tareas) ?? []
  const agentes = useAgentes()
  const [vista, setVista] = useState<Vista>('tablero')
  const [filtro, setFiltro] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [archivadas, setArchivadas] = useState(false)
  const [editando, setEditando] = useState<Partial<Tarea> | null>(null)
  const [arrastrando, setArrastrando] = useState<string | null>(null)

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return tareas.filter(
      (t) =>
        !!t.archivada === archivadas &&
        (!filtro || t.dueno === filtro) &&
        (!q || `${t.titulo} ${t.descripcion} ${t.id}`.toLowerCase().includes(q))
    )
  }, [tareas, filtro, busqueda, archivadas])

  const enCurso = tareas.filter((t) => !t.archivada && t.estado === 'en_curso').length
  const bloqueadas = tareas.filter((t) => !t.archivada && t.estado === 'bloqueada').length
  const conTareas = agentes.filter((a) => tareas.some((t) => t.dueno === a.id))
  const agente = (id?: string): (typeof agentes)[number] | undefined => agentes.find((a) => a.id === id)

  function soltar(estado: EstadoTarea): void {
    const t = tareas.find((x) => x.id === arrastrando)
    setArrastrando(null)
    if (t && t.estado !== estado) void accion({ tipo: 'tarea:guardar', tarea: { id: t.id, titulo: t.titulo, estado } })
  }

  const tarjeta = (t: Tarea): JSX.Element => {
    const dueno = agente(t.dueno)
    return (
      <article
        key={t.id}
        className="tarjeta-tarea"
        draggable
        onDragStart={() => setArrastrando(t.id)}
        onDragEnd={() => setArrastrando(null)}
        onClick={() => setEditando(t)}
      >
        <span className="mono suave pequeno">{t.id}</span>
        <p>{t.titulo}</p>
        {t.descripcion && <p className="suave pequeno recorte">{t.descripcion}</p>}
        <div className="fila">
          <span className="prioridad" title={`Prioridad ${t.prioridad}`}>
            {[1, 2, 3].map((n) => (
              <i key={n} className={n <= 4 - t.prioridad ? 'lleno' : ''} />
            ))}
          </span>
          <span className="suave pequeno">{hace(t.actualizada)}</span>
          <span className="espaciador" />
          {dueno ? <Retrato personaje={dueno.personaje} tamano={20} titulo={dueno.nombre} /> : <span className="suave pequeno">sin dueño</span>}
        </div>
      </article>
    )
  }

  return (
    <div className="pestana-contenido tareas">
      <div className="barra-herramientas">
        <strong className="pixel">Tareas</strong>
        <span className="suave pequeno">
          {enCurso} en curso · {bloqueadas} bloqueadas
        </span>
        <span className="espaciador" />
        <div className="buscador">
          <Icono nombre="buscar" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar tareas" />
        </div>
        <div className="segmentado">
          <button className={vista === 'tablero' ? 'activo' : ''} onClick={() => setVista('tablero')}>
            Tablero
          </button>
          <button className={vista === 'lista' ? 'activo' : ''} onClick={() => setVista('lista')}>
            Lista
          </button>
        </div>
        <button className="boton boton-mostaza" onClick={() => setEditando({ titulo: '', estado: 'pendiente', prioridad: 2 })}>
          <Icono nombre="mas" /> Nueva tarea
        </button>
      </div>
      <div className="chips">
        <button className={`chip ${!filtro ? 'activo' : ''}`} onClick={() => setFiltro(null)}>
          Todos
        </button>
        {conTareas.map((a) => (
          <button key={a.id} className={`chip ${filtro === a.id ? 'activo' : ''}`} onClick={() => setFiltro(filtro === a.id ? null : a.id)}>
            {a.nombre.split(' ')[0]}
          </button>
        ))}
        <button className={`chip ${archivadas ? 'activo' : ''}`} onClick={() => setArchivadas((v) => !v)}>
          Archivadas
        </button>
      </div>

      {tareas.length === 0 ? (
        <Vacio>
          El tablero está vacío. Pídele algo a Michael o crea una tarea: los agentes también pueden escribir tarjetas en
          <code>.hive/tareas/</code>.
        </Vacio>
      ) : vista === 'tablero' ? (
        <div className="tablero">
          {COLUMNAS.map((c) => {
            const lista = visibles.filter((t) => t.estado === c.id)
            return (
              <div
                key={c.id}
                className={`columna columna-${c.id} ${arrastrando ? 'soltable' : ''}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => soltar(c.id)}
              >
                <h4>
                  <span className={`punto-columna punto-${c.id}`} />
                  {c.nombre}
                  <span className="suave">{lista.length}</span>
                </h4>
                {lista.length === 0 ? <p className="suave pequeno centrado">Nada aquí</p> : lista.map(tarjeta)}
              </div>
            )
          })}
        </div>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Tarea</th>
              <th>Estado</th>
              <th>Dueño</th>
              <th>Actualizada</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((t) => (
              <tr key={t.id} onClick={() => setEditando(t)}>
                <td>
                  <strong>{t.titulo}</strong>
                  <div className="mono suave pequeno">{t.id}</div>
                </td>
                <td>{COLUMNAS.find((c) => c.id === t.estado)?.nombre}</td>
                <td>{agente(t.dueno)?.nombre ?? '—'}</td>
                <td className="suave">{hace(t.actualizada)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editando && <EditorTarea tarea={editando} onCerrar={() => setEditando(null)} />}
    </div>
  )
}

function EditorTarea({ tarea, onCerrar }: { tarea: Partial<Tarea>; onCerrar: () => void }): JSX.Element {
  const agentes = useAgentes()
  const [t, setT] = useState<Partial<Tarea>>(tarea)
  const nueva = !tarea.id

  async function guardar(cambios: Partial<Tarea> = {}): Promise<void> {
    const datos = { ...t, ...cambios, titulo: (t.titulo ?? '').trim() }
    if (await intentar({ tipo: 'tarea:guardar', tarea: datos })) onCerrar()
  }

  return (
    <Modal
      titulo={nueva ? 'Nueva tarea' : 'Tarea'}
      onCerrar={onCerrar}
      ancho={620}
      pie={
        <>
          {!nueva && (
            <>
              <button
                className="boton boton-peligro"
                onClick={() => void accion({ tipo: 'tarea:eliminar', id: tarea.id! }).then(onCerrar)}
              >
                <Icono nombre="papelera" /> eliminar
              </button>
              <button className="boton" onClick={() => void guardar({ archivada: !t.archivada })}>
                {t.archivada ? 'desarchivar' : 'archivar'}
              </button>
            </>
          )}
          <span className="espaciador" />
          <button className="boton" onClick={onCerrar}>
            cancelar
          </button>
          <button className="boton boton-oscuro" disabled={!t.titulo?.trim()} onClick={() => void guardar()}>
            guardar
          </button>
        </>
      }
    >
      <div className="formulario">
        {!nueva && <p className="mono suave pequeno">{tarea.id}</p>}
        <label>
          Título
          <input autoFocus value={t.titulo ?? ''} onChange={(e) => setT({ ...t, titulo: e.target.value })} />
        </label>
        <label>
          Descripción
          <textarea rows={5} value={t.descripcion ?? ''} onChange={(e) => setT({ ...t, descripcion: e.target.value })} />
        </label>
        <div className="formulario-fila">
          <label>
            Estado
            <select value={t.estado ?? 'pendiente'} onChange={(e) => setT({ ...t, estado: e.target.value as EstadoTarea })}>
              {COLUMNAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dueño
            <select value={t.dueno ?? ''} onChange={(e) => setT({ ...t, dueno: e.target.value })}>
              <option value="">Sin dueño</option>
              {agentes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioridad
            <select value={t.prioridad ?? 2} onChange={(e) => setT({ ...t, prioridad: Number(e.target.value) as 1 | 2 | 3 })}>
              <option value={1}>Alta</option>
              <option value={2}>Media</option>
              <option value={3}>Baja</option>
            </select>
          </label>
        </div>
        <p className="suave pequeno">Si le pones dueño, minioffice le avisa al agente con la tarea.</p>
      </div>
    </Modal>
  )
}
