import { useEffect, useRef } from 'react'
import { useAgentes, useOficina } from './tienda'
import { cambiarUi, useUi, type Pestana } from './ui'
import { temaTerminales } from './terminales'
import { BarraTitulo } from './components/BarraTitulo'
import { Escenario } from './components/Escenario'
import { TiraAgentes } from './components/TiraAgentes'
import { BarraLateral } from './components/BarraLateral'
import { CentroDeMando } from './components/CentroDeMando'
import { PanelAgente } from './components/PanelAgente'
import { Asistente } from './components/Asistente'
import { Ajustes } from './components/Ajustes'
import { SelectorProyecto } from './components/SelectorProyecto'
import { Avisos } from './components/Avisos'
import { Vacio } from './components/basicos'

const PANEL_MIN = 420
const ESCENA_MIN = 420

export function App(): JSX.Element {
  const cargada = useOficina(() => true)
  const agentes = useAgentes()
  const { seleccionado, pantallaCompleta, tema, anchoPanel, asistente, ajustesAbiertos, proyectosAbierto } = useUi()

  useEffect(() => {
    document.documentElement.dataset.tema = tema
    temaTerminales(tema)
  }, [tema])

  useEffect(() => window.minioffice.onNavegar((p) => cambiarUi({ pestana: p as Pestana, seleccionado: null })), [])

  // Si el agente abierto deja la oficina, se vuelve al centro de mando.
  useEffect(() => {
    if (cargada && seleccionado && !agentes.some((a) => a.id === seleccionado)) cambiarUi({ seleccionado: null })
  }, [cargada, seleccionado, agentes])

  if (!cargada) {
    return (
      <div className="app cargando">
        <p className="pixel">Abriendo la oficina…</p>
      </div>
    )
  }

  const michael = agentes.find((a) => a.esCoordinador)
  const agente = agentes.find((a) => a.id === seleccionado && !a.esCoordinador)
  const panel = agente ? (
    <PanelAgente agente={agente} />
  ) : michael ? (
    <CentroDeMando michael={michael} sinPestanas={pantallaCompleta} />
  ) : (
    <Vacio>No hay coordinador en minioffice.config.json.</Vacio>
  )

  return (
    <div className={`app ${pantallaCompleta ? 'modo-completo' : 'modo-oficina'}`}>
      <BarraTitulo />
      {pantallaCompleta ? (
        <div className="cuerpo-completo">
          <BarraLateral />
          <main className="panel-principal">{panel}</main>
        </div>
      ) : (
        <>
          <div className="cuerpo-oficina" style={{ gridTemplateColumns: `minmax(${ESCENA_MIN}px, 1fr) 8px ${anchoPanel}px` }}>
            <Escenario />
            <Separador />
            <main className="panel-derecho">{panel}</main>
          </div>
          <TiraAgentes />
        </>
      )}
      {asistente && <Asistente inicial={asistente} />}
      {ajustesAbiertos && <Ajustes />}
      {proyectosAbierto && <SelectorProyecto />}
      <Avisos />
    </div>
  )
}

/** Arrastrar para cambiar el ancho del panel derecho. */
function Separador(): JSX.Element {
  const inicio = useRef<{ x: number; ancho: number } | null>(null)
  const { anchoPanel } = useUi()
  return (
    <div
      className="separador"
      role="separator"
      aria-orientation="vertical"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        inicio.current = { x: e.clientX, ancho: anchoPanel }
      }}
      onPointerMove={(e) => {
        if (!inicio.current) return
        const maximo = window.innerWidth - ESCENA_MIN - 40
        const ancho = Math.round(Math.min(maximo, Math.max(PANEL_MIN, inicio.current.ancho - (e.clientX - inicio.current.x))))
        cambiarUi({ anchoPanel: ancho })
      }}
      onPointerUp={() => {
        inicio.current = null
      }}
      onDoubleClick={() => cambiarUi({ anchoPanel: 560 })}
    >
      <span />
    </div>
  )
}
