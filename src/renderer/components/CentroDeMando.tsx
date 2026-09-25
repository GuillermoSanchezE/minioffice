import { useState } from 'react'
import type { Agente } from '../../shared/types'
import { MODOS_PERMISOS } from '../../shared/motores'
import { accion, useOficina } from '../tienda'
import { cambiarUi, useUi, type Pestana } from '../ui'
import { ChipEstado, Icono, Retrato } from './basicos'
import { VistaTerminal } from './VistaTerminal'
import { Cola } from './Cola'
import { PestanaMonitor } from './pestanas/Monitor'
import { PestanaTareas } from './pestanas/Tareas'
import { PestanaPreguntas } from './pestanas/Preguntas'
import { PestanaBandeja } from './pestanas/Bandeja'
import { PestanaDisparadores } from './pestanas/Disparadores'
import { PestanaMemoria } from './pestanas/Memoria'
import { PestanaGrafo } from './pestanas/Grafo'
import { PestanaActividad } from './pestanas/Actividad'
import { PestanaComandos } from './pestanas/Comandos'
import { PestanaTemporales } from './pestanas/Temporales'
import { PestanaCapacidades } from './pestanas/Capacidades'
import { PestanaEquipo } from './pestanas/Equipo'
import { PestanaGrapadora } from './pestanas/Grapadora'

const PESTANAS: Array<{ id: Pestana; nombre: string; icono: string }> = [
  { id: 'terminal', nombre: 'terminal', icono: 'terminal' },
  { id: 'monitor', nombre: 'monitor', icono: 'monitor' },
  { id: 'tareas', nombre: 'tareas', icono: 'tareas' },
  { id: 'preguntas', nombre: 'pregúntame', icono: 'campana' },
  { id: 'bandeja', nombre: 'bandeja', icono: 'bandeja' },
  { id: 'disparadores', nombre: 'disparadores', icono: 'reloj' },
  { id: 'memoria', nombre: 'memoria', icono: 'chispa' },
  { id: 'grafo', nombre: 'grafo', icono: 'grafo' },
  { id: 'actividad', nombre: 'actividad', icono: 'actividad' },
  { id: 'comandos', nombre: 'comandos', icono: 'codigo' },
  { id: 'temporales', nombre: 'temporales', icono: 'chispa' },
  { id: 'capacidades', nombre: 'capacidades', icono: 'pieza' },
  { id: 'equipo', nombre: 'equipo', icono: 'personas' },
  { id: 'grapadora', nombre: 'grapadora', icono: 'grapadora' }
]

export function CentroDeMando({ michael, sinPestanas = false }: { michael: Agente; sinPestanas?: boolean }): JSX.Element {
  const { pestana } = useUi()
  const ajustes = useOficina((e) => e.ajustes)
  const pendientes = useOficina((e) => e.preguntas.filter((p) => !p.respuesta).length) ?? 0
  const [menuModo, setMenuModo] = useState(false)
  const auto = ajustes && ajustes.modoPermisos !== 'manual'

  return (
    <div className="centro">
      <header className="panel-cabecera">
        <Retrato personaje={michael.personaje} tamano={40} />
        <div className="cabecera-datos">
          <h2 className="pixel">Centro de mando</h2>
          <div className="fila">
            <ChipEstado estado={michael.rt.estado} />
            <span className="suave">Michael dirige la oficina</span>
          </div>
        </div>
        <div className="cabecera-botones">
          <div className="menu-contenedor">
            <button
              className={`boton ${auto ? 'boton-activo' : ''}`}
              onClick={() => setMenuModo((v) => !v)}
              title="Cuánto permiso tienen los agentes para actuar solos"
            >
              <Icono nombre="play" /> {auto ? MODOS_PERMISOS.find((m) => m.id === ajustes?.modoPermisos)?.nombre.toLowerCase() : 'auto'}
            </button>
            {menuModo && ajustes && (
              <div className="menu" onMouseLeave={() => setMenuModo(false)}>
                {MODOS_PERMISOS.map((m) => (
                  <button
                    key={m.id}
                    className={`menu-opcion ${ajustes.modoPermisos === m.id ? 'activa' : ''}`}
                    onClick={() => {
                      void accion({ tipo: 'ajustes:guardar', ajustes: { modoPermisos: m.id } })
                      setMenuModo(false)
                    }}
                  >
                    <strong>{m.nombre}</strong>
                    <span className="suave">{m.detalle}</span>
                  </button>
                ))}
                <p className="suave pequeno menu-nota">Se aplica a las sesiones que se inicien desde ahora.</p>
              </div>
            )}
          </div>
          <button className="boton" onClick={() => void accion({ tipo: 'agente:ide', id: michael.id })}>
            <Icono nombre="codigo" /> IDE
          </button>
        </div>
      </header>

      <nav className="pestanas" hidden={sinPestanas}>
        {PESTANAS.map((p) => (
          <button key={p.id} className={`pestana ${pestana === p.id ? 'activa' : ''}`} onClick={() => cambiarUi({ pestana: p.id })}>
            <Icono nombre={p.icono} />
            {p.nombre}
            {p.id === 'preguntas' && pendientes > 0 && <span className="insignia">{pendientes}</span>}
          </button>
        ))}
      </nav>

      <div className="panel-contenido">
        {pestana === 'terminal' && <VistaTerminal agente={michael} />}
        {pestana === 'monitor' && <PestanaMonitor />}
        {pestana === 'tareas' && <PestanaTareas />}
        {pestana === 'preguntas' && <PestanaPreguntas />}
        {pestana === 'bandeja' && <PestanaBandeja />}
        {pestana === 'disparadores' && <PestanaDisparadores />}
        {pestana === 'memoria' && <PestanaMemoria />}
        {pestana === 'grafo' && <PestanaGrafo />}
        {pestana === 'actividad' && <PestanaActividad />}
        {pestana === 'comandos' && <PestanaComandos />}
        {pestana === 'temporales' && <PestanaTemporales />}
        {pestana === 'capacidades' && <PestanaCapacidades />}
        {pestana === 'equipo' && <PestanaEquipo />}
        {pestana === 'grapadora' && <PestanaGrapadora />}
      </div>

      {pestana === 'terminal' && <Cola agente={michael} menciones />}
    </div>
  )
}
