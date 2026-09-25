import { carpeta } from '../formato'
import { MODOS_PERMISOS } from '../../shared/motores'
import { useAgentes, useOficina } from '../tienda'
import { cambiarUi, useUi } from '../ui'
import { Icono } from './basicos'
import { IndicadorPlan } from './pestanas/Consumo'

export function BarraTitulo(): JSX.Element {
  const version = useOficina((e) => e.version)
  const raiz = useOficina((e) => e.raiz) ?? ''
  const modo = useOficina((e) => e.ajustes.modoPermisos)
  const plan = useOficina((e) => e.plan)
  const agentes = useAgentes()
  const { tema, pantallaCompleta } = useUi()
  const vivos = agentes.filter((a) => a.rt.estado !== 'detenido' && a.rt.estado !== 'error').length
  const trabajando = agentes.filter((a) => a.rt.estado === 'trabajando').length
  const nombreModo = MODOS_PERMISOS.find((m) => m.id === modo)?.nombre.toLowerCase()

  return (
    <header className="barra-titulo">
      <div className="logo" aria-hidden="true">
        <span>MINI</span>
        <span>OFFICE</span>
      </div>
      <span className="version mono">v{version ?? '…'}</span>
      <button className="chip-proyecto" onClick={() => cambiarUi({ proyectosAbierto: true })} title={`Proyecto: ${raiz}\nClic para abrir otro`}>
        <Icono nombre="carpeta" tamano={13} />
        <span className="recorte">{carpeta(raiz) || 'proyecto'}</span>
        <span aria-hidden="true">▾</span>
      </button>
      <span className="suave">{modo && modo !== 'manual' ? `modo ${nombreModo} activado` : 'modo manual'}</span>
      <span className="espaciador" />
      <IndicadorPlan plan={plan} onClick={() => cambiarUi({ pestana: 'consumo', seleccionado: null })} />
      <span className="suave pequeno estado-oficina">
        <span className={`vivo ${vivos ? 'vivo-on' : ''}`} /> {vivos} con sesión · {trabajando} trabajando
      </span>
      <div className="segmentado">
        <button className={!pantallaCompleta ? 'activo' : ''} onClick={() => cambiarUi({ pantallaCompleta: false })} title="La oficina con el centro de mando">
          Oficina
        </button>
        <button className={pantallaCompleta ? 'activo' : ''} onClick={() => cambiarUi({ pantallaCompleta: true })} title="Todo el espacio para las herramientas">
          Completa
        </button>
      </div>
      <button className="boton-icono" onClick={() => cambiarUi({ tema: tema === 'claro' ? 'oscuro' : 'claro' })} title="Cambiar tema" aria-label="Cambiar tema">
        <Icono nombre={tema === 'claro' ? 'luna' : 'sol'} />
      </button>
      <button
        className="boton-icono"
        onClick={() => cambiarUi({ pantallaCompleta: !pantallaCompleta })}
        title={pantallaCompleta ? 'Volver a la oficina' : 'Pantalla completa'}
        aria-label="Pantalla completa"
      >
        <Icono nombre={pantallaCompleta ? 'contraer' : 'expandir'} />
      </button>
      <button className="boton-icono" onClick={() => cambiarUi({ ajustesAbiertos: true })} title="Ajustes" aria-label="Ajustes">
        <Icono nombre="ajustes" />
      </button>
    </header>
  )
}
