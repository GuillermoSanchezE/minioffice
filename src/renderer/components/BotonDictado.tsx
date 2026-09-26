import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { MODELOS_DICTADO } from '../../shared/dictado'
import { accion, avisar } from '../tienda'
import {
  cancelarDictado,
  detenerDictado,
  empezarDictado,
  estadoVoz,
  explicarError,
  faltaDescargar,
  guardarAjustesDictado,
  leerAjustesDictado,
  prepararModelo,
  useVoz
} from '../dictado/voz'
import { Icono } from './basicos'

function reloj(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function megas(bytes: number): string {
  return `${Math.round(bytes / 1e6)} MB`
}

/**
 * Micrófono junto a un campo de texto: un clic empieza a grabar, otro clic
 * transcribe con Whisper y añade el texto. Esc cancela.
 */
export function BotonDictado({ alTexto }: { alTexto: (texto: string) => void }): JSX.Element {
  const id = useId()
  const fase = useVoz((e) => (e.dueno === id ? e.fase : e.fase === 'libre' ? 'libre' : 'otro'))
  const inicio = useVoz((e) => (e.dueno === id ? e.inicio : 0))
  const nivel = useVoz((e) => (e.dueno === id ? e.nivel : 0))
  const carga = useVoz((e) => e.carga)
  const ajustes = useVoz((e) => e.ajustes)
  const [panel, setPanelEstado] = useState<null | 'descargar' | 'permiso'>(null)
  const [posicion, setPosicion] = useState<CSSProperties>({})
  const [, setTic] = useState(0)
  const alTextoActual = useRef(alTexto)
  alTextoActual.current = alTexto
  const caja = useRef<HTMLSpanElement>(null)
  const boton = useRef<HTMLButtonElement>(null)

  // El panel flota sobre todo (fixed) para que no lo tape la barra lateral ni lo corte un contenedor.
  function setPanel(p: null | 'descargar' | 'permiso'): void {
    const r = boton.current?.getBoundingClientRect()
    if (p && r) {
      const ancho = Math.min(330, window.innerWidth - 32)
      const preferida = r.right - ancho >= 16 ? r.right - ancho : r.left
      const left = Math.min(Math.max(16, preferida), window.innerWidth - ancho - 16)
      setPosicion(r.top > 220 ? { left, width: ancho, bottom: window.innerHeight - r.top + 8 } : { left, width: ancho, top: r.bottom + 8 })
    }
    setPanelEstado(p)
  }

  // Si el campo desaparece (cambias de pestaña, cierras el diálogo) mientras graba, se cancela:
  // si no, el micrófono quedaría abierto y bloquearía el dictado en los demás campos.
  useEffect(
    () => () => {
      const e = estadoVoz()
      if (e.dueno === id && e.fase === 'grabando') cancelarDictado()
    },
    [id]
  )

  useEffect(() => {
    if (fase !== 'grabando') return
    const t = window.setInterval(() => setTic((x) => x + 1), 500)
    // Esc cancela antes de que cierre el diálogo en el que esté el campo.
    const alTeclear = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      cancelarDictado()
    }
    window.addEventListener('keydown', alTeclear, true)
    return () => {
      clearInterval(t)
      window.removeEventListener('keydown', alTeclear, true)
    }
  }, [fase])

  useEffect(() => {
    if (!panel) return
    const fuera = (e: MouseEvent): void => {
      if (caja.current && !caja.current.contains(e.target as Node)) setPanel(null)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [panel])

  async function empezar(): Promise<void> {
    const r = await empezarDictado(id, (t) => alTextoActual.current(t))
    if (r === 'sin-permiso') setPanel('permiso')
    else if (r === 'ocupado') avisar('Ya estás dictando en otro campo.', 'error')
  }

  async function pulsar(): Promise<void> {
    if (fase === 'grabando') return detenerDictado()
    if (fase !== 'libre') return
    const a = estadoVoz().ajustes ?? (await leerAjustesDictado())
    if (!a) return
    if (faltaDescargar(a)) {
      setPanel('descargar')
      return
    }
    setPanel(null)
    await empezar()
  }

  async function descargar(modelo = ajustes?.modelo): Promise<void> {
    if (!modelo) return
    if (modelo !== ajustes?.modelo) await guardarAjustesDictado({ modelo })
    try {
      await prepararModelo(modelo)
      setPanel(null)
      avisar('Dictado listo: pulsa el micrófono y habla.')
    } catch (err) {
      setPanel(null)
      avisar(`No se pudo descargar Whisper: ${explicarError(err)}`, 'error')
    }
  }

  const modelo = ajustes ? MODELOS_DICTADO[ajustes.modelo] : MODELOS_DICTADO.small
  const descargando = !!carga && carga.modelo === ajustes?.modelo
  const porcentaje = carga && carga.total > 0 ? Math.min(100, Math.round((carga.cargado / carga.total) * 100)) : 0

  let contenido: JSX.Element
  let titulo: string
  if (fase === 'grabando') {
    contenido = (
      <>
        <span className="punto-grabando" />
        {reloj(Date.now() - inicio)}
        <Icono nombre="stop" tamano={12} />
      </>
    )
    titulo = 'Grabando: clic para transcribir · Esc cancela'
  } else if (fase === 'transcribiendo') {
    contenido = (
      <>
        <span className="girando" aria-hidden="true" />
        escribiendo…
      </>
    )
    titulo = 'Whisper está transcribiendo'
  } else if (descargando && fase === 'libre' && panel !== 'descargar') {
    contenido = (
      <>
        <Icono nombre="microfono" />
        <span className="pequeno">{porcentaje}%</span>
      </>
    )
    titulo = `Descargando ${modelo.nombre}… ${porcentaje}%`
  } else {
    contenido = <Icono nombre="microfono" />
    titulo = fase === 'otro' ? 'Estás dictando en otro campo' : 'Dictar con la voz (Whisper, sin salir de tu equipo)'
  }

  return (
    <span className="dictado" ref={caja}>
      <button
        ref={boton}
        type="button"
        className={`boton-dictado ${fase === 'grabando' ? 'grabando' : ''} ${fase === 'transcribiendo' ? 'transcribiendo' : ''}`}
        style={fase === 'grabando' ? ({ '--nivel': nivel.toFixed(2) } as CSSProperties) : undefined}
        onClick={() => void pulsar()}
        disabled={fase === 'otro' || fase === 'transcribiendo'}
        title={titulo}
        aria-label={titulo}
        aria-pressed={fase === 'grabando'}
      >
        {contenido}
      </button>

      {panel === 'descargar' && (
        <div className="dictado-panel" style={posicion} role="dialog" aria-label="Descargar Whisper">
          {descargando ? (
            <>
              <strong>Descargando {modelo.nombre}…</strong>
              <span className="barra">
                <span className="barra-relleno barra-teal" style={{ width: `${porcentaje}%` }} />
              </span>
              <span className="suave pequeno">
                {megas(carga?.cargado ?? 0)} de {carga?.total ? megas(carga.total) : `≈${modelo.megas} MB`} · puedes seguir trabajando, te aviso al terminar.
              </span>
              <div className="fila-compacta">
                <span className="espaciador" />
                <button className="boton" onClick={() => setPanel(null)}>
                  cerrar
                </button>
              </div>
            </>
          ) : (
            <>
              <strong>Dictado por voz</strong>
              <span>
                Para dictar, minioffice descarga una sola vez <b>{modelo.nombre}</b> (≈{modelo.megas} MB). Después funciona sin internet y tu voz no sale
                de tu equipo.
              </span>
              <div className="fila-compacta">
                {ajustes?.modelo === 'small' && (
                  <button className="boton" onClick={() => void descargar('base')} title={MODELOS_DICTADO.base.descripcion}>
                    usar base ({MODELOS_DICTADO.base.megas} MB)
                  </button>
                )}
                <span className="espaciador" />
                <button className="boton" onClick={() => setPanel(null)}>
                  ahora no
                </button>
                <button className="boton boton-mostaza" onClick={() => void descargar()}>
                  descargar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {panel === 'permiso' && (
        <div className="dictado-panel" style={posicion} role="dialog" aria-label="Permiso de micrófono">
          <strong>Sin acceso al micrófono</strong>
          <span>
            Activa minioffice en Ajustes del Sistema › Privacidad y seguridad › Micrófono. Si ya estaba activado, cierra y vuelve a abrir la app.
          </span>
          <div className="fila-compacta">
            <span className="espaciador" />
            <button className="boton" onClick={() => setPanel(null)}>
              cerrar
            </button>
            <button className="boton boton-mostaza" onClick={() => void accion({ tipo: 'dictado:privacidad' })}>
              abrir ajustes
            </button>
          </div>
        </div>
      )}
    </span>
  )
}
