import { useEffect, type ReactNode } from 'react'
import type { AgentStatus } from '../../shared/types'
import { retratoDe } from '../pixel/personajes'

export function Retrato({ personaje, tamano = 40, titulo }: { personaje: string; tamano?: number; titulo?: string }): JSX.Element {
  return (
    <img
      className="retrato"
      src={retratoDe(personaje)}
      width={tamano}
      height={Math.round(tamano * (96 / 88))}
      alt={titulo ?? ''}
      title={titulo}
      draggable={false}
    />
  )
}

const ETIQUETA: Record<AgentStatus, string> = {
  detenido: 'dormido',
  iniciando: 'iniciando',
  inactivo: 'inactivo',
  trabajando: 'trabajando',
  esperando: 'esperando',
  pausado: 'en pausa',
  error: 'error'
}

export function etiquetaEstado(estado: AgentStatus): string {
  return ETIQUETA[estado]
}

export function ChipEstado({ estado, texto }: { estado: AgentStatus; texto?: string }): JSX.Element {
  return (
    <span className={`chip-estado chip-${estado}`}>
      <span className="chip-cuadro" />
      {texto ?? ETIQUETA[estado]}
    </span>
  )
}

export function Barra({ valor, max, tono = 'teal' }: { valor: number; max: number; tono?: 'teal' | 'mostaza' | 'rojo' | 'verde' }): JSX.Element {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0
  const color = tono === 'teal' && pct >= 90 ? 'rojo' : tono === 'teal' && pct >= 70 ? 'mostaza' : tono
  return (
    <span className="barra">
      <span className={`barra-relleno barra-${color}`} style={{ width: `${pct}%` }} />
    </span>
  )
}

export function Modal({
  titulo,
  onCerrar,
  children,
  pie,
  ancho = 860
}: {
  titulo: string
  onCerrar: () => void
  children: ReactNode
  pie?: ReactNode
  ancho?: number
}): JSX.Element {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])
  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" style={{ width: `min(${ancho}px, calc(100vw - 32px))` }} role="dialog" aria-label={titulo}>
        <header className="modal-cabecera">
          <h2 className="pixel">{titulo}</h2>
          <button className="boton-icono" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </header>
        <div className="modal-cuerpo">{children}</div>
        {pie && <footer className="modal-pie">{pie}</footer>}
      </div>
    </div>
  )
}

const RUTAS: Record<string, string> = {
  luna: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  sol: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  expandir: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  contraer: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  ajustes: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.9 4a8.9 8.9 0 0 0-.2-1.8l2-1.6-2-3.4-2.4 1a9 9 0 0 0-3-1.8L15 2h-4l-.4 2.4a9 9 0 0 0-3 1.8l-2.4-1-2 3.4 2 1.6a8.9 8.9 0 0 0 0 3.6l-2 1.6 2 3.4 2.4-1a9 9 0 0 0 3 1.8L11 22h4l.4-2.4a9 9 0 0 0 3-1.8l2.4 1 2-3.4-2-1.6c.1-.6.2-1.2.2-1.8Z',
  cerrar: 'M6 6l12 12M18 6 6 18',
  lapiz: 'M4 20h4L19 9l-4-4L4 16v4Zm10-14 4 4',
  mas: 'M12 5v14M5 12h14',
  terminal: 'M4 5h16v14H4zM7 9l3 3-3 3m5 0h5',
  monitor: 'M3 13h4l3-7 4 12 3-5h4',
  consumo: 'M4 20V10m6 10V4m6 16v-7m4 7H3',
  tareas: 'M4 6h2m4 0h10M4 12h2m4 0h10M4 18h2m4 0h10',
  campana: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Zm4 4h4',
  bandeja: 'M3 13l3-8h12l3 8v6H3v-6Zm0 0h5l1 3h6l1-3h5',
  reloj: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 3',
  chispa: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M18 6l-2.5 2.5m-7 7L6 18',
  grafo: 'M6 6a2 2 0 1 0 0 .1M18 8a2 2 0 1 0 0 .1M12 18a2 2 0 1 0 0 .1M7.5 7l3.5 9M16.5 9.5 13 16.5M8 6.3l8 1.5',
  actividad: 'M4 12h4l2-6 4 12 2-6h4',
  codigo: 'M8 7l-5 5 5 5m8-10 5 5-5 5',
  engranes: 'M9 3h6v3l2 1 2-2 3 3-2 2 1 2h3v6h-3l-1 2 2 2-3 3-2-2-2 1v3H9v-3l-2-1-2 2-3-3 2-2-1-2H0',
  personas: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0 0-6m2 15a5 5 0 0 0-3-4.6',
  pieza: 'M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3h7Z',
  grapadora: 'M4 16h16v3H4zM5 16l2-6h10l2 6M9 10V6h6v4',
  play: 'M7 5l12 7-12 7V5Z',
  pausa: 'M8 5v14M16 5v14',
  stop: 'M6 6h12v12H6z',
  carpeta: 'M3 6h6l2 2h10v11H3V6Z',
  clip: 'M16 7l-7.5 7.5a2.1 2.1 0 0 0 3 3L19 10a4 4 0 0 0-6-6l-7.5 7.5a6 6 0 0 0 8.5 8.5L20 14',
  enviar: 'M4 12h14m-6-6 6 6-6 6',
  papelera: 'M5 7h14M10 7V4h4v3m-7 0 1 13h8l1-13',
  buscar: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4',
  copiar: 'M8 8h12v12H8zM4 16V4h12',
  escape: 'M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12h-2',
  recargar: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7'
}

export function Icono({ nombre, tamano = 15 }: { nombre: keyof typeof RUTAS | string; tamano?: number }): JSX.Element {
  return (
    <svg className="icono" width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={RUTAS[nombre] ?? ''} />
    </svg>
  )
}

export function Vacio({ children }: { children: ReactNode }): JSX.Element {
  return <div className="vacio">{children}</div>
}
