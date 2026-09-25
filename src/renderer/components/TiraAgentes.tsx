import type { CSSProperties } from 'react'
import type { Agente } from '../../shared/types'
import { useAgentes } from '../tienda'
import { cambiarUi, seleccionar, useUi } from '../ui'
import { carpeta } from '../formato'
import { Barra, ChipEstado, Icono, Retrato } from './basicos'

function subtitulo(a: Agente): string {
  if (a.rt.herramienta) return `usando ${a.rt.herramienta}`
  if (a.rt.estado === 'esperando') return 'esperando permiso'
  if (a.rt.pendientes > 0) return `${a.rt.pendientes} en cola`
  return a.nota || carpeta(a.rt.cwdReal ?? a.cwd)
}

/** Tarjetas de todo el equipo, abajo de la oficina, como en el original. */
export function TiraAgentes(): JSX.Element {
  const agentes = useAgentes()
  const { seleccionado } = useUi()
  const orden = [...agentes].sort((a, b) => Number(!!b.esCoordinador) - Number(!!a.esCoordinador))

  return (
    <div className="tira-agentes">
      {orden.map((a) => {
        const activo = a.esCoordinador ? seleccionado === null : seleccionado === a.id
        return (
          <article
            key={a.id}
            className={`tarjeta-agente ${activo ? 'activa' : ''} ${a.esCoordinador ? 'jefe' : ''}`}
            onClick={() => seleccionar(a.esCoordinador ? null : a.id)}
            style={{ '--acento': a.color } as CSSProperties}
          >
            <Retrato personaje={a.personaje} tamano={44} />
            <div className="tarjeta-datos">
              <div className="fila-compacta">
                <strong className="pixel nombre-tarjeta">{a.nombre.split(' ')[0]}</strong>
                {a.esCoordinador && <span className="insignia-jefe">JEFE</span>}
                <span className="espaciador" />
                <ChipEstado estado={a.rt.estado} />
              </div>
              <span className="suave pequeno recorte">{subtitulo(a)}</span>
              <div className="fila-compacta">
                <Barra valor={a.rt.contexto} max={a.rt.ventana} />
                <button
                  className="boton-icono lapiz"
                  onClick={(e) => {
                    e.stopPropagation()
                    cambiarUi({ asistente: a })
                  }}
                  aria-label={`Editar a ${a.nombre}`}
                  title="Editar"
                >
                  <Icono nombre="lapiz" tamano={12} />
                </button>
              </div>
            </div>
          </article>
        )
      })}
      <button className="tarjeta-agente tarjeta-nueva" onClick={() => cambiarUi({ asistente: 'nuevo' })}>
        <Icono nombre="mas" tamano={20} />
        <span className="pixel">contratar</span>
      </button>
    </div>
  )
}
