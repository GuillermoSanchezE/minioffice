import type { AgenteConEstado } from '../../shared/api'
import { aCss, COLOR_ESTADO, ETIQUETA_ESTADO } from '../colores'
import { AvatarAgente } from './AvatarAgente'

interface Props {
  agentes: AgenteConEstado[]
  seleccionado: string | null
  onSeleccionar: (agentId: string) => void
}

export function ListaAgentes({ agentes, seleccionado, onSeleccionar }: Props): JSX.Element {
  return (
    <ul className="lista-agentes">
      {agentes.map((agente) => (
        <li key={agente.id}>
          <button
            className={`agente ${seleccionado === agente.id ? 'agente-activo' : ''}`}
            onClick={() => onSeleccionar(agente.id)}
          >
            <AvatarAgente id={agente.id} nombre={agente.nombre} className="agente-avatar" />
            <span className="agente-datos">
              <strong>{agente.nombre}</strong>
              <span className="texto-suave">{agente.rol}</span>
            </span>
            <span className="agente-estado" title={ETIQUETA_ESTADO[agente.estado]}>
              <span className="punto-estado" style={{ background: aCss(COLOR_ESTADO[agente.estado]) }} />
              {agente.esCoordinador ? 'Coordinando' : ETIQUETA_ESTADO[agente.estado]}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
