import { useState } from 'react'
import { intentar, useOficina } from '../tienda'

/**
 * Lo que le falta a esta Mac para que la oficina trabaje (Claude Code, git) y
 * si hay una versión nueva. Se puede cerrar; vuelve en la próxima apertura si
 * sigue pasando.
 */
export function AvisoSistema(): JSX.Element | null {
  const sistema = useOficina((e) => e.sistema)
  const [cerrados, setCerrados] = useState<string[]>([])
  if (!sistema) return null

  const avisos: Array<{ id: string; texto: string; boton?: { texto: string; accion: () => void }; importante?: boolean }> = []
  if (!sistema.requisitos.claude) {
    avisos.push({
      id: 'claude',
      importante: true,
      texto:
        'No encuentro Claude Code en esta Mac y los agentes lo necesitan. Instálalo, ábrelo una vez en la Terminal con «claude» para iniciar sesión y vuelve: este aviso se quita solo.',
      boton: { texto: 'cómo instalarlo', accion: () => void intentar({ tipo: 'sistema:abrir', destino: 'claude' }) }
    })
  }
  if (!sistema.requisitos.git) {
    avisos.push({
      id: 'git',
      texto:
        'Falta git (viene con las herramientas de desarrollo de Apple). Sin él la memoria de la oficina no guarda historial, no se descargan skills y no se pueden aislar agentes en ramas.',
      boton: { texto: 'instalar', accion: () => void intentar({ tipo: 'sistema:instalarGit' }) }
    })
  }
  if (sistema.actualizacion) {
    avisos.push({
      id: `version-${sistema.actualizacion.version}`,
      texto: `Hay una versión nueva de minioffice (${sistema.actualizacion.version}).`,
      boton: { texto: 'descargar', accion: () => void intentar({ tipo: 'sistema:abrir', destino: 'descarga' }) }
    })
  }
  const visibles = avisos.filter((a) => !cerrados.includes(a.id))
  if (visibles.length === 0) return null

  return (
    <div className="avisos-sistema">
      {visibles.map((a) => (
        <div key={a.id} className={`aviso-sistema ${a.importante ? 'importante' : ''}`} role="status">
          <span className="crece">{a.texto}</span>
          {a.boton && (
            <button className="boton-mini" onClick={a.boton.accion}>
              {a.boton.texto}
            </button>
          )}
          <button className="boton-mini" aria-label="cerrar aviso" onClick={() => setCerrados((c) => [...c, a.id])}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
