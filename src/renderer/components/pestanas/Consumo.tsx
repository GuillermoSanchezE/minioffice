import { useEffect, useMemo, useRef, useState } from 'react'
import type { EstadoPlan, HoraConsumo, LimitePlan } from '../../../shared/types'
import { MODELOS_CLAUDE } from '../../../shared/motores'
import { accion, useAgentes, useOficina } from '../../tienda'
import { dinero, hace, tokens } from '../../formato'
import { Retrato, Vacio } from '../basicos'

type Rango = 'hoy' | '7' | '30'

const HORA = 3_600_000
const DIA = 24 * HORA

function inicioDelDia(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function desdeRango(r: Rango, ahora = Date.now()): number {
  const hoy = inicioDelDia(ahora)
  return r === 'hoy' ? hoy : hoy - (Number(r) - 1) * DIA
}

const horaCorta = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })
const diaCorto = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric' })
const diaHora = new Intl.DateTimeFormat('es', { weekday: 'long', hour: '2-digit', minute: '2-digit' })

function faltan(ms: number): string {
  if (ms <= 0) return 'ya'
  const min = Math.round(ms / 60_000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h ${min % 60} min`
  return `${Math.round(h / 24)} días`
}

function nombreModelo(id: string): string {
  const base = id.replace(/-\d{8}$/, '')
  return MODELOS_CLAUDE.find((m) => m.id === base)?.nombre ?? base
}

// ------------------------------------------------------------------ plan

function Medidor({ titulo, limite, ventanaMs }: { titulo: string; limite?: LimitePlan; ventanaMs: number }): JSX.Element {
  const ahora = Date.now()
  if (!limite) {
    return (
      <article className="tarjeta-medidor">
        <span className="etiqueta-seccion">{titulo}</span>
        <p className="suave pequeno">Sin datos todavía.</p>
      </article>
    )
  }
  const reiniciado = limite.reinicia > 0 && ahora >= limite.reinicia
  const pct = reiniciado ? 0 : limite.porcentaje
  const nivel = pct >= 90 ? 'critico' : pct >= 70 ? 'alerta' : 'bien'
  const texto = nivel === 'critico' ? 'Casi al límite' : nivel === 'alerta' ? 'Cuidado' : 'Vas bien'

  // Ritmo lineal desde que empezó la ventana: ¿se llega al 100% antes del reinicio?
  let ritmo = ''
  if (!reiniciado && limite.reinicia > 0 && pct > 0) {
    const inicio = limite.reinicia - ventanaMs
    const pasado = ahora - inicio
    if (pasado > 10 * 60_000) {
      const llega = inicio + (pasado * 100) / pct
      ritmo =
        llega < limite.reinicia
          ? `A este ritmo llegas al 100% ${ventanaMs > DIA ? `el ${diaHora.format(llega)}` : `a las ${horaCorta.format(llega)}`}, antes del reinicio.`
          : 'A este ritmo no llegas al límite antes del reinicio.'
    }
  }

  return (
    <article className={`tarjeta-medidor nivel-${nivel}`}>
      <div className="fila">
        <span className="etiqueta-seccion">{titulo}</span>
        <span className="espaciador" />
        <span className={`estado-medidor estado-${nivel}`}>
          <span aria-hidden="true">{nivel === 'bien' ? '●' : nivel === 'alerta' ? '▲' : '■'}</span> {texto}
        </span>
      </div>
      <div className="cifra-medidor">
        {Math.round(pct)}
        <span className="unidad">% usado</span>
      </div>
      <div className="medidor" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={titulo}>
        <span className="medidor-relleno" style={{ width: `${pct}%` }} />
      </div>
      <p className="pequeno">
        {reiniciado
          ? 'Se reinició; el dato nuevo llega con la próxima actividad.'
          : limite.reinicia
            ? `Se reinicia en ${faltan(limite.reinicia - ahora)} (${ventanaMs > DIA ? diaHora.format(limite.reinicia) : horaCorta.format(limite.reinicia)}).`
            : ''}
      </p>
      {ritmo && <p className="suave pequeno">{ritmo}</p>}
    </article>
  )
}

function Plan({ plan }: { plan: EstadoPlan | null | undefined }): JSX.Element {
  const agentes = useAgentes()
  if (!plan) {
    return (
      <section className="aviso-catalogo">
        <strong>Tu plan de Claude</strong>
        <p className="suave">
          Aparece en cuanto un agente de Claude Code trabaja con tu suscripción (Pro o Max): Claude Code le pasa a minioffice el porcentaje usado
          de tu sesión de 5 horas y de tu semana. Si usas una clave de API no hay límites de plan; guíate por el costo.
        </p>
      </section>
    )
  }
  const quien = agentes.find((a) => a.id === plan.agente)?.nombre.split(' ')[0]
  return (
    <section className="plan">
      <div className="rejilla-medidores">
        <Medidor titulo="Sesión de 5 horas" limite={plan.cincoHoras} ventanaMs={5 * HORA} />
        <Medidor titulo="Semana" limite={plan.semana} ventanaMs={7 * DIA} />
      </div>
      <p className="suave pequeno">
        Es el mismo límite que ves en claude.ai (Ajustes → Uso): lo comparten Claude, Claude Code y esta oficina. Actualizado {hace(plan.actualizado)}
        {quien ? ` por la sesión de ${quien}` : ''}.
      </p>
    </section>
  )
}

// ------------------------------------------------------------- gráfico

interface Columna {
  clave: number
  etiqueta: string
  detalle: string
  valor: number
  costo: number
}

function useAncho<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [ancho, setAncho] = useState(600)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const o = new ResizeObserver(() => setAncho(el.clientWidth))
    o.observe(el)
    setAncho(el.clientWidth)
    return () => o.disconnect()
  }, [])
  return [ref, ancho]
}

function techoLimpio(v: number): number {
  if (v <= 0) return 1000
  const potencia = 10 ** Math.floor(Math.log10(v))
  // Múltiplos cuya mitad también es un número limpio (la rejilla marca 0, mitad y techo).
  for (const m of [1, 2, 4, 5, 10]) if (m * potencia >= v) return m * potencia
  return 10 * potencia
}

function Columnas({ columnas, cada }: { columnas: Columna[]; cada: number }): JSX.Element {
  const [ref, ancho] = useAncho<HTMLDivElement>()
  const [activa, setActiva] = useState<number | null>(null)
  const alto = 200
  const margen = { izq: 48, der: 8, arriba: 10, abajo: 24 }
  const maximo = techoLimpio(Math.max(...columnas.map((c) => c.valor), 0))
  const w = Math.max(200, ancho) - margen.izq - margen.der
  const h = alto - margen.arriba - margen.abajo
  const banda = w / Math.max(1, columnas.length)
  const grosor = Math.min(24, Math.max(3, banda - 2))
  const y = (v: number): number => margen.arriba + h - (v / maximo) * h
  const c = activa !== null ? columnas[activa] : null

  return (
    <div className="grafico" ref={ref}>
      <svg width="100%" height={alto} role="img" aria-label="Tokens por periodo">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={margen.izq} x2={margen.izq + w} y1={y(maximo * f)} y2={y(maximo * f)} className="rejilla-grafico" />
            <text x={margen.izq - 6} y={y(maximo * f)} className="eje-grafico" textAnchor="end" dominantBaseline="middle">
              {tokens(maximo * f)}
            </text>
          </g>
        ))}
        {columnas.map((col, i) => {
          const x = margen.izq + i * banda + (banda - grosor) / 2
          const top = y(col.valor)
          const altura = margen.arriba + h - top
          const r = Math.min(4, altura / 2, grosor / 2)
          return (
            <g key={col.clave}>
              {col.valor > 0 && (
                <path
                  className={`columna-dato ${activa === i ? 'activa' : ''}`}
                  d={`M${x},${margen.arriba + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + grosor - r} Q${x + grosor},${top} ${x + grosor},${top + r} V${margen.arriba + h} Z`}
                />
              )}
              {i % cada === 0 && (
                <text x={x + grosor / 2} y={alto - 6} className="eje-grafico" textAnchor="middle">
                  {col.etiqueta}
                </text>
              )}
              <rect
                x={margen.izq + i * banda}
                y={margen.arriba}
                width={banda}
                height={h}
                fill="transparent"
                tabIndex={0}
                aria-label={`${col.detalle}: ${tokens(col.valor)} tokens`}
                onPointerEnter={() => setActiva(i)}
                onPointerLeave={() => setActiva(null)}
                onFocus={() => setActiva(i)}
                onBlur={() => setActiva(null)}
              />
            </g>
          )
        })}
        <line x1={margen.izq} x2={margen.izq + w} y1={margen.arriba + h} y2={margen.arriba + h} className="base-grafico" />
      </svg>
      {c && activa !== null && (
        <div
          className="tooltip-grafico"
          style={{ left: Math.min(Math.max(margen.izq + activa * banda + banda / 2, 70), Math.max(200, ancho) - 70), top: y(c.valor) - 8 }}
        >
          <strong>{tokens(c.valor)} tokens</strong>
          <span>{dinero(c.costo)} a precio de API</span>
          <span className="suave">{c.detalle}</span>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ vista

export function PestanaConsumo(): JSX.Element {
  const agentes = useAgentes()
  const plan = useOficina((e) => e.plan)
  const [rango, setRango] = useState<Rango>('hoy')
  const [datos, setDatos] = useState<HoraConsumo[] | null>(null)
  const [anterior, setAnterior] = useState<HoraConsumo[]>([])
  const [tabla, setTabla] = useState(false)

  useEffect(() => {
    let vivo = true
    const cargar = (): void => {
      const desde = desdeRango(rango)
      // Periodo anterior comparable: ayer hasta esta misma hora, o los N días previos.
      const [previoDesde, previoHasta] =
        rango === 'hoy' ? [desde - DIA, desde - DIA + (Date.now() - desde)] : [desde - Number(rango) * DIA, desde]
      void accion({ tipo: 'consumo:historial', desde: previoDesde }).then((r) => {
        if (!vivo || !r) return
        setDatos(r.filter((h) => h.hora >= desde))
        setAnterior(r.filter((h) => h.hora >= previoDesde && h.hora < previoHasta))
      })
    }
    cargar()
    const t = setInterval(cargar, 10_000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [rango])

  const resumen = useMemo(() => {
    const lista = datos ?? []
    const total = lista.reduce((s, h) => s + h.tokens, 0)
    const costo = lista.reduce((s, h) => s + h.costo, 0)
    const previo = anterior.reduce((s, h) => s + h.tokens, 0)
    const porAgente = new Map<string, number>()
    const porModelo = new Map<string, number>()
    for (const h of lista) {
      for (const [id, v] of Object.entries(h.agentes)) porAgente.set(id, (porAgente.get(id) ?? 0) + v)
      for (const [m, v] of Object.entries(h.modelos)) porModelo.set(m, (porModelo.get(m) ?? 0) + v)
    }
    const agentesOrden = [...porAgente.entries()].sort((a, b) => b[1] - a[1])
    const modelosOrden = [...porModelo.entries()].sort((a, b) => b[1] - a[1])

    const columnas: Columna[] = []
    if (rango === 'hoy') {
      const hoy = inicioDelDia(Date.now())
      for (let i = 0; i < 24; i++) {
        const hora = hoy + i * HORA
        const h = lista.find((x) => x.hora === hora)
        columnas.push({ clave: hora, etiqueta: `${i}`, detalle: `${horaCorta.format(hora)}–${horaCorta.format(hora + HORA)}`, valor: h?.tokens ?? 0, costo: h?.costo ?? 0 })
      }
    } else {
      const dias = Number(rango)
      const desde = desdeRango(rango)
      for (let i = 0; i < dias; i++) {
        const dia = desde + i * DIA
        const delDia = lista.filter((x) => x.hora >= dia && x.hora < dia + DIA)
        columnas.push({
          clave: dia,
          etiqueta: diaCorto.format(dia),
          detalle: new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(dia),
          valor: delDia.reduce((s, x) => s + x.tokens, 0),
          costo: delDia.reduce((s, x) => s + x.costo, 0)
        })
      }
    }
    return { total, costo, previo, agentesOrden, modelosOrden, columnas }
  }, [datos, anterior, rango])

  const nombre = (id: string): string => agentes.find((a) => a.id === id)?.nombre.split(' ')[0] ?? id
  const delta = resumen.previo > 0 ? ((resumen.total - resumen.previo) / resumen.previo) * 100 : null
  const periodoPrevio = rango === 'hoy' ? 'ayer a esta hora' : `los ${rango} días anteriores`
  const maxAgente = resumen.agentesOrden[0]?.[1] ?? 1

  return (
    <div className="pestana-contenido consumo">
      <div className="barra-herramientas">
        <strong className="pixel">Consumo</strong>
        <span className="suave pequeno">lo que gasta la oficina y cuánto te queda del plan</span>
      </div>

      <Plan plan={plan} />

      <div className="fila">
        <div className="segmentado" role="group" aria-label="Periodo">
          <button className={rango === 'hoy' ? 'activo' : ''} onClick={() => setRango('hoy')}>
            Hoy
          </button>
          <button className={rango === '7' ? 'activo' : ''} onClick={() => setRango('7')}>
            7 días
          </button>
          <button className={rango === '30' ? 'activo' : ''} onClick={() => setRango('30')}>
            30 días
          </button>
        </div>
        <span className="suave pequeno">Tokens procesados por los agentes (entrada, escritura de caché y salida).</span>
      </div>

      <div className={`kpis ${datos === null ? 'cargando-datos' : ''}`}>
        <article className="kpi">
          <span className="etiqueta-kpi">Tokens</span>
          <strong className="valor-kpi">{tokens(resumen.total)}</strong>
          {delta !== null ? (
            <span className={`delta-kpi ${delta > 0 ? 'sube' : 'baja'}`}>
              {delta > 0 ? '▲' : '▼'} {delta > 900 ? `${Math.round(delta / 100 + 1)}×` : `${Math.abs(Math.round(delta))}%`} vs {periodoPrevio}
            </span>
          ) : (
            <span className="suave pequeno">sin datos de {periodoPrevio}</span>
          )}
        </article>
        <article className="kpi">
          <span className="etiqueta-kpi">Costo equivalente</span>
          <strong className="valor-kpi">{dinero(resumen.costo)}</strong>
          <span className="suave pequeno">lo que costaría por API; con tu plan no pagas esto</span>
        </article>
        <article className="kpi">
          <span className="etiqueta-kpi">Quién más gastó</span>
          <strong className="valor-kpi valor-kpi-texto">{resumen.agentesOrden[0] ? nombre(resumen.agentesOrden[0][0]) : '—'}</strong>
          <span className="suave pequeno">
            {resumen.agentesOrden[0] && resumen.total ? `${Math.round((resumen.agentesOrden[0][1] / resumen.total) * 100)}% del total` : 'nadie todavía'}
          </span>
        </article>
        <article className="kpi">
          <span className="etiqueta-kpi">Modelo más usado</span>
          <strong className="valor-kpi valor-kpi-texto">{resumen.modelosOrden[0] ? nombreModelo(resumen.modelosOrden[0][0]) : '—'}</strong>
          <span className="suave pequeno">
            {resumen.modelosOrden[0] && resumen.total ? `${Math.round((resumen.modelosOrden[0][1] / resumen.total) * 100)}% de los tokens` : ''}
          </span>
        </article>
      </div>

      <section className="tarjeta-grafico">
        <div className="fila">
          <h3>{rango === 'hoy' ? 'Tokens por hora, hoy' : `Tokens por día, últimos ${rango} días`}</h3>
          <span className="espaciador" />
          <button className="boton-mini" onClick={() => setTabla((v) => !v)}>
            {tabla ? 'ver gráfico' : 'ver tabla'}
          </button>
        </div>
        {datos === null ? (
          <Vacio>Cargando…</Vacio>
        ) : resumen.total === 0 ? (
          <Vacio>Todavía no hay consumo en este periodo. Se registra mientras los agentes de Claude Code trabajan.</Vacio>
        ) : tabla ? (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>{rango === 'hoy' ? 'Hora' : 'Día'}</th>
                  <th className="numero">Tokens</th>
                  <th className="numero">Costo API</th>
                </tr>
              </thead>
              <tbody>
                {resumen.columnas
                  .filter((c) => c.valor > 0)
                  .map((c) => (
                    <tr key={c.clave}>
                      <td>{c.detalle}</td>
                      <td className="numero">{c.valor.toLocaleString('es')}</td>
                      <td className="numero">{dinero(c.costo)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Columnas columnas={resumen.columnas} cada={rango === 'hoy' ? 3 : rango === '7' ? 1 : 5} />
        )}
      </section>

      <div className="rejilla-consumo">
        <section className="tarjeta-grafico">
          <h3>Por agente</h3>
          {resumen.agentesOrden.length === 0 ? (
            <p className="suave pequeno">Sin consumo.</p>
          ) : (
            <div className="barras-agentes">
              {resumen.agentesOrden.map(([id, v]) => {
                const a = agentes.find((x) => x.id === id)
                return (
                  <div key={id} className="fila-barra" title={`${nombre(id)}: ${v.toLocaleString('es')} tokens`}>
                    <span className="nombre-barra">
                      {a && <Retrato personaje={a.personaje} tamano={18} />}
                      {nombre(id)}
                    </span>
                    <span className="pista-barra">
                      <span className="barra-dato" style={{ width: `${Math.max(1, (v / maxAgente) * 100)}%` }} />
                    </span>
                    <span className="valor-barra mono">{tokens(v)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
        <section className="tarjeta-grafico">
          <h3>Por modelo</h3>
          {resumen.modelosOrden.length === 0 ? (
            <p className="suave pequeno">Sin consumo.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th className="numero">Tokens</th>
                  <th className="numero">%</th>
                </tr>
              </thead>
              <tbody>
                {resumen.modelosOrden.map(([m, v]) => (
                  <tr key={m}>
                    <td>{nombreModelo(m)}</td>
                    <td className="numero">{tokens(v)}</td>
                    <td className="numero">{Math.round((v / Math.max(1, resumen.total)) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}

/** Indicador compacto del plan para la barra de título. */
export function IndicadorPlan({ plan, onClick }: { plan: EstadoPlan | null | undefined; onClick: () => void }): JSX.Element | null {
  if (!plan?.cincoHoras && !plan?.semana) return null
  const ahora = Date.now()
  const pct = (l?: LimitePlan): number | null => (l ? (l.reinicia && ahora >= l.reinicia ? 0 : Math.round(l.porcentaje)) : null)
  const cinco = pct(plan.cincoHoras)
  const semana = pct(plan.semana)
  const nivel = (v: number | null): string => (v === null ? '' : v >= 90 ? 'critico' : v >= 70 ? 'alerta' : 'bien')
  return (
    <button className="indicador-plan" onClick={onClick} title="Uso de tu plan de Claude. Clic para ver el consumo.">
      {cinco !== null && (
        <span className={`mini-medidor nivel-${nivel(cinco)}`}>
          5 h <span className="mini-pista"><span style={{ width: `${cinco}%` }} /></span> {cinco}%
        </span>
      )}
      {semana !== null && (
        <span className={`mini-medidor nivel-${nivel(semana)}`}>
          sem <span className="mini-pista"><span style={{ width: `${semana}%` }} /></span> {semana}%
        </span>
      )}
    </button>
  )
}
