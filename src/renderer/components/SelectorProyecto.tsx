import { useEffect, useMemo, useState } from 'react'
import type { ProyectoClaude } from '../../shared/types'
import { accion, intentar, useOficina } from '../tienda'
import { cambiarUi } from '../ui'
import { hace } from '../formato'
import { Icono, Modal, Vacio } from './basicos'

/**
 * Elegir en qué proyecto trabaja la oficina: las carpetas donde ya usaste
 * Claude Code (con sus conversaciones) o cualquier otra.
 */
export function SelectorProyecto(): JSX.Element {
  const raiz = useOficina((e) => e.raiz) ?? ''
  const [proyectos, setProyectos] = useState<ProyectoClaude[] | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const cerrar = (): void => cambiarUi({ proyectosAbierto: false })

  useEffect(() => {
    void accion({ tipo: 'claude:proyectos' }).then((p) => setProyectos(p ?? []))
  }, [])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (proyectos ?? []).filter((p) => !q || p.ruta.toLowerCase().includes(q))
  }, [proyectos, busqueda])

  return (
    <Modal
      titulo="Abrir un proyecto"
      onCerrar={cerrar}
      ancho={680}
      pie={
        <>
          <button className="boton" onClick={() => void accion({ tipo: 'proyecto:cambiar' })}>
            <Icono nombre="carpeta" /> elegir otra carpeta…
          </button>
          <span className="espaciador" />
          <button className="boton" onClick={cerrar}>
            cancelar
          </button>
        </>
      }
    >
      <p className="suave">
        Estos son los proyectos donde ya trabajaste con Claude Code. Al abrir uno, la oficina trabaja en esa carpeta con todo lo que ya tiene; tus
        conversaciones siguen ahí y cualquier agente puede retomarlas (lápiz del agente → paso <strong>Espacio</strong>).
      </p>
      <div className="buscador">
        <Icono nombre="buscar" />
        <input autoFocus value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o ruta" />
      </div>
      {proyectos === null ? (
        <Vacio>Buscando tus proyectos…</Vacio>
      ) : visibles.length === 0 ? (
        <Vacio>
          {proyectos.length === 0
            ? 'No encontré proyectos de Claude Code en esta máquina (~/.claude/projects). Elige una carpeta.'
            : 'Nada coincide con la búsqueda.'}
        </Vacio>
      ) : (
        <div className="lista-proyectos">
          {visibles.map((p) => {
            const actual = p.ruta === raiz
            return (
              <article key={p.ruta} className={`fila-proyecto ${actual ? 'actual' : ''}`}>
                <Icono nombre="carpeta" tamano={18} />
                <div className="crece">
                  <strong>{p.nombre}</strong>
                  <div className="mono suave pequeno recorte" title={p.ruta}>
                    {p.ruta}
                  </div>
                  <div className="suave pequeno">
                    {p.conversaciones} {p.conversaciones === 1 ? 'conversación' : 'conversaciones'} · última actividad {hace(p.ultimo)}
                  </div>
                </div>
                {actual ? (
                  <span className="insignia-jefe">abierto</span>
                ) : (
                  <button className="boton boton-mostaza" onClick={() => void intentar({ tipo: 'proyecto:abrir', ruta: p.ruta })}>
                    abrir
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
