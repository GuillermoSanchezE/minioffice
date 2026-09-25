import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { AccionGrapadora, AjustesGrapadora } from '../../shared/acciones'
import { accion, tienda, useOficina } from '../tienda'
import { svgCara } from './cara'
import './grapadora.css'

const OPCIONES: Record<AccionGrapadora, { nombre: string; icono: string }> = {
  captura: { nombre: 'Captura', icono: 'M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0' },
  'captura-michael': { nombre: 'Captura a Michael', icono: 'M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M9 12h6m-3-3 3 3-3 3' },
  pedir: { nombre: 'Pedir a Michael', icono: 'M4 5h16v11H9l-5 4V5Z' },
  abrir: { nombre: 'Abrir la oficina', icono: 'M4 5h16v14H4zM4 9h16' },
  preguntas: { nombre: 'Preguntas', icono: 'M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.5V14m0 3v.1' },
  ocultar: { nombre: 'Ocultar', icono: 'M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3 3.4M6.6 6.6C4.3 8.2 3 12 3 12s4 6 9 6a9 9 0 0 0 4-.9' }
}

function Grapadora(): JSX.Element {
  const [ajustes, setAjustes] = useState<AjustesGrapadora | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [pidiendo, setPidiendo] = useState(false)
  const [texto, setTexto] = useState('')
  const [aviso, setAviso] = useState('')
  const preguntas = useOficina((e) => e.preguntas.filter((p) => !p.respuesta).length) ?? 0
  const arrastre = useRef<{ x: number; y: number; movido: number } | null>(null)

  useEffect(() => {
    tienda.iniciar()
    const leer = (): void => {
      void window.minioffice.accion({ tipo: 'grapadora:leerAjustes' }).then(setAjustes)
    }
    leer()
    const t = setInterval(leer, 1500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    void accion({ tipo: 'grapadora:menu', abierto: abierto || pidiendo || !!aviso })
  }, [abierto, pidiendo, aviso])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setAbierto(false)
        setPidiendo(false)
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  function avisar(t: string): void {
    setAviso(t)
    setTimeout(() => setAviso(''), 2600)
  }

  async function elegir(a: AccionGrapadora): Promise<void> {
    setAbierto(false)
    switch (a) {
      case 'captura':
      case 'captura-michael': {
        try {
          await window.minioffice.accion({ tipo: 'grapadora:captura', enviarA: a === 'captura-michael' ? 'michael' : undefined })
          avisar(a === 'captura' ? '¡Clic! Guardada' : '¡Clic! Se la mandé a Michael')
        } catch {
          avisar('No pude capturar la pantalla')
        }
        return
      }
      case 'pedir':
        setPidiendo(true)
        return
      case 'abrir':
        void accion({ tipo: 'ventana:enfocar' })
        return
      case 'preguntas':
        void accion({ tipo: 'ventana:enfocar', pestana: 'preguntas' })
        return
      case 'ocultar':
        void accion({ tipo: 'grapadora:visible', visible: false })
    }
  }

  async function enviar(): Promise<void> {
    if (!texto.trim()) return
    const ok = await window.minioffice
      .accion({ tipo: 'agente:enviar', id: 'michael', texto, modo: 'cola' })
      .then(() => true)
      .catch(() => false)
    if (ok) {
      setTexto('')
      setPidiendo(false)
      avisar('Anotado. Michael lo reparte.')
    } else avisar('No se pudo enviar')
  }

  if (!ajustes) return <></>
  const acciones = ajustes.acciones.length ? ajustes.acciones : (Object.keys(OPCIONES) as AccionGrapadora[])
  const radio = ajustes.tamano / 2 + 44

  return (
    <div className={`grapadora ${abierto ? 'abierta' : ''}`} style={{ opacity: abierto || pidiendo ? 1 : ajustes.opacidad / 100 }}>
      {abierto &&
        acciones.map((a, i) => {
          const ang = -Math.PI / 2 + (i / acciones.length) * Math.PI * 2
          const o = OPCIONES[a]
          return (
            <button
              key={a}
              className="opcion-radial"
              style={{ transform: `translate(${Math.cos(ang) * radio}px, ${Math.sin(ang) * radio}px)` }}
              onClick={() => void elegir(a)}
              title={o.nombre}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={o.icono} />
              </svg>
              <span>{o.nombre}</span>
            </button>
          )
        })}
      <div
        className="criatura"
        style={{ width: ajustes.tamano, height: ajustes.tamano }}
        dangerouslySetInnerHTML={{ __html: svgCara(ajustes) }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          arrastre.current = { x: e.screenX, y: e.screenY, movido: 0 }
        }}
        onPointerMove={(e) => {
          const a = arrastre.current
          if (!a) return
          const dx = e.screenX - a.x
          const dy = e.screenY - a.y
          if (dx === 0 && dy === 0) return
          a.movido += Math.abs(dx) + Math.abs(dy)
          a.x = e.screenX
          a.y = e.screenY
          if (a.movido > 4) void window.minioffice.accion({ tipo: 'grapadora:mover', dx, dy })
        }}
        onPointerUp={() => {
          const a = arrastre.current
          arrastre.current = null
          if (a && a.movido <= 4) {
            setPidiendo(false)
            setAbierto((v) => !v)
          }
        }}
      />
      {preguntas > 0 && !abierto && <span className="insignia-grapadora">{preguntas}</span>}
      {pidiendo && (
        <div className="pedir">
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void enviar()}
            placeholder="¿Qué le pido a Michael?"
          />
        </div>
      )}
      {aviso && <div className="aviso-grapadora">{aviso}</div>}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Grapadora />
  </StrictMode>
)
