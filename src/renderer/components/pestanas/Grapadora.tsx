import { useEffect, useMemo, useState } from 'react'
import type { AccionGrapadora, AjustesGrapadora, Captura } from '../../../shared/acciones'
import { accion, avisar, intentar, useAgentes } from '../../tienda'
import { fecha } from '../../formato'
import { COLORES_GRAPADORA, EXPRESIONES, FORMAS, esColorValido, palabraAlAzar, svgCara } from '../../grapadora/cara'
import { Icono, Vacio } from '../basicos'

type Sub = 'criatura' | 'acciones' | 'capturas'

const ACCIONES: Array<{ id: AccionGrapadora; nombre: string; detalle: string }> = [
  { id: 'captura', nombre: 'Captura', detalle: 'Guarda la pantalla en .hive/capturas' },
  { id: 'captura-michael', nombre: 'Captura a Michael', detalle: 'Captura y se la manda a Michael para que la revise' },
  { id: 'pedir', nombre: 'Pedir a Michael', detalle: 'Escribe un pedido rápido sin abrir la oficina' },
  { id: 'abrir', nombre: 'Abrir la oficina', detalle: 'Trae la ventana de minioffice al frente' },
  { id: 'preguntas', nombre: 'Preguntas', detalle: 'Abre lo que los agentes te están preguntando' },
  { id: 'ocultar', nombre: 'Ocultar', detalle: 'Guarda la grapadora hasta que la vuelvas a encender aquí' }
]

export function PestanaGrapadora(): JSX.Element {
  const [ajustes, setAjustes] = useState<AjustesGrapadora | null>(null)
  const [sub, setSub] = useState<Sub>('criatura')

  useEffect(() => {
    // Solo "visible" cambia desde fuera (la propia grapadora puede ocultarse).
    const leer = (): void => {
      void accion({ tipo: 'grapadora:leerAjustes' }).then((a) => a && setAjustes((prev) => (prev ? { ...prev, visible: a.visible } : a)))
    }
    leer()
    const t = setInterval(leer, 3000)
    return () => clearInterval(t)
  }, [])

  function cambiar(cambios: Partial<AjustesGrapadora>): void {
    if (!ajustes) return
    const siguiente = { ...ajustes, ...cambios }
    setAjustes(siguiente)
    void intentar({ tipo: 'grapadora:ajustes', ajustes: siguiente })
  }

  if (!ajustes) return <Vacio>Cargando…</Vacio>

  return (
    <div className="pestana-contenido grapadora-pestana">
      <div className="barra-herramientas">
        <strong className="pixel">Grapadora</strong>
        <span className="suave pequeno">una criaturita que flota sobre todas tus apps; un clic abre sus acciones</span>
        <span className="espaciador" />
        <span className={`pequeno ${ajustes.visible ? 'texto-verde' : 'suave'}`}>{ajustes.visible ? 'En pantalla' : 'Guardada'}</span>
        <label className="interruptor">
          <input type="checkbox" checked={ajustes.visible} onChange={(e) => cambiar({ visible: e.target.checked })} />
          <span />
        </label>
      </div>
      <div className="subpestanas">
        <button className={sub === 'criatura' ? 'activa' : ''} onClick={() => setSub('criatura')}>
          <Icono nombre="grapadora" /> Criatura
        </button>
        <button className={sub === 'acciones' ? 'activa' : ''} onClick={() => setSub('acciones')}>
          <Icono nombre="chispa" /> Acciones
        </button>
        <button className={sub === 'capturas' ? 'activa' : ''} onClick={() => setSub('capturas')}>
          <Icono nombre="expandir" /> Capturas
        </button>
      </div>
      {sub === 'criatura' && <Criatura ajustes={ajustes} cambiar={cambiar} />}
      {sub === 'acciones' && <Acciones ajustes={ajustes} cambiar={cambiar} />}
      {sub === 'capturas' && <Capturas />}
    </div>
  )
}

function Miniatura({ ajustes, forma, expresion }: { ajustes: AjustesGrapadora; forma?: number; expresion?: number }): JSX.Element {
  const html = useMemo(
    () => svgCara({ semilla: ajustes.semilla, color: ajustes.color, forma: forma ?? ajustes.forma, expresion: expresion ?? ajustes.expresion, quieta: true }),
    [ajustes.semilla, ajustes.color, ajustes.forma, ajustes.expresion, forma, expresion]
  )
  return <span className="miniatura-cara" dangerouslySetInnerHTML={{ __html: html }} />
}

function Criatura({ ajustes, cambiar }: { ajustes: AjustesGrapadora; cambiar: (c: Partial<AjustesGrapadora>) => void }): JSX.Element {
  const [semilla, setSemilla] = useState(ajustes.semilla)
  const [colorLibre, setColorLibre] = useState(ajustes.color)
  const vista = useMemo(() => svgCara(ajustes), [ajustes])

  useEffect(() => setSemilla(ajustes.semilla), [ajustes.semilla])

  return (
    <div className="grapadora-ajustes">
      <div className="formulario">
        <span className="pixel etiqueta-seccion">Cara</span>
        <div className="fila">
          <input
            value={semilla}
            onChange={(e) => setSemilla(e.target.value)}
            onBlur={() => semilla.trim() && semilla !== ajustes.semilla && cambiar({ semilla: semilla.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && semilla.trim() && cambiar({ semilla: semilla.trim() })}
          />
          <button className="boton" onClick={() => cambiar({ semilla: palabraAlAzar() })}>
            Barajar
          </button>
        </div>
        <p className="suave pequeno">Cualquier palabra o nombre. La misma palabra siempre dibuja la misma cara.</p>

        <span className="pixel etiqueta-seccion">Forma</span>
        <div className="rejilla-caras">
          {FORMAS.map((nombre, i) => (
            <button key={nombre} className={`opcion-cara ${ajustes.forma === i ? 'activa' : ''}`} title={nombre} onClick={() => cambiar({ forma: i })}>
              <Miniatura ajustes={ajustes} forma={i} />
            </button>
          ))}
        </div>
        <p className="suave pequeno">Auto deja que la palabra decida.</p>

        <span className="pixel etiqueta-seccion">Expresión</span>
        <div className="rejilla-caras">
          {EXPRESIONES.map((nombre, i) => (
            <button key={nombre} className={`opcion-cara ${ajustes.expresion === i ? 'activa' : ''}`} title={nombre} onClick={() => cambiar({ expresion: i })}>
              <Miniatura ajustes={ajustes} expresion={i} />
            </button>
          ))}
        </div>
        <p className="suave pequeno">La pose que mantiene. Parpadea y respira sola.</p>

        <span className="pixel etiqueta-seccion">Tamaño</span>
        <input type="range" min={40} max={160} value={ajustes.tamano} onChange={(e) => cambiar({ tamano: Number(e.target.value) })} />
        <p className="suave pequeno">{ajustes.tamano} px de ancho.</p>

        <span className="pixel etiqueta-seccion">Color</span>
        <div className="paleta">
          {COLORES_GRAPADORA.map((c) => (
            <button
              key={c}
              className={`muestra-color ${ajustes.color.toLowerCase() === c ? 'activa' : ''}`}
              style={{ background: c }}
              onClick={() => {
                setColorLibre(c)
                cambiar({ color: c })
              }}
              aria-label={c}
            />
          ))}
        </div>
        <div className="fila">
          <span className="muestra-color activa" style={{ background: esColorValido(colorLibre) ? colorLibre : ajustes.color }} />
          <span>Propio</span>
          <input
            className="entrada-corta mono"
            value={colorLibre}
            onChange={(e) => {
              setColorLibre(e.target.value)
              if (esColorValido(e.target.value)) cambiar({ color: e.target.value.trim() })
            }}
          />
          <span className="suave pequeno">cualquier hex, como #3A7BD5.</span>
        </div>
        <p className="suave pequeno">El mostaza es el de la app. Cualquier hex funciona.</p>

        <span className="pixel etiqueta-seccion">Opacidad</span>
        <input type="range" min={30} max={100} value={ajustes.opacidad} onChange={(e) => cambiar({ opacidad: Number(e.target.value) })} />
        <p className="suave pequeno">{ajustes.opacidad}% mientras descansa. Se ve completa cuando la abres.</p>
      </div>
      <aside className="vista-previa">
        <strong>Vista previa</strong>
        <div className="vista-previa-fondo">
          <div style={{ width: ajustes.tamano, height: ajustes.tamano, opacity: ajustes.opacidad / 100 }} dangerouslySetInnerHTML={{ __html: vista }} />
        </div>
      </aside>
    </div>
  )
}

function Acciones({ ajustes, cambiar }: { ajustes: AjustesGrapadora; cambiar: (c: Partial<AjustesGrapadora>) => void }): JSX.Element {
  const activas = ajustes.acciones
  const mover = (id: AccionGrapadora, d: number): void => {
    const i = activas.indexOf(id)
    const j = i + d
    if (i < 0 || j < 0 || j >= activas.length) return
    const lista = [...activas]
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    cambiar({ acciones: lista })
  }
  return (
    <div className="formulario">
      <p className="suave">Lo que aparece alrededor de la grapadora al hacerle clic, en este orden. Arrástrala para moverla de lugar.</p>
      {[...activas, ...ACCIONES.map((a) => a.id).filter((id) => !activas.includes(id))].map((id) => {
        const a = ACCIONES.find((x) => x.id === id)!
        const activa = activas.includes(id)
        return (
          <div key={id} className={`fila fila-accion ${activa ? '' : 'apagada'}`}>
            <label className="interruptor">
              <input
                type="checkbox"
                checked={activa}
                onChange={(e) => cambiar({ acciones: e.target.checked ? [...activas, id] : activas.filter((x) => x !== id) })}
              />
              <span />
            </label>
            <strong>{a.nombre}</strong>
            <span className="suave pequeno crece">{a.detalle}</span>
            {activa && (
              <>
                <button className="boton-mini" onClick={() => mover(id, -1)} aria-label="Subir">
                  ↑
                </button>
                <button className="boton-mini" onClick={() => mover(id, 1)} aria-label="Bajar">
                  ↓
                </button>
              </>
            )}
          </div>
        )
      })}
      <div className="fila">
        <button className="boton" onClick={() => void accion({ tipo: 'grapadora:captura' }).then((r) => r && avisar('Captura guardada'))}>
          Probar una captura ahora
        </button>
      </div>
    </div>
  )
}

function Capturas(): JSX.Element {
  const agentes = useAgentes()
  const [capturas, setCapturas] = useState<Captura[] | null>(null)
  const [para, setPara] = useState('michael')

  const leer = (): void => {
    void accion({ tipo: 'grapadora:capturas' }).then((c) => setCapturas(c ?? []))
  }
  useEffect(leer, [])

  if (capturas === null) return <Vacio>Cargando…</Vacio>
  return (
    <div className="formulario">
      <div className="fila">
        <button
          className="boton boton-mostaza"
          onClick={() =>
            void accion({ tipo: 'grapadora:captura' }).then((r) => {
              if (r) avisar('Captura guardada')
              leer()
            })
          }
        >
          <Icono nombre="expandir" /> Capturar pantalla
        </button>
        <span className="espaciador" />
        <span className="suave pequeno">mandar a</span>
        <select value={para} onChange={(e) => setPara(e.target.value)}>
          {agentes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </div>
      {capturas.length === 0 ? (
        <Vacio>Sin capturas. Haz clic en la grapadora y elige Captura: se guardan aquí.</Vacio>
      ) : (
        <div className="rejilla-capturas">
          {capturas.map((c) => (
            <figure key={c.archivo} className="captura">
              {c.miniatura ? <img src={c.miniatura} alt={c.archivo} /> : <div className="vacio">sin vista</div>}
              <figcaption>
                <span className="suave pequeno">{fecha(c.creada)}</span>
                <span className="espaciador" />
                <button
                  className="boton-mini"
                  onClick={() =>
                    void intentar({
                      tipo: 'agente:enviar',
                      id: para,
                      texto: `Te dejo una captura de pantalla: ${c.ruta}\nÁbrela con tu herramienta para leer archivos (es PNG).`,
                      modo: 'cola'
                    }).then((ok) => ok && avisar('Enviada'))
                  }
                >
                  mandar
                </button>
                <button
                  className="boton-mini"
                  onClick={() => void navigator.clipboard.writeText(c.ruta).then(() => avisar('Ruta copiada'))}
                  title={c.ruta}
                >
                  ruta
                </button>
                <button className="boton-mini" onClick={() => void accion({ tipo: 'grapadora:borrarCaptura', archivo: c.archivo }).then(leer)}>
                  <Icono nombre="papelera" tamano={12} />
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
