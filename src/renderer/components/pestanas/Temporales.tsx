import { useEffect, useState } from 'react'
import type { Temporal } from '../../../shared/types'
import { MODELOS_CLAUDE } from '../../../shared/motores'
import { accion, avisar, intentar, useOficina } from '../../tienda'
import { carpeta, duracion, hace } from '../../formato'
import { Icono, Vacio } from '../basicos'

const ETIQUETA: Record<Temporal['estado'], string> = {
  corriendo: 'trabajando',
  hecho: 'terminó',
  error: 'falló',
  cancelado: 'cancelado'
}

export function PestanaTemporales(): JSX.Element {
  const temporales = useOficina((e) => e.temporales) ?? []
  const maximo = useOficina((e) => e.ajustes.maxTemporales) ?? 4
  const raiz = useOficina((e) => e.raiz) ?? ''
  const [prompt, setPrompt] = useState('')
  const [cwd, setCwd] = useState('')
  const [modelo, setModelo] = useState('claude-sonnet-5')
  const [proyectos, setProyectos] = useState<string[]>([])
  const corriendo = temporales.filter((t) => t.estado === 'corriendo').length

  useEffect(() => {
    void accion({ tipo: 'proyectos' }).then((p) => p && setProyectos(p))
  }, [])

  async function crear(): Promise<void> {
    if (!prompt.trim()) return
    const t = await accion({ tipo: 'temporal:crear', prompt, cwd: cwd || raiz, modelo })
    if (t) {
      setPrompt('')
      avisar('Temporal contratado')
    }
  }

  return (
    <div className="pestana-contenido">
      <section className="seccion">
        <div className="fila">
          <h3 className="pixel">Temporales</h3>
          <span className="suave pequeno">
            ayudantes de una sola tarea (<code>claude -p</code>) · {corriendo}/{maximo} trabajando
          </span>
          <span className="espaciador" />
          <label className="fila-compacta suave pequeno">
            máximo
            <input
              className="entrada-corta"
              type="number"
              min={1}
              max={12}
              value={maximo}
              onChange={(e) => void intentar({ tipo: 'ajustes:guardar', ajustes: { maxTemporales: Math.min(12, Math.max(1, Number(e.target.value) || 1)) } })}
            />
          </label>
        </div>
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Qué tiene que hacer el temporal. Trabaja solo, sin preguntar, y se va cuando termina."
        />
        <div className="fila">
          <select value={cwd || raiz} onChange={(e) => setCwd(e.target.value)} aria-label="Carpeta">
            {[...new Set([raiz, ...proyectos, cwd].filter(Boolean))].map((p) => (
              <option key={p} value={p}>
                {carpeta(p)}
              </option>
            ))}
          </select>
          <button
            className="boton-icono"
            title="Elegir carpeta"
            onClick={() => void accion({ tipo: 'dialogo:carpeta', inicial: cwd || raiz }).then((c) => c && setCwd(c))}
          >
            <Icono nombre="carpeta" />
          </button>
          <select value={modelo} onChange={(e) => setModelo(e.target.value)} aria-label="Modelo">
            {MODELOS_CLAUDE.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
          <span className="espaciador" />
          <button className="boton boton-mostaza" disabled={!prompt.trim() || corriendo >= maximo} onClick={() => void crear()}>
            <Icono nombre="mas" /> contratar temporal
          </button>
        </div>
      </section>

      <section className="seccion">
        <div className="fila">
          <h3 className="pixel">Historial</h3>
          <span className="espaciador" />
          <button className="boton-mini" disabled={temporales.every((t) => t.estado === 'corriendo')} onClick={() => void accion({ tipo: 'temporal:limpiar' })}>
            limpiar terminados
          </button>
        </div>
        {temporales.length === 0 ? (
          <Vacio>Sin temporales. Michael también puede contratarlos cuando algo es rápido y aislado.</Vacio>
        ) : (
          temporales.map((t) => <TarjetaTemporal key={t.id} temporal={t} />)
        )}
      </section>
    </div>
  )
}

function TarjetaTemporal({ temporal: t }: { temporal: Temporal }): JSX.Element {
  const [abierta, setAbierta] = useState(t.estado === 'corriendo')
  return (
    <article className={`tarjeta-temporal temporal-${t.estado}`}>
      <div className="fila">
        <span className={`chip-estado ${t.estado === 'corriendo' ? 'chip-trabajando' : t.estado === 'hecho' ? 'chip-inactivo' : t.estado === 'error' ? 'chip-error' : 'chip-detenido'}`}>
          <span className="chip-cuadro" />
          {ETIQUETA[t.estado]}
        </span>
        <strong className="recorte crece">{t.prompt}</strong>
        <span className="suave pequeno">
          {carpeta(t.cwd)} · {t.modelo || 'predeterminado'} · {t.estado === 'corriendo' ? duracion(t.inicio) : hace(t.fin ?? t.inicio)}
        </span>
        {t.estado === 'corriendo' && (
          <button className="boton-mini" onClick={() => void accion({ tipo: 'temporal:cancelar', id: t.id })}>
            cancelar
          </button>
        )}
        <button className="boton-mini" onClick={() => setAbierta((v) => !v)}>
          {abierta ? 'ocultar' : 'ver salida'}
        </button>
      </div>
      <p className="suave pequeno">pedido por {t.origen === 'usuario' ? 'ti' : t.origen}</p>
      {abierta && <pre className="salida-temporal">{t.salida || (t.estado === 'corriendo' ? 'trabajando…' : '(sin salida)')}</pre>}
    </article>
  )
}
