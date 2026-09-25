import { useEffect, useRef } from 'react'
import type { AgenteConEstado } from '../../shared/api'
import { EscenaOficina } from '../oficina/EscenaOficina'

interface Props {
  agentes: AgenteConEstado[]
  seleccionado: string | null
  onSeleccionar: (agentId: string) => void
}

export function PisoOficina({ agentes, seleccionado, onSeleccionar }: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const escenaRef = useRef<EscenaOficina | null>(null)
  const alSeleccionarRef = useRef(onSeleccionar)
  alSeleccionarRef.current = onSeleccionar

  useEffect(() => {
    const escena = new EscenaOficina(hostRef.current!, (id) => alSeleccionarRef.current(id))
    escenaRef.current = escena
    const dejarDeEscuchar = window.minioffice.onMensajeHive((msg) => escena.enviarSobre(msg.de, msg.para))
    return () => {
      dejarDeEscuchar()
      escena.destruir()
      escenaRef.current = null
    }
  }, [])

  useEffect(() => {
    escenaRef.current?.sincronizar(agentes)
  }, [agentes])

  useEffect(() => {
    escenaRef.current?.seleccionar(seleccionado)
  }, [seleccionado])

  return (
    <div className="piso-oficina">
      <div className="piso-lienzo" ref={hostRef} />
      <p className="piso-ayuda">Rueda: acercar · Arrastrar: moverse · Doble clic: ver todo</p>
    </div>
  )
}
