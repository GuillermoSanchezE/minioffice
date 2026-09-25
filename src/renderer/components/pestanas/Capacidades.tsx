import { useEffect, useMemo, useState } from 'react'
import type { Agente } from '../../../shared/types'
import type { Capacidad, CatalogoItem, SkillOficina } from '../../../shared/acciones'
import { CATALOGO_SKILLS, FUENTES, PUESTOS, type FuenteSkill } from '../../../shared/skills'
import { accion, avisar, intentar, useAgentes } from '../../tienda'
import { cambiarUi, useUi } from '../../ui'
import { NOMBRE_FUENTE, recargarSkills, useSkills } from '../../skills'
import { Icono, Modal, Retrato, Vacio } from '../basicos'
import { ChipsSkills, FilaSkill, SelectorSkills, avisoReinicio } from '../SelectorSkills'

type Vista = 'agentes' | 'catalogo' | 'herramientas' | 'quien'

export function PestanaCapacidades(): JSX.Element {
  const { skillsDe } = useUi()
  const [vista, setVista] = useState<Vista>('agentes')

  useEffect(() => {
    if (skillsDe) setVista('agentes')
  }, [skillsDe])

  return (
    <div className="pestana-contenido capacidades">
      <div className="barra-herramientas">
        <strong className="pixel">Capacidades</strong>
        <span className="suave pequeno">qué sabe hacer cada agente: skills y servidores MCP</span>
      </div>
      <div className="subpestanas horizontales">
        <button className={vista === 'agentes' ? 'activa' : ''} onClick={() => setVista('agentes')}>
          Skills por agente
        </button>
        <button className={vista === 'catalogo' ? 'activa' : ''} onClick={() => setVista('catalogo')}>
          Catálogo de skills
        </button>
        <button className={vista === 'herramientas' ? 'activa' : ''} onClick={() => setVista('herramientas')}>
          Servidores MCP
        </button>
        <button className={vista === 'quien' ? 'activa' : ''} onClick={() => setVista('quien')}>
          Quién tiene qué
        </button>
      </div>
      {vista === 'agentes' && <SkillsPorAgente />}
      {vista === 'catalogo' && <CatalogoSkills />}
      {vista === 'herramientas' && <McpYMotores />}
      {vista === 'quien' && <QuienTieneQue />}
    </div>
  )
}

// -------------------------------------------------------- skills por agente

async function asignar(agente: Agente, skills: string[]): Promise<void> {
  if (await intentar({ tipo: 'skills:asignar', id: agente.id, skills })) {
    avisoReinicio(agente.rt.estado !== 'detenido' && agente.rt.estado !== 'error')
    await recargarSkills()
  }
}

function SkillsPorAgente(): JSX.Element {
  const agentes = useAgentes()
  const { skillsDe } = useUi()
  const [id, setId] = useState<string | null>(skillsDe)
  const [sugeridas, setSugeridas] = useState(false)
  const agente = agentes.find((a) => a.id === id) ?? agentes.find((a) => !a.esCoordinador) ?? agentes[0]

  useEffect(() => {
    if (skillsDe) {
      setId(skillsDe)
      cambiarUi({ skillsDe: null })
    }
  }, [skillsDe])

  if (!agente) return <Vacio>No hay agentes.</Vacio>
  const activa = agente.rt.estado !== 'detenido' && agente.rt.estado !== 'error'

  return (
    <>
      <section className="aviso-catalogo">
        <div className="fila">
          <strong>Cada agente carga solo sus skills</strong>
          <span className="espaciador" />
          <button className="boton boton-mostaza" onClick={() => setSugeridas(true)}>
            Sugeridas para todo el equipo
          </button>
        </div>
        <p className="suave">
          Marca las skills de cada uno. Se guardan en la biblioteca de minioffice (<code>~/.minioffice/skills</code>) y, al iniciar su sesión,
          Claude Code recibe un plugin con solo las suyas. Así Pam carga las de diseño y Dwight las de backend, sin gastar contexto en lo que no
          usan.
        </p>
      </section>
      <div className="skills-agentes">
        <nav className="lista-agentes-skills" aria-label="Agentes">
          {agentes.map((a) => (
            <button key={a.id} className={`fila-agente-skill ${a.id === agente.id ? 'activa' : ''}`} onClick={() => setId(a.id)}>
              <Retrato personaje={a.personaje} tamano={30} />
              <span className="crece recorte">
                <strong>{a.nombre.split(' ')[0]}</strong>
                <span className="suave pequeno recorte">{a.rol}</span>
              </span>
              <span className={`cuenta-skills ${a.skills?.length ? '' : 'vacia'}`}>{a.skills?.length ?? 0}</span>
            </button>
          ))}
        </nav>
        <div className="detalle-skills">
          <div className="fila">
            <Retrato personaje={agente.personaje} tamano={44} />
            <div className="crece">
              <strong>{agente.nombre}</strong>
              <div className="suave pequeno">{agente.rol}</div>
              <ChipsSkills skills={agente.skills} max={6} />
            </div>
            {activa && (
              <button
                className="boton"
                title="Reinicia su sesión retomando la conversación, para que cargue las skills nuevas"
                onClick={() => void accion({ tipo: 'agente:reiniciar', id: agente.id, continuar: true })}
              >
                <Icono nombre="recargar" /> reiniciar y continuar
              </button>
            )}
          </div>
          <SelectorSkills personaje={agente.personaje} proveedor={agente.proveedor} seleccion={agente.skills ?? []} onCambiar={(s) => void asignar(agente, s)} />
        </div>
      </div>
      {sugeridas && <ModalSugeridas onCerrar={() => setSugeridas(false)} />}
    </>
  )
}

function ModalSugeridas({ onCerrar }: { onCerrar: () => void }): JSX.Element {
  const agentes = useAgentes().filter((a) => a.proveedor === 'claude' && PUESTOS[a.personaje])
  const [elegidos, setElegidos] = useState<string[]>(agentes.map((a) => a.id))
  const [trabajando, setTrabajando] = useState(false)

  async function aplicar(): Promise<void> {
    setTrabajando(true)
    const r = await accion({ tipo: 'skills:sugeridas', agentes: elegidos })
    setTrabajando(false)
    if (r) {
      avisar(r)
      await recargarSkills()
      onCerrar()
    }
  }

  return (
    <Modal
      titulo="Skills sugeridas para el equipo"
      onCerrar={onCerrar}
      ancho={760}
      pie={
        <>
          <span className="suave pequeno">Se suman a las que ya tengan; no se quita nada.</span>
          <span className="espaciador" />
          <button className="boton" onClick={onCerrar}>
            cancelar
          </button>
          <button className="boton boton-mostaza" disabled={trabajando || elegidos.length === 0} onClick={() => void aplicar()}>
            {trabajando ? 'descargando…' : `instalar y asignar a ${elegidos.length}`}
          </button>
        </>
      }
    >
      <p className="suave">Revisa qué recibe cada uno según su puesto en una oficina de software y web. Desmarca a quien no quieras tocar.</p>
      <div className="lista-sugeridas">
        {agentes.map((a) => {
          const puesto = PUESTOS[a.personaje]
          const marcado = elegidos.includes(a.id)
          return (
            <article key={a.id} className={`sugerida-agente ${marcado ? '' : 'apagada'}`}>
              <label className="fila">
                <input type="checkbox" checked={marcado} onChange={(e) => setElegidos((x) => (e.target.checked ? [...x, a.id] : x.filter((y) => y !== a.id)))} />
                <Retrato personaje={a.personaje} tamano={28} />
                <strong>{a.nombre.split(' ')[0]}</strong>
                <span className="suave">{puesto.puesto}</span>
              </label>
              <ul className="lista-simple">
                {puesto.skills.map((n) => {
                  const c = CATALOGO_SKILLS.find((x) => x.nombre === n)
                  return (
                    <li key={n}>
                      <span className="mono">{n}</span> {a.skills?.includes(n) ? <span className="texto-verde pequeno">(ya la tiene)</span> : null}
                      <span className="suave pequeno"> — {c?.resumen}</span>
                    </li>
                  )
                })}
              </ul>
            </article>
          )
        })}
      </div>
    </Modal>
  )
}

// --------------------------------------------------------- catálogo skills

function CatalogoSkills(): JSX.Element {
  const skills = useSkills()
  const agentes = useAgentes()
  const [ocupada, setOcupada] = useState<string | null>(null)
  const nombres = (ids: string[]): string => ids.map((id) => agentes.find((a) => a.id === id)?.nombre.split(' ')[0] ?? id).join(', ')

  async function instalar(nombre: string): Promise<void> {
    setOcupada(nombre)
    const r = await accion({ tipo: 'skills:instalar', nombres: [nombre] })
    setOcupada(null)
    if (r) avisar(r)
    await recargarSkills()
  }

  async function quitar(nombre: string): Promise<void> {
    if (await intentar({ tipo: 'skills:desinstalar', nombre })) {
      avisar(`${nombre} salió de la biblioteca`)
      await recargarSkills()
    }
  }

  if (!skills) return <Vacio>Cargando…</Vacio>
  const grupos: Array<{ clave: string; titulo: string; detalle: string; lista: SkillOficina[] }> = [
    ...(Object.keys(FUENTES) as FuenteSkill[]).map((f) => ({
      clave: f,
      titulo: FUENTES[f].nombre,
      detalle: `${FUENTES[f].resumen} De ${FUENTES[f].autor} · licencia ${FUENTES[f].licencia}.`,
      lista: skills.filter((x) => x.fuente === f)
    })),
    { clave: 'propia', titulo: 'Otras en la biblioteca', detalle: 'Skills que pusiste tú en ~/.minioffice/skills.', lista: skills.filter((x) => x.fuente === 'propia') },
    { clave: 'global', titulo: 'Globales', detalle: 'Están en ~/.claude/skills: las ven todos los agentes de Claude Code.', lista: skills.filter((x) => x.fuente === 'global') }
  ].filter((g) => g.lista.length > 0)

  return (
    <>
      {grupos.map((g) => (
        <section key={g.clave}>
          <h3 className="titulo-categoria">
            {g.titulo} <span className="suave">{g.lista.length}</span>
          </h3>
          <p className="suave pequeno">{g.detalle}</p>
          <div className="rejilla-catalogo">
            {g.lista.map((x) => (
              <article key={`${x.fuente}-${x.nombre}`} className="tarjeta-catalogo">
                <div className="fila">
                  <strong className="mono crece recorte">{x.nombre}</strong>
                  <span className="insignia-tipo">{x.area}</span>
                </div>
                {x.resumen ? <p className="pequeno">{x.resumen}</p> : <FilaSkill skill={x} />}
                {x.requiere && <p className="suave pequeno">Necesita {x.requiere}.</p>}
                {x.sugeridaPara.length > 0 && <p className="suave pequeno">Sugerida para: {nombres(x.sugeridaPara)}</p>}
                {!x.global && x.agentes.length > 0 && <p className="pequeno">Asignada a: {nombres(x.agentes)}</p>}
                <div className="fila">
                  {x.global ? (
                    <span className="pequeno suave">la tienen todos</span>
                  ) : x.instalada ? (
                    <>
                      <span className="pequeno texto-verde">✓ en la biblioteca</span>
                      <span className="espaciador" />
                      <button className="boton-mini" disabled={x.agentes.length > 0} title={x.agentes.length ? 'Primero quítasela a quien la tenga' : ''} onClick={() => void quitar(x.nombre)}>
                        quitar
                      </button>
                    </>
                  ) : (
                    <button className="boton boton-mostaza" disabled={ocupada !== null} onClick={() => void instalar(x.nombre)}>
                      {ocupada === x.nombre ? 'Descargando…' : 'Instalar'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

// ---------------------------------------------------------- servidores MCP

const NOMBRE_TIPO: Record<CatalogoItem['tipo'], string> = { skill: 'skill', mcp: 'MCP', motor: 'motor' }

function McpYMotores(): JSX.Element {
  const [catalogo, setCatalogo] = useState<CatalogoItem[] | null>(null)
  const [instaladas, setInstaladas] = useState<Capacidad[] | null>(null)
  const [instalando, setInstalando] = useState<string | null>(null)

  const recargar = (): void => {
    // Los motores (otras IA) se agregan en Ajustes → Motores de IA.
    void accion({ tipo: 'capacidades:catalogo' }).then((c) => setCatalogo((c ?? []).filter((x) => x.tipo === 'mcp')))
    void accion({ tipo: 'capacidades:listar' }).then((c) => setInstaladas((c ?? []).filter((x) => x.tipo === 'mcp')))
  }
  useEffect(recargar, [])

  async function instalar(item: CatalogoItem): Promise<void> {
    setInstalando(item.nombre)
    const r = await accion({ tipo: 'capacidades:instalar', nombre: item.nombre, tipoCapacidad: item.tipo })
    setInstalando(null)
    if (r !== undefined) avisar(`${item.nombre} instalado`)
    recargar()
  }

  if (!catalogo || !instaladas) return <Vacio>Revisando lo que tienes…</Vacio>
  return (
    <>
      <p className="suave">
        Los servidores MCP conectan a los agentes con herramientas externas (un navegador, documentación, Notion…). Se registran para tu usuario
        con <code>claude mcp add</code>. Para que un agente trabaje con otra IA (ChatGPT, Gemini…), agrégala en{' '}
        <button className="enlace" onClick={() => cambiarUi({ ajustesAbiertos: true })}>
          Ajustes → Motores de IA
        </button>
        .
      </p>
      {(['mcp'] as const).map((tipo) => (
        <section key={tipo}>
          <h3 className="titulo-categoria">{tipo === 'mcp' ? 'Servidores MCP' : 'Motores'}</h3>
          <div className="rejilla-catalogo">
            {catalogo
              .filter((c) => c.tipo === tipo)
              .map((c) => (
                <article key={c.nombre} className="tarjeta-catalogo">
                  <div className="fila">
                    <strong className="mono crece">{c.nombre}</strong>
                    <span className="insignia-tipo">{NOMBRE_TIPO[c.tipo]}</span>
                  </div>
                  <p className="suave pequeno">{c.descripcion}</p>
                  <p className="pequeno suave">{c.autor}</p>
                  <div className="fila">
                    {c.instalada ? (
                      <span className="pequeno texto-verde">✓ instalado</span>
                    ) : (
                      <button className="boton boton-mostaza" disabled={instalando !== null} onClick={() => void instalar(c)}>
                        {instalando === c.nombre ? 'Instalando…' : 'Instalar'}
                      </button>
                    )}
                    <span className="espaciador" />
                    <button className="boton-icono" title={c.comando} onClick={() => void navigator.clipboard.writeText(c.comando).then(() => avisar('Comando copiado'))}>
                      <Icono nombre="copiar" tamano={13} />
                    </button>
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}
      {instaladas.filter((x) => !catalogo.some((c) => c.nombre === x.nombre)).length > 0 && (
        <section>
          <h3 className="titulo-categoria">Otros que ya tienes</h3>
          <div className="rejilla-catalogo">
            {instaladas
              .filter((x) => !catalogo.some((c) => c.nombre === x.nombre))
              .map((x) => (
                <article key={`${x.tipo}-${x.nombre}-${x.origen}`} className="tarjeta-catalogo">
                  <div className="fila">
                    <strong className="mono crece">{x.nombre}</strong>
                    <span className="insignia-tipo">{NOMBRE_TIPO[x.tipo]}</span>
                  </div>
                  <p className="suave pequeno mono recorte">{x.origen}</p>
                </article>
              ))}
          </div>
        </section>
      )}
    </>
  )
}

// --------------------------------------------------------- quién tiene qué

function QuienTieneQue(): JSX.Element {
  const agentes = useAgentes()
  const skills = useSkills()
  const [mcp, setMcp] = useState<Capacidad[]>([])
  useEffect(() => {
    void accion({ tipo: 'capacidades:listar' }).then((c) => setMcp((c ?? []).filter((x) => x.tipo !== 'skill')))
  }, [])

  const filas = useMemo(() => (skills ?? []).filter((x) => x.global || x.agentes.length > 0 || x.instalada), [skills])
  if (!skills) return <Vacio>Cargando…</Vacio>
  if (filas.length === 0 && mcp.length === 0) return <Vacio>Todavía nadie tiene skills. Empieza por "Skills por agente".</Vacio>

  return (
    <div className="tabla-scroll">
      <p className="suave pequeno">Haz clic en una celda para dar o quitar una skill de la biblioteca. Las globales y los MCP los tienen todos.</p>
      <table className="tabla matriz">
        <thead>
          <tr>
            <th>Skill o herramienta</th>
            {agentes.map((a) => (
              <th key={a.id} title={a.nombre}>
                <Retrato personaje={a.personaje} tamano={22} titulo={a.nombre} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((x) => (
            <tr key={`${x.fuente}-${x.nombre}`} title={x.resumen || x.descripcion}>
              <td>
                <span className="mono">{x.nombre}</span> <span className={`insignia-fuente fuente-${x.fuente}`}>{NOMBRE_FUENTE[x.fuente]}</span>
              </td>
              {agentes.map((a) => {
                const tiene = x.global ? a.proveedor === 'claude' : !!a.skills?.includes(x.nombre)
                return (
                  <td key={a.id} className="centrado">
                    {x.global ? (
                      <span className={tiene ? 'marca-si' : 'suave'}>{tiene ? '●' : '·'}</span>
                    ) : (
                      <button
                        className={`celda-skill ${tiene ? 'si' : ''}`}
                        aria-label={`${tiene ? 'Quitar' : 'Dar'} ${x.nombre} a ${a.nombre}`}
                        onClick={() => void asignar(a, tiene ? (a.skills ?? []).filter((y) => y !== x.nombre) : [...(a.skills ?? []), x.nombre])}
                      >
                        {tiene ? '●' : '·'}
                      </button>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
          {mcp.map((c) => (
            <tr key={`${c.tipo}-${c.nombre}-${c.origen}`}>
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
