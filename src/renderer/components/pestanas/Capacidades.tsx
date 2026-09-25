import { useEffect, useMemo, useState } from 'react'
import type { Capacidad, CatalogoItem } from '../../../shared/acciones'
import { accion, avisar, useAgentes } from '../../tienda'
import { Icono, Modal, Retrato, Vacio } from '../basicos'

type Vista = 'catalogo' | 'instaladas' | 'quien'
type Filtro = 'todo' | CatalogoItem['tipo']

const NOMBRE_TIPO: Record<CatalogoItem['tipo'], string> = { skill: 'skill', mcp: 'MCP', motor: 'motor' }

/** Paquetes por rol: instalan de una vez lo que suele necesitar un puesto. */
const PAQUETES: Array<{ nombre: string; detalle: string; items: Array<{ nombre: string; tipo: CatalogoItem['tipo'] }> }> = [
  {
    nombre: 'Ingeniería',
    detalle: 'API de Claude, MCP propios y pruebas en navegador',
    items: [
      { nombre: 'claude-api', tipo: 'skill' },
      { nombre: 'mcp-builder', tipo: 'skill' },
      { nombre: 'webapp-testing', tipo: 'skill' },
      { nombre: 'playwright', tipo: 'mcp' },
      { nombre: 'context7', tipo: 'mcp' }
    ]
  },
  {
    nombre: 'Diseño',
    detalle: 'Dirección visual, pósters y temas',
    items: [
      { nombre: 'frontend-design', tipo: 'skill' },
      { nombre: 'canvas-design', tipo: 'skill' },
      { nombre: 'theme-factory', tipo: 'skill' }
    ]
  },
  {
    nombre: 'Oficina y documentos',
    detalle: 'Word, Excel, PowerPoint, PDF y comunicados',
    items: [
      { nombre: 'docx', tipo: 'skill' },
      { nombre: 'xlsx', tipo: 'skill' },
      { nombre: 'pptx', tipo: 'skill' },
      { nombre: 'pdf', tipo: 'skill' },
      { nombre: 'internal-comms', tipo: 'skill' }
    ]
  }
]

export function PestanaCapacidades(): JSX.Element {
  const [vista, setVista] = useState<Vista>('catalogo')
  const [filtro, setFiltro] = useState<Filtro>('todo')
  const [busqueda, setBusqueda] = useState('')
  const [catalogo, setCatalogo] = useState<CatalogoItem[] | null>(null)
  const [instaladas, setInstaladas] = useState<Capacidad[] | null>(null)
  const [instalando, setInstalando] = useState<string | null>(null)
  const [paquetes, setPaquetes] = useState(false)

  const recargar = (): void => {
    void accion({ tipo: 'capacidades:catalogo' }).then((c) => setCatalogo(c ?? []))
    void accion({ tipo: 'capacidades:listar' }).then((c) => setInstaladas(c ?? []))
  }
  useEffect(recargar, [])

  async function instalar(item: { nombre: string; tipo: CatalogoItem['tipo'] }): Promise<boolean> {
    setInstalando(`${item.tipo}:${item.nombre}`)
    const r = await accion({ tipo: 'capacidades:instalar', nombre: item.nombre, tipoCapacidad: item.tipo })
    setInstalando(null)
    if (r !== undefined) avisar(`${item.nombre} instalado`)
    recargar()
    return r !== undefined
  }

  const q = busqueda.trim().toLowerCase()
  const coincide = (x: { nombre: string; descripcion: string; tipo: CatalogoItem['tipo'] }): boolean =>
    (filtro === 'todo' || x.tipo === filtro) && (!q || `${x.nombre} ${x.descripcion}`.toLowerCase().includes(q))

  const porCategoria = useMemo(() => {
    const grupos = new Map<string, CatalogoItem[]>()
    for (const c of (catalogo ?? []).filter(coincide)) grupos.set(c.categoria, [...(grupos.get(c.categoria) ?? []), c])
    return [...grupos.entries()]
  }, [catalogo, filtro, q])

  const cuenta = (t: Filtro): number => (catalogo ?? []).filter((c) => t === 'todo' || c.tipo === t).length

  return (
    <div className="pestana-contenido capacidades">
      <div className="barra-herramientas">
        <strong className="pixel">Capacidades</strong>
        <span className="suave pequeno">lo que cada agente tiene a mano: skills, servidores MCP y motores</span>
        <span className="espaciador" />
        <div className="buscador">
          <Icono nombre="buscar" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar en el catálogo" />
        </div>
      </div>
      <div className="fila">
        <div className="subpestanas horizontales">
          <button className={vista === 'catalogo' ? 'activa' : ''} onClick={() => setVista('catalogo')}>
            Catálogo
          </button>
          <button className={vista === 'instaladas' ? 'activa' : ''} onClick={() => setVista('instaladas')}>
            Instaladas
          </button>
          <button className={vista === 'quien' ? 'activa' : ''} onClick={() => setVista('quien')}>
            Quién tiene qué
          </button>
        </div>
        <span className="espaciador" />
        <div className="segmentado">
          {(['todo', 'skill', 'mcp', 'motor'] as Filtro[]).map((t) => (
            <button key={t} className={filtro === t ? 'activo' : ''} onClick={() => setFiltro(t)}>
              {t === 'todo' ? `Todo ${cuenta('todo')}` : t === 'skill' ? 'Skills' : t === 'mcp' ? 'MCP' : 'Motores'}
            </button>
          ))}
        </div>
      </div>

      {vista === 'catalogo' && (
        <>
          <section className="aviso-catalogo">
            <div className="fila">
              <strong>Un catálogo cuidado</strong>
              <span className="insignia-curado">Curado</span>
            </div>
            <p className="suave">
              Cada skill, servidor MCP y motor de aquí se instala con las herramientas oficiales: las skills van a tu carpeta de skills de Claude Code
              (todos los agentes con Claude las ven al iniciar su próxima sesión), los MCP con <code>claude mcp add</code> y los motores con npm. Si algo
              no se puede instalar desde aquí, te muestro el comando exacto.
            </p>
            <button className="boton boton-mostaza" onClick={() => setPaquetes(true)}>
              Paquetes por rol
            </button>
          </section>
          {catalogo === null ? (
            <Vacio>Revisando lo que tienes…</Vacio>
          ) : (
            porCategoria.map(([categoria, items]) => (
              <section key={categoria}>
                <h3 className="titulo-categoria">
                  {categoria} <span className="suave">{items.length}</span>
                </h3>
                <div className="rejilla-catalogo">
                  {items.map((c) => (
                    <article key={`${c.tipo}:${c.nombre}`} className="tarjeta-catalogo">
                      <div className="fila">
                        <strong className="mono crece">{c.nombre}</strong>
                        <span className="insignia-tipo">{NOMBRE_TIPO[c.tipo]}</span>
                      </div>
                      <p className="suave pequeno">{c.descripcion}</p>
                      <p className="pequeno suave">{c.autor}</p>
                      <div className="fila">
                        {c.instalada ? (
                          <span className="pequeno texto-verde">✓ instalada</span>
                        ) : (
                          <button className="boton boton-mostaza" disabled={instalando !== null} onClick={() => void instalar(c)}>
                            {instalando === `${c.tipo}:${c.nombre}` ? 'Instalando…' : 'Instalar'}
                          </button>
                        )}
                        <span className="espaciador" />
                        <button
                          className="boton-icono"
                          title={c.comando}
                          onClick={() => void navigator.clipboard.writeText(c.comando).then(() => avisar('Comando copiado'))}
                        >
                          <Icono nombre="copiar" tamano={13} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}

      {vista === 'instaladas' &&
        (instaladas === null ? (
          <Vacio>Revisando…</Vacio>
        ) : instaladas.filter(coincide).length === 0 ? (
          <Vacio>No encontré nada instalado con ese filtro.</Vacio>
        ) : (
          <div className="rejilla-catalogo">
            {instaladas.filter(coincide).map((c) => (
              <article key={`${c.tipo}:${c.nombre}:${c.origen}`} className="tarjeta-catalogo">
                <div className="fila">
                  <strong className="mono crece">{c.nombre}</strong>
                  <span className="insignia-tipo">{NOMBRE_TIPO[c.tipo]}</span>
                </div>
                <p className="suave pequeno recorte-3">{c.descripcion}</p>
                <p className="pequeno suave mono recorte">{c.origen}</p>
                <p className="pequeno">{c.agentes.length} agentes la tienen</p>
              </article>
            ))}
          </div>
        ))}

      {vista === 'quien' && <QuienTieneQue capacidades={(instaladas ?? []).filter(coincide)} />}

      {paquetes && (
        <Modal titulo="Paquetes por rol" onCerrar={() => setPaquetes(false)} ancho={620}>
          <p className="suave">Instala de una vez lo que suele necesitar un puesto. Lo que ya tengas se salta.</p>
          {PAQUETES.map((p) => {
            const faltan = p.items.filter((i) => !catalogo?.find((c) => c.nombre === i.nombre && c.tipo === i.tipo)?.instalada)
            return (
              <article key={p.nombre} className="tarjeta-catalogo">
                <div className="fila">
                  <strong className="crece">{p.nombre}</strong>
                  {faltan.length === 0 ? (
                    <span className="pequeno texto-verde">✓ completo</span>
                  ) : (
                    <button
                      className="boton boton-mostaza"
                      disabled={instalando !== null}
                      onClick={async () => {
                        for (const i of faltan) if (!(await instalar(i))) break
                      }}
                    >
                      Instalar {faltan.length}
                    </button>
                  )}
                </div>
                <p className="suave pequeno">{p.detalle}</p>
                <p className="mono pequeno">{p.items.map((i) => i.nombre).join(' · ')}</p>
              </article>
            )
          })}
        </Modal>
      )}
    </div>
  )
}

function QuienTieneQue({ capacidades }: { capacidades: Capacidad[] }): JSX.Element {
  const agentes = useAgentes()
  if (capacidades.length === 0) return <Vacio>Nada instalado todavía.</Vacio>
  return (
    <div className="tabla-scroll">
      <table className="tabla matriz">
        <thead>
          <tr>
            <th>Capacidad</th>
            {agentes.map((a) => (
              <th key={a.id} title={a.nombre}>
                <Retrato personaje={a.personaje} tamano={22} titulo={a.nombre} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {capacidades.map((c) => (
            <tr key={`${c.tipo}:${c.nombre}:${c.origen}`}>
              <td>
                <span className="mono">{c.nombre}</span> <span className="insignia-tipo">{NOMBRE_TIPO[c.tipo]}</span>
              </td>
              {agentes.map((a) => (
                <td key={a.id} className="centrado">
                  {c.agentes.includes(a.id) ? <span className="marca-si">●</span> : <span className="suave">·</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
