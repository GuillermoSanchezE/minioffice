import type { Ajustes as TipoAjustes } from '../../shared/types'
import { MODOS_PERMISOS } from '../../shared/motores'
import { intentar, useOficina } from '../tienda'
import { cambiarUi, useUi } from '../ui'
import { Modal, Vacio } from './basicos'

export function Ajustes(): JSX.Element {
  const ajustes = useOficina((e) => e.ajustes)
  const raiz = useOficina((e) => e.raiz)
  const version = useOficina((e) => e.version)
  const { tema } = useUi()
  const cerrar = (): void => cambiarUi({ ajustesAbiertos: false })
  const guardar = (c: Partial<TipoAjustes>): void => void intentar({ tipo: 'ajustes:guardar', ajustes: c })

  return (
    <Modal titulo="Ajustes" onCerrar={cerrar} ancho={620}>
      {!ajustes ? (
        <Vacio>Cargando…</Vacio>
      ) : (
        <div className="formulario">
          <span className="etiqueta-campo">Permisos de los agentes</span>
          {MODOS_PERMISOS.map((m) => (
            <label key={m.id} className="opcion-radio">
              <input type="radio" name="permisos" checked={ajustes.modoPermisos === m.id} onChange={() => guardar({ modoPermisos: m.id })} />
              <span>
                <strong>{m.nombre}</strong>
                <span className="suave pequeno"> — {m.detalle}</span>
              </span>
            </label>
          ))}
          <p className="suave pequeno">Se aplica a las sesiones que se inicien desde ahora.</p>

          <span className="etiqueta-campo">A qué se dedica la oficina</span>
          <textarea
            id="enfoque"
            rows={2}
            defaultValue={ajustes.enfoque}
            onBlur={(e) => e.target.value !== ajustes.enfoque && guardar({ enfoque: e.target.value })}
            placeholder="Esta oficina desarrolla software y páginas web."
          />
          <p className="suave pequeno">Todos los agentes lo leen al iniciar su sesión.</p>

          <span className="etiqueta-campo">Oficina</span>
          <label className="casilla">
            <input type="checkbox" checked={ajustes.michaelAlIniciar} onChange={(e) => guardar({ michaelAlIniciar: e.target.checked })} />
            Michael empieza a trabajar al abrir minioffice
          </label>
          <label className="casilla">
            <input type="checkbox" checked={ajustes.verNombres} onChange={(e) => guardar({ verNombres: e.target.checked })} />
            Ver los nombres sobre los personajes
          </label>
          <label className="casilla">
            <input type="checkbox" checked={ajustes.paseos} onChange={(e) => guardar({ paseos: e.target.checked })} />
            Los que están libres pasean por la oficina (café, snacks, visitas)
          </label>
          <div className="fila">
            <span>Temporales a la vez</span>
            <input
              className="entrada-corta"
              type="number"
              min={1}
              max={12}
              value={ajustes.maxTemporales}
              onChange={(e) => guardar({ maxTemporales: Math.min(12, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </div>

          <span className="etiqueta-campo">Apariencia</span>
          <div className="segmentado">
            <button className={tema === 'claro' ? 'activo' : ''} onClick={() => cambiarUi({ tema: 'claro' })}>
              Crema
            </button>
            <button className={tema === 'oscuro' ? 'activo' : ''} onClick={() => cambiarUi({ tema: 'oscuro' })}>
              Noche
            </button>
          </div>

          <span className="etiqueta-campo">Proyecto</span>
          <p className="mono pequeno">{raiz}</p>
          <p className="suave pequeno">
            El equipo vive en <code>minioffice.config.json</code> y la memoria compartida en <code>.hive/</code> (un repositorio git local). minioffice{' '}
            {version}.
          </p>
        </div>
      )}
    </Modal>
  )
}
