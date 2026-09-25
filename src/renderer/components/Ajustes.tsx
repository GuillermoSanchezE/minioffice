import { useEffect } from 'react'
import type { Ajustes as TipoAjustes } from '../../shared/types'
import { MODOS_PERMISOS } from '../../shared/motores'
import { IDIOMAS_DICTADO, MODELOS_DICTADO, type InfoModeloDictado } from '../../shared/dictado'
import { accion, avisar, intentar, useOficina } from '../tienda'
import { cambiarUi, useUi } from '../ui'
import { borrarModelo, explicarError, guardarAjustesDictado, leerAjustesDictado, prepararModelo, useVoz } from '../dictado/voz'
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

          <SeccionDictado />

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
          <div className="fila">
            <p className="mono pequeno crece recorte" title={raiz}>
              {raiz}
            </p>
            <button className="boton" onClick={() => void accion({ tipo: 'proyecto:cambiar' })}>
              Abrir otro proyecto…
            </button>
          </div>
          <p className="suave pequeno">
            El equipo vive en <code>minioffice.config.json</code> y la memoria compartida en <code>.hive/</code> (un repositorio git local). minioffice{' '}
            {version}.
          </p>
        </div>
      )}
    </Modal>
  )
}

function EstadoModelo({ modelo }: { modelo: InfoModeloDictado }): JSX.Element {
  const a = useVoz((e) => e.ajustes)
  const carga = useVoz((e) => (e.carga?.modelo === modelo.id ? e.carga : null))
  if (carga) {
    const pct = carga.total ? Math.round((carga.cargado / carga.total) * 100) : 0
    return <span className="pequeno"> · descargando {pct}%</span>
  }
  const bytes = a?.guardados[modelo.id] ?? 0
  const mb = `${Math.max(1, Math.round(bytes / 1e6))} MB`
  if (a?.listos.includes(modelo.id)) return <span className="pequeno"> · descargado ({mb})</span>
  if (bytes > 0) return <span className="pequeno"> · a medias ({mb})</span>
  return <span className="suave pequeno"> · sin descargar</span>
}

function SeccionDictado(): JSX.Element {
  const a = useVoz((e) => e.ajustes)
  const cargando = useVoz((e) => e.carga?.modelo ?? null)
  useEffect(() => {
    void leerAjustesDictado()
  }, [])
  if (!a) return <span className="etiqueta-campo">Dictado por voz</span>

  const falta = !a.listos.includes(a.modelo) && cargando !== a.modelo
  return (
    <>
      <span className="etiqueta-campo">Dictado por voz</span>
      <p className="suave pequeno">
        Pulsa el micrófono junto a cualquier mensaje, habla y vuelve a pulsar. Whisper corre en tu equipo: tu voz no sale de él y funciona sin
        internet una vez descargado.
      </p>
      {Object.values(MODELOS_DICTADO).map((m) => (
        <label key={m.id} className="opcion-radio">
          <input type="radio" name="modelo-dictado" checked={a.modelo === m.id} onChange={() => void guardarAjustesDictado({ modelo: m.id })} />
          <span className="crece">
            <strong>{m.nombre}</strong>
            <span className="suave pequeno">
              {' '}
              — ≈{m.megas} MB. {m.descripcion}
            </span>
            <EstadoModelo modelo={m} />
          </span>
          {a.guardados[m.id] > 0 && cargando !== m.id && (
            <button className="boton-mini" onClick={() => void borrarModelo(m.id)} title="Libera el espacio; se vuelve a descargar si lo usas">
              borrar
            </button>
          )}
        </label>
      ))}
      <div className="fila">
        <span>Idioma</span>
        <div className="segmentado">
          {IDIOMAS_DICTADO.map((i) => (
            <button key={i.id} className={a.idioma === i.id ? 'activo' : ''} onClick={() => void guardarAjustesDictado({ idioma: i.id })}>
              {i.nombre}
            </button>
          ))}
        </div>
        <span className="espaciador" />
        {falta && (
          <button
            className="boton"
            onClick={() =>
              void prepararModelo(a.modelo).then(
                () => avisar('Dictado listo: pulsa el micrófono junto a cualquier mensaje.'),
                (err: Error) => avisar(`No se pudo descargar Whisper: ${explicarError(err)}`, 'error')
              )
            }
          >
            descargar ahora
          </button>
        )}
      </div>
      <p className="suave pequeno">Con «Español» acierta más que detectando el idioma solo. Los modelos se guardan en:</p>
      <p className="mono pequeno recorte" title={a.carpeta}>
        {a.carpeta}
      </p>
    </>
  )
}
