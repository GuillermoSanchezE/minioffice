import { useMemo, useState } from 'react'
import type { SkillOficina } from '../../shared/acciones'
import { AREAS, PUESTOS, type AreaSkill } from '../../shared/skills'
import { accion, avisar } from '../tienda'
import { NOMBRE_FUENTE, recargarSkills, useSkills } from '../skills'
import { Icono, Vacio } from './basicos'

/** Una skill con su explicación en español; la casilla la asigna o la quita. */
export function FilaSkill({
  skill,
  marcada,
  onCambiar,
  sugerida
}: {
  skill: SkillOficina
  marcada?: boolean
  onCambiar?: (marcada: boolean) => void
  sugerida?: boolean
}): JSX.Element {
  const [explicando, setExplicando] = useState(false)
  const id = `skill-${skill.fuente}-${skill.nombre}`

  async function explicar(): Promise<void> {
    setExplicando(true)
    const r = await accion({ tipo: 'skills:explicar', nombre: skill.nombre })
    setExplicando(false)
    if (r) await recargarSkills()
  }

  return (
    <div className={`fila-skill ${marcada ? 'marcada' : ''}`}>
      {onCambiar && !skill.global ? (
        <input id={id} type="checkbox" checked={!!marcada} onChange={(e) => onCambiar(e.target.checked)} />
      ) : skill.global ? (
        <span className="skill-global" title="Está en ~/.claude/skills: la ven todos los agentes de Claude Code">
          ●
        </span>
      ) : (
        <span />
      )}
      <label htmlFor={id} className="skill-cuerpo">
        <span className="skill-cabecera">
          <strong className="mono">{skill.nombre}</strong>
          <span className={`insignia-fuente fuente-${skill.fuente}`}>{NOMBRE_FUENTE[skill.fuente]}</span>
          {sugerida && <span className="insignia-sugerida">sugerida</span>}
          {!skill.instalada && <span className="suave pequeno">se descarga al asignarla</span>}
          {skill.requiere && <span className="suave pequeno">necesita {skill.requiere}</span>}
        </span>
        {skill.resumen ? (
          <span className="skill-resumen">{skill.resumen}</span>
        ) : (
          <span className="skill-resumen suave">
            {skill.descripcion.slice(0, 220)}
            {skill.descripcion.length > 220 ? '…' : ''}{' '}
            <button
              type="button"
              className="boton-mini"
              disabled={explicando}
              onClick={(e) => {
                e.preventDefault()
                void explicar()
              }}
            >
              {explicando ? 'explicando…' : 'explicar en español'}
            </button>
          </span>
        )}
      </label>
    </div>
  )
}

/**
 * Elegir las skills de un agente: primero las sugeridas para su puesto, luego
 * todo el catálogo por área. Cada una dice para qué sirve antes de marcarla.
 */
export function SelectorSkills({
  personaje,
  seleccion,
  onCambiar,
  proveedor
}: {
  personaje: string
  seleccion: string[]
  onCambiar: (skills: string[]) => void
  proveedor: string
}): JSX.Element {
  const skills = useSkills()
  const [area, setArea] = useState<AreaSkill | 'todas'>('todas')
  const [busqueda, setBusqueda] = useState('')
  const puesto = PUESTOS[personaje]
  const sugeridas = puesto?.skills ?? []

  const asignables = useMemo(() => (skills ?? []).filter((x) => !x.global), [skills])
  const globales = useMemo(() => (skills ?? []).filter((x) => x.global), [skills])
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return asignables.filter(
      (x) =>
        !sugeridas.includes(x.nombre) &&
        (area === 'todas' || x.area === area) &&
        (!q || `${x.nombre} ${x.resumen} ${x.descripcion}`.toLowerCase().includes(q))
    )
  }, [asignables, sugeridas, area, busqueda])

  const cambiar = (nombre: string, marcada: boolean): void =>
    onCambiar(marcada ? [...new Set([...seleccion, nombre])] : seleccion.filter((x) => x !== nombre))

  if (!skills) return <Vacio>Cargando skills…</Vacio>

  return (
    <div className="selector-skills">
      {proveedor !== 'claude' && (
        <p className="alerta pequeno">Las skills se cargan en sesiones de Claude Code. Este agente usa otro motor, así que no las recibirá.</p>
      )}
      {sugeridas.length > 0 && (
        <section className="bloque-skills">
          <div className="fila">
            <span className="etiqueta-campo">Sugeridas para su puesto · {puesto?.puesto}</span>
            <span className="espaciador" />
            <button
              type="button"
              className="boton"
              disabled={sugeridas.every((x) => seleccion.includes(x))}
              onClick={() => onCambiar([...new Set([...seleccion, ...sugeridas])])}
            >
              marcar todas las sugeridas
            </button>
          </div>
          {sugeridas.map((n) => {
            const skill = asignables.find((x) => x.nombre === n)
            return skill ? <FilaSkill key={n} skill={skill} sugerida marcada={seleccion.includes(n)} onCambiar={(m) => cambiar(n, m)} /> : null
          })}
        </section>
      )}

      <section className="bloque-skills">
        <div className="fila">
          <span className="etiqueta-campo">Todas las skills</span>
          <span className="espaciador" />
          <div className="buscador">
            <Icono nombre="buscar" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar skill" aria-label="Buscar skill" />
          </div>
        </div>
        <div className="chips">
          <button type="button" className={`chip ${area === 'todas' ? 'activo' : ''}`} onClick={() => setArea('todas')}>
            Todas
          </button>
          {AREAS.map((a) => (
            <button type="button" key={a} className={`chip ${area === a ? 'activo' : ''}`} onClick={() => setArea(a)}>
              {a}
            </button>
          ))}
        </div>
        {visibles.length === 0 ? (
          <p className="suave">Nada con ese filtro.</p>
        ) : (
          visibles.map((x) => <FilaSkill key={`${x.fuente}-${x.nombre}`} skill={x} marcada={seleccion.includes(x.nombre)} onCambiar={(m) => cambiar(x.nombre, m)} />)
        )}
      </section>

      {globales.length > 0 && (
        <section className="bloque-skills">
          <span className="etiqueta-campo">Ya las tienen todos (están en ~/.claude/skills)</span>
          {globales.map((x) => (
            <FilaSkill key={`g-${x.nombre}`} skill={x} />
          ))}
        </section>
      )}
    </div>
  )
}

/** Para mostrar las skills de un agente en una línea. */
export function ChipsSkills({ skills, max = 3 }: { skills?: string[]; max?: number }): JSX.Element | null {
  if (!skills?.length) return null
  return (
    <span className="chips-skills">
      {skills.slice(0, max).map((s) => (
        <span key={s} className="chip-skill mono">
          {s}
        </span>
      ))}
      {skills.length > max && <span className="suave pequeno">+{skills.length - max}</span>}
    </span>
  )
}

export function avisoReinicio(activa: boolean): void {
  avisar(activa ? 'Guardado. Se aplica cuando reinicies su sesión (reiniciar y continuar).' : 'Guardado. Lo tendrá al iniciar su sesión.')
}
