import { useCallback, useEffect, useState } from 'react'
import type { ResultadoMemoria } from '../../../shared/acciones'
import { accion, intentar, useAgentes } from '../../tienda'
import { fecha } from '../../formato'
import { Icono, Retrato, Vacio } from '../basicos'

type Vista = 'resultados' | 'pizarra' | 'agente'

const TIPOS: Array<{ id: ResultadoMemoria['tipo']; nombre: string }> = [
  { id: 'memoria', nombre: 'Memorias' },
  { id: 'pizarra', nombre: 'Pizarra' },
  { id: 'mensaje', nombre: 'Mensajes' },
  { id: 'tarea', nombre: 'Tareas' }
]

export function PestanaMemoria(): JSX.Element {
  const agentes = useAgentes()
  const [vista, setVista] = useState<Vista>('resultados')
  const [consulta, setConsulta] = useState('')
  const [filtroAgentes, setFiltroAgentes] = useState<string[]>([])
  const [filtroTipos, setFiltroTipos] = useState<string[]>([])
  const [resultados, setResultados] = useState<ResultadoMemoria[] | null>(null)
  const [agenteVisto, setAgenteVisto] = useState<string>('michael')

  const buscar = useCallback(async () => {
    const r = await accion({ tipo: 'memoria:buscar', consulta, agentes: filtroAgentes, tipos: filtroTipos })
    setResultados(r ?? [])
  }, [consulta, filtroAgentes, filtroTipos])

  useEffect(() => {
    const t = setTimeout(() => void buscar(), 250)
    return () => clearTimeout(t)
  }, [buscar])

  const alternar = (lista: string[], valor: string): string[] => (lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor])
  const agente = (id?: string): (typeof agentes)[number] | undefined => agentes.find((a) => a.id === id)

  return (
    <div className="pestana-contenido memoria">
      <div className="barra-herramientas">
        <strong className="pixel">Memoria</strong>
        <span className="suave pequeno">búsqueda local en lo que la oficina sabe</span>
        <span className="espaciador" />
        <div className="segmentado">
          <button className={vista === 'resultados' ? 'activo' : ''} onClick={() => setVista('resultados')}>
            Resultados
          </button>
          <button className={vista === 'pizarra' ? 'activo' : ''} onClick={() => setVista('pizarra')}>
            Pizarra
          </button>
          <button className={vista === 'agente' ? 'activo' : ''} onClick={() => setVista('agente')}>
            Por agente
          </button>
        </div>
      </div>

      {vista === 'resultados' && (
        <>
          <div className="buscador buscador-grande">
            <Icono nombre="buscar" />
            <input autoFocus value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Busca en la memoria de todos los agentes" />
          </div>
          <div className="filtros-memoria">
            <span className="pixel etiqueta-seccion">De quién</span>
            <div className="chips">
              <button className={`chip ${filtroAgentes.length === 0 ? 'activo' : ''}`} onClick={() => setFiltroAgentes([])}>
                Todos
              </button>
              {agentes.map((a) => (
                <button
                  key={a.id}
                  className={`chip chip-con-retrato ${filtroAgentes.includes(a.id) ? 'activo' : ''}`}
                  onClick={() => setFiltroAgentes((x) => alternar(x, a.id))}
                >
                  <Retrato personaje={a.personaje} tamano={16} />
                  {a.nombre.split(' ')[0]}
                </button>
              ))}
            </div>
            <span className="pixel etiqueta-seccion">Tipo</span>
            <div className="chips">
              <button className={`chip ${filtroTipos.length === 0 ? 'activo' : ''}`} onClick={() => setFiltroTipos([])}>
                Todo
              </button>
              {TIPOS.map((t) => (
                <button key={t.id} className={`chip ${filtroTipos.includes(t.id) ? 'activo' : ''}`} onClick={() => setFiltroTipos((x) => alternar(x, t.id))}>
                  {t.nombre}
                </button>
              ))}
            </div>
          </div>
          {resultados === null ? (
            <Vacio>Buscando…</Vacio>
          ) : resultados.length === 0 ? (
            <Vacio>
              {consulta ? 'Nada coincide.' : 'Todavía no hay memoria.'} Los agentes anotan en <code>.hive/agentes/&lt;id&gt;/memoria.md</code> y en la
              pizarra compartida.
            </Vacio>
          ) : (
            <>
              <p className="suave pequeno">{resultados.length} resultados</p>
              <div className="resultados">
                {resultados.map((r, i) => {
                  const a = agente(r.agente)
                  return (
                    <article key={i} className="tarjeta-resultado">
                      <div className="fila">
                        <span className={`tipo-evento tipo-${r.tipo}`}>{r.tipo}</span>
                        <strong className="recorte crece">{r.titulo}</strong>
                        {r.ts && <time className="suave pequeno">{fecha(r.ts)}</time>}
                      </div>
                      <p className="fragmento">{r.fragmento}</p>
                      {a && (
                        <div className="fila suave pequeno">
                          <Retrato personaje={a.personaje} tamano={16} /> {a.nombre}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {vista === 'pizarra' && <Pizarra />}

      {vista === 'agente' && (
        <>
          <div className="chips">
            {agentes.map((a) => (
              <button key={a.id} className={`chip chip-con-retrato ${agenteVisto === a.id ? 'activo' : ''}`} onClick={() => setAgenteVisto(a.id)}>
                <Retrato personaje={a.personaje} tamano={16} />
                {a.nombre.split(' ')[0]}
              </button>
            ))}
          </div>
          <MemoriaAgente id={agenteVisto} />
        </>
      )}
    </div>
  )
}

function Pizarra(): JSX.Element {
  const [texto, setTexto] = useState<string | null>(null)
  const [original, setOriginal] = useState('')

  useEffect(() => {
    void accion({ tipo: 'pizarra:leer' }).then((t) => {
      setTexto(t ?? '')
      setOriginal(t ?? '')
    })
  }, [])

  if (texto === null) return <Vacio>Cargando…</Vacio>
  return (
    <div className="pizarra">
      <p className="suave pequeno">
        La pizarra es de todos: cada agente la lee al empezar. Anota aquí acuerdos, rutas y reglas del proyecto.
      </p>
      <textarea className="mono crece" value={texto} onChange={(e) => setTexto(e.target.value)} spellCheck={false} />
      <div className="fila">
        <span className="suave pequeno">{texto === original ? 'guardado' : 'sin guardar'}</span>
        <span className="espaciador" />
        <button className="boton" disabled={texto === original} onClick={() => setTexto(original)}>
          descartar
        </button>
        <button
          className="boton boton-oscuro"
          disabled={texto === original}
          onClick={() => void intentar({ tipo: 'pizarra:guardar', texto }).then((ok) => ok && setOriginal(texto))}
        >
          guardar
        </button>
      </div>
    </div>
  )
}

function MemoriaAgente({ id }: { id: string }): JSX.Element {
  const [texto, setTexto] = useState<string | null>(null)
  useEffect(() => {
    setTexto(null)
    void accion({ tipo: 'memoria:leer', id }).then((t) => setTexto(t ?? ''))
  }, [id])
  if (texto === null) return <Vacio>Cargando…</Vacio>
  if (!texto.trim()) return <Vacio>Todavía no ha anotado nada.</Vacio>
  return <pre className="memoria-texto">{texto}</pre>
}
