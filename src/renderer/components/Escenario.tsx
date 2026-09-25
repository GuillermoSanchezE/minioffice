import { useEffect, useRef } from 'react'
import { useAgentes, useOficina } from '../tienda'
import { cambiarUi, seleccionar, useUi } from '../ui'
import { EscenaOficina } from '../oficina/EscenaOficina'
import { ID_MICHAEL } from '../../shared/reparto'

export function Escenario(): JSX.Element {
  const agentes = useAgentes()
  const verNombres = useOficina((e) => e.ajustes.verNombres) ?? true
  const paseos = useOficina((e) => e.ajustes.paseos) ?? true
  const { seleccionado } = useUi()
  const host = useRef<HTMLDivElement>(null)
  const escena = useRef<EscenaOficina | null>(null)

  useEffect(() => {
    const e = new EscenaOficina(host.current!, (id) => seleccionar(id === ID_MICHAEL ? null : id))
    escena.current = e
    const dejar = window.minioffice.onSobre((de, para) => e.enviarSobre(de, para))
    return () => {
      dejar()
      e.destruir()
      escena.current = null
    }
  }, [])

  useEffect(() => {
    escena.current?.sincronizar(
      agentes.map((a) => ({
        id: a.id,
        personaje: a.personaje,
        nombre: a.nombre,
        estado: a.rt.estado,
        herramienta: a.rt.herramienta,
        esCoordinador: a.esCoordinador
      }))
    )
  }, [agentes])

  useEffect(() => escena.current?.seleccionar(seleccionado ?? ID_MICHAEL), [seleccionado])
  useEffect(() => escena.current?.verNombres(verNombres), [verNombres])
  useEffect(() => escena.current?.permitirPaseos(paseos), [paseos])

  return (
    <div className="escenario">
      <div className="escenario-lienzo" ref={host} />
      <button className="chip-memoria" onClick={() => cambiarUi({ pestana: 'memoria', seleccionado: null })}>
        <span className="punto-memoria" /> memoria · búsqueda local
      </button>
      <p className="escenario-ayuda">rueda: acercar · arrastrar: moverse · doble clic: ver todo · clic: abrir agente</p>
    </div>
  )
}
