import { useMemo } from 'react'
import type { Agente } from '../../shared/types'
import { useAgentes, useOficina } from '../tienda'
import { cambiarUi, seleccionar, useUi, type Pestana } from '../ui'
import { carpeta } from '../formato'
import { Icono, Retrato } from './basicos'
import { nombreModelo } from './pestanas/Equipo'

const SECCIONES: Array<{ id: Pestana; nombre: string; icono: string }> = [
  { id: 'terminal', nombre: 'Michael', icono: 'terminal' },
  { id: 'tareas', nombre: 'Tareas', icono: 'tareas' },
  { id: 'bandeja', nombre: 'Bandeja', icono: 'bandeja' },
  { id: 'preguntas', nombre: 'Pregúntame', icono: 'campana' },
  { id: 'disparadores', nombre: 'Automatizaciones', icono: 'reloj' },
  { id: 'memoria', nombre: 'Memoria', icono: 'chispa' },
  { id: 'grafo', nombre: 'Grafo', icono: 'grafo' },
  { id: 'consumo', nombre: 'Consumo', icono: 'consumo' },
  { id: 'monitor', nombre: 'Monitor', icono: 'monitor' },
  { id: 'actividad', nombre: 'Actividad', icono: 'actividad' },
  { id: 'comandos', nombre: 'Comandos', icono: 'codigo' },
  { id: 'temporales', nombre: 'Temporales', icono: 'chispa' },
  { id: 'capacidades', nombre: 'Capacidades', icono: 'pieza' },
  { id: 'grapadora', nombre: 'Grapadora', icono: 'grapadora' }
]

/** Barra de la vista completa: secciones y agentes agrupados por carpeta de proyecto. */
export function BarraLateral(): JSX.Element {
  const agentes = useAgentes()
  const pendientes = useOficina((e) => e.preguntas.filter((p) => !p.respuesta).length) ?? 0
  const { pestana, seleccionado, barraLateral } = useUi()
  const vivos = agentes.filter((a) => a.rt.estado !== 'detenido' && a.rt.estado !== 'error').length

  const grupos = useMemo(() => {
    const mapa = new Map<string, Agente[]>()
    for (const a of agentes) mapa.set(a.cwd, [...(mapa.get(a.cwd) ?? []), a])
    return [...mapa.entries()]
  }, [agentes])

  if (!barraLateral) {
    return (
      <aside className="barra-lateral plegada">
        <button className="boton-icono" onClick={() => cambiarUi({ barraLateral: true })} aria-label="Mostrar barra lateral">
          ›
        </button>
      </aside>
    )
  }

  return (
    <aside className="barra-lateral">
      <div className="lateral-cabecera">
        <strong className="pixel">Dunder Mifflin</strong>
        <span className="suave pequeno">Sucursal Scranton</span>
        <button className="boton-icono plegar" onClick={() => cambiarUi({ barraLateral: false })} aria-label="Ocultar barra lateral">
          ‹
        </button>
      </div>
      <nav className="lateral-secciones">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            className={`lateral-item ${!seleccionado && pestana === s.id ? 'activo' : ''}`}
            onClick={() => cambiarUi({ pestana: s.id, seleccionado: null })}
          >
            <Icono nombre={s.icono} />
            {s.nombre}
            {s.id === 'preguntas' && pendientes > 0 && <span className="insignia">{pendientes}</span>}
          </button>
        ))}
      </nav>
      <div className="lateral-titulo">
        <span className="pixel etiqueta-seccion">Agentes</span>
        <span className="suave pequeno">
          <span className={`vivo ${vivos ? 'vivo-on' : ''}`} /> {vivos} en vivo
        </span>
        <span className="espaciador" />
        <button className="boton-icono" onClick={() => cambiarUi({ asistente: 'nuevo' })} title="Contratar" aria-label="Contratar">
          <Icono nombre="mas" tamano={13} />
        </button>
      </div>
      <button className={`lateral-item ${!seleccionado && pestana === 'equipo' ? 'activo' : ''}`} onClick={() => cambiarUi({ pestana: 'equipo', seleccionado: null })}>
        <Icono nombre="personas" /> Todos los agentes
      </button>
      <div className="lateral-agentes">
        {grupos.map(([cwd, lista]) => (
          <div key={cwd}>
            {grupos.length > 1 && (
              <div className="lateral-grupo mono pequeno" title={cwd}>
                <Icono nombre="carpeta" tamano={11} /> {carpeta(cwd)}
              </div>
            )}
            {lista.map((a) => {
              const pct = Math.round((a.rt.contexto / Math.max(1, a.rt.ventana)) * 100)
              const activo = a.esCoordinador ? !seleccionado && pestana === 'terminal' : seleccionado === a.id
              return (
                <div
                  key={a.id}
                  className={`lateral-agente ${activo ? 'activo' : ''}`}
                  onClick={() => (a.esCoordinador ? cambiarUi({ seleccionado: null, pestana: 'terminal' }) : seleccionar(a.id))}
                >
                  <Retrato personaje={a.personaje} tamano={28} />
                  <div className="crece recorte">
                    <div className="fila-compacta">
                      <strong>{a.nombre.split(' ')[0]}</strong>
                      {a.esCoordinador && <span className="insignia-jefe">jefe</span>}
                    </div>
                    <div className="suave pequeno recorte">
                      {nombreModelo(a)} · {pct}%
                    </div>
                    <div className="suave pequeno recorte mayus">{a.nota || a.rol}</div>
                  </div>
                  <span className={`punto-estado estado-${a.rt.estado}`} title={a.rt.estado} />
                  <button
                    className="boton-icono lapiz"
                    onClick={(e) => {
                      e.stopPropagation()
                      cambiarUi({ asistente: a })
                    }}
                    aria-label={`Editar a ${a.nombre}`}
                  >
                    <Icono nombre="lapiz" tamano={12} />
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </aside>
  )
}
