import { useEffect, useMemo, useRef, useState } from 'react'
import type { Agente, HiveMessage, Tarea } from '../../../shared/types'
import { useAgentes, useOficina } from '../../tienda'
import { retratoDe } from '../../pixel/personajes'
import { cambiarUi, seleccionar } from '../../ui'

interface Nodo {
  id: string
  tipo: 'agente' | 'usuario' | 'tarea'
  etiqueta: string
  x: number
  y: number
  vx: number
  vy: number
  fijo?: boolean
  imagen?: HTMLImageElement
  estado?: Tarea['estado']
}

interface Arista {
  a: string
  b: string
  tipo: 'mensaje' | 'tarea'
  peso: number
}

const COLOR_TAREA: Record<Tarea['estado'], string> = {
  pendiente: '#d9a441',
  en_curso: '#4693a6',
  bloqueada: '#c0504d',
  hecha: '#6aa56b'
}

function construir(agentes: Agente[], mensajes: HiveMessage[], tareas: Tarea[], verTareas: boolean): { nodos: Nodo[]; aristas: Arista[] } {
  const nodos: Nodo[] = []
  const n = agentes.length + 1
  agentes.forEach((a, i) => {
    const ang = (i / n) * Math.PI * 2
    const img = new Image()
    img.src = retratoDe(a.personaje)
    nodos.push({ id: a.id, tipo: 'agente', etiqueta: a.nombre.split(' ')[0], x: Math.cos(ang) * 180, y: Math.sin(ang) * 140, vx: 0, vy: 0, imagen: img })
  })
  nodos.push({ id: 'usuario', tipo: 'usuario', etiqueta: 'Tú', x: 0, y: 0, vx: 0, vy: 0 })

  const pares = new Map<string, Arista>()
  for (const m of mensajes) {
    if (m.de === m.para) continue
    const [a, b] = [m.de, m.para].sort()
    if (!nodos.some((x) => x.id === a) || !nodos.some((x) => x.id === b)) continue
    const clave = `${a}|${b}`
    const arista = pares.get(clave) ?? { a, b, tipo: 'mensaje' as const, peso: 0 }
    arista.peso++
    pares.set(clave, arista)
  }
  const aristas = [...pares.values()]

  if (verTareas) {
    for (const t of tareas.filter((x) => !x.archivada).slice(0, 60)) {
      const dueno = nodos.find((x) => x.id === t.dueno)
      nodos.push({
        id: `tarea:${t.id}`,
        tipo: 'tarea',
        etiqueta: t.titulo.length > 34 ? `${t.titulo.slice(0, 33)}…` : t.titulo,
        x: (dueno?.x ?? 0) + (Math.random() - 0.5) * 80,
        y: (dueno?.y ?? 0) + (Math.random() - 0.5) * 80,
        vx: 0,
        vy: 0,
        estado: t.estado
      })
      if (dueno) aristas.push({ a: dueno.id, b: `tarea:${t.id}`, tipo: 'tarea', peso: 1 })
    }
  }
  return { nodos, aristas }
}

export function PestanaGrafo(): JSX.Element {
  const agentes = useAgentes()
  const mensajes = useOficina((e) => e.mensajes) ?? []
  const tareas = useOficina((e) => e.tareas) ?? []
  const [verTareas, setVerTareas] = useState(true)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const vista = useRef({ zoom: 1, x: 0, y: 0 })
  const ajustar = useRef<() => void>(() => undefined)
  const acercar = useRef<(f: number) => void>(() => undefined)

  // La forma del grafo solo cambia con quien habla con quien, no con cada mensaje.
  const firma = useMemo(
    () =>
      `${agentes.map((a) => a.id).join(',')}|${mensajes.length}|${tareas.map((t) => `${t.id}:${t.estado}:${t.dueno}`).join(',')}|${verTareas}`,
    [agentes, mensajes.length, tareas, verTareas]
  )
  const grafo = useMemo(() => construir(agentes, mensajes, tareas, verTareas), [firma])

  useEffect(() => {
    const canvas = lienzo.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const { nodos, aristas } = grafo
    const porId = new Map(nodos.map((n) => [n.id, n]))
    let calor = 1
    let arrastrado: Nodo | null = null
    let paneo: { x: number; y: number } | null = null
    let cuadro = 0

    const tamano = (): void => {
      const r = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(r.width * devicePixelRatio))
      canvas.height = Math.max(1, Math.round(r.height * devicePixelRatio))
    }
    tamano()
    const observador = new ResizeObserver(tamano)
    observador.observe(canvas)

    const aMundo = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect()
      const v = vista.current
      return { x: (e.clientX - r.left - r.width / 2 - v.x) / v.zoom, y: (e.clientY - r.top - r.height / 2 - v.y) / v.zoom }
    }
    const nodoEn = (p: { x: number; y: number }): Nodo | null => {
      for (let i = nodos.length - 1; i >= 0; i--) {
        const n = nodos[i]
        const radio = n.tipo === 'tarea' ? 8 : 20
        if ((n.x - p.x) ** 2 + (n.y - p.y) ** 2 <= radio * radio) return n
      }
      return null
    }

    // Encaja todo el grafo en el lienzo; se hace solo mientras se acomoda, hasta que el usuario lo toque.
    let tocado = false
    const encajar = (): void => {
      if (nodos.length === 0) return
      const xs = nodos.map((n) => n.x)
      const ys = nodos.map((n) => n.y)
      const [x0, x1, y0, y1] = [Math.min(...xs) - 40, Math.max(...xs) + 40, Math.min(...ys) - 30, Math.max(...ys) + 45]
      const zoom = Math.min(1.6, Math.max(0.3, Math.min(canvas.clientWidth / (x1 - x0), canvas.clientHeight / (y1 - y0))))
      vista.current = { zoom, x: (-(x0 + x1) / 2) * zoom, y: (-(y0 + y1) / 2) * zoom }
    }
    ajustar.current = () => {
      tocado = false
      encajar()
    }
    acercar.current = (f) => {
      tocado = true
      vista.current.zoom = Math.min(3, Math.max(0.3, vista.current.zoom * f))
    }

    const paso = (): void => {
      if (calor < 0.005 && !arrastrado) return
      for (let i = 0; i < nodos.length; i++) {
        const a = nodos[i]
        for (let j = i + 1; j < nodos.length; j++) {
          const b = nodos[j]
          let dx = a.x - b.x
          let dy = a.y - b.y
          let d2 = dx * dx + dy * dy
          if (d2 < 1) {
            dx = Math.random() - 0.5
            dy = Math.random() - 0.5
            d2 = 1
          }
          const fuerza = ((a.tipo === 'tarea' || b.tipo === 'tarea' ? 700 : 3200) / d2) * calor
          const d = Math.sqrt(d2)
          a.vx += (dx / d) * fuerza
          a.vy += (dy / d) * fuerza
          b.vx -= (dx / d) * fuerza
          b.vy -= (dy / d) * fuerza
        }
        a.vx -= a.x * 0.004 * calor
        a.vy -= a.y * 0.004 * calor
      }
      for (const e of aristas) {
        const a = porId.get(e.a)
        const b = porId.get(e.b)
        if (!a || !b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.max(1, Math.sqrt(dx * dx + dy * dy))
        const ideal = e.tipo === 'tarea' ? 55 : 150
        const k = (e.tipo === 'tarea' ? 0.04 : 0.012 * Math.min(4, 1 + Math.log(e.peso))) * calor
        const f = (d - ideal) * k
        a.vx += (dx / d) * f
        a.vy += (dy / d) * f
        b.vx -= (dx / d) * f
        b.vy -= (dy / d) * f
      }
      for (const n of nodos) {
        if (n === arrastrado || n.fijo) {
          n.vx = n.vy = 0
          continue
        }
        n.vx *= 0.82
        n.vy *= 0.82
        n.x += Math.max(-12, Math.min(12, n.vx))
        n.y += Math.max(-12, Math.min(12, n.vy))
      }
      calor *= 0.992
    }

    const estilos = getComputedStyle(canvas)
    const colorTexto = estilos.getPropertyValue('--tinta').trim() || '#2b2530'
    const colorSuave = estilos.getPropertyValue('--tinta-suave').trim() || '#7a7078'

    const dibujar = (): void => {
      const v = vista.current
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(devicePixelRatio * v.zoom, 0, 0, devicePixelRatio * v.zoom, devicePixelRatio * (canvas.clientWidth / 2 + v.x), devicePixelRatio * (canvas.clientHeight / 2 + v.y))
      for (const e of aristas) {
        const a = porId.get(e.a)
        const b = porId.get(e.b)
        if (!a || !b) continue
        ctx.beginPath()
        ctx.setLineDash(e.tipo === 'mensaje' ? [4, 4] : [])
        ctx.strokeStyle = e.tipo === 'mensaje' ? 'rgba(70,147,166,0.75)' : 'rgba(120,110,100,0.35)'
        ctx.lineWidth = e.tipo === 'mensaje' ? Math.min(4, 1 + Math.log(e.peso)) : 1
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.textAlign = 'center'
      for (const n of nodos) {
        if (n.tipo === 'tarea') {
          ctx.fillStyle = COLOR_TAREA[n.estado ?? 'pendiente']
          ctx.fillRect(n.x - 6, n.y - 6, 12, 12)
          ctx.strokeStyle = '#2a1f26'
          ctx.lineWidth = 1.5
          ctx.strokeRect(n.x - 6, n.y - 6, 12, 12)
          if (v.zoom > 0.9) {
            ctx.font = '10px "JetBrains Mono", monospace'
            ctx.fillStyle = colorSuave
            ctx.fillText(n.etiqueta, n.x, n.y + 18)
          }
          continue
        }
        ctx.beginPath()
        ctx.arc(n.x, n.y, 18, 0, Math.PI * 2)
        ctx.fillStyle = n.tipo === 'usuario' ? '#2b2530' : '#bfdcee'
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#4693a6'
        ctx.stroke()
        if (n.imagen?.complete) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(n.x, n.y, 16, 0, Math.PI * 2)
          ctx.clip()
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(n.imagen, n.x - 16, n.y - 17, 32, 35)
          ctx.restore()
        }
        ctx.font = '600 12px "JetBrains Mono", monospace'
        ctx.fillStyle = colorTexto
        ctx.fillText(n.etiqueta, n.x, n.y + 33)
      }
    }

    const bucle = (): void => {
      paso()
      if (!tocado && calor > 0.02) encajar()
      dibujar()
      cuadro = requestAnimationFrame(bucle)
    }
    bucle()

    let movio = false
    const alBajar = (e: PointerEvent): void => {
      canvas.setPointerCapture(e.pointerId)
      tocado = true
      movio = false
      const n = nodoEn(aMundo(e))
      if (n) {
        arrastrado = n
        calor = Math.max(calor, 0.3)
      } else paneo = { x: e.clientX - vista.current.x, y: e.clientY - vista.current.y }
    }
    const alMover = (e: PointerEvent): void => {
      if (arrastrado) {
        const p = aMundo(e)
        arrastrado.x = p.x
        arrastrado.y = p.y
        movio = true
      } else if (paneo) {
        vista.current.x = e.clientX - paneo.x
        vista.current.y = e.clientY - paneo.y
        movio = true
      }
      canvas.style.cursor = nodoEn(aMundo(e)) ? 'pointer' : paneo ? 'grabbing' : 'grab'
    }
    const alSoltar = (): void => {
      if (arrastrado && !movio) {
        if (arrastrado.tipo === 'agente') seleccionar(arrastrado.id === 'michael' ? null : arrastrado.id)
        if (arrastrado.tipo === 'tarea') cambiarUi({ pestana: 'tareas' })
      }
      if (arrastrado && movio) arrastrado.fijo = true
      arrastrado = null
      paneo = null
    }
    const alRueda = (e: WheelEvent): void => {
      e.preventDefault()
      tocado = true
      const v = vista.current
      v.zoom = Math.min(3, Math.max(0.3, v.zoom * (e.deltaY < 0 ? 1.1 : 0.9)))
    }
    canvas.addEventListener('pointerdown', alBajar)
    canvas.addEventListener('pointermove', alMover)
    canvas.addEventListener('pointerup', alSoltar)
    canvas.addEventListener('wheel', alRueda, { passive: false })
    return () => {
      cancelAnimationFrame(cuadro)
      observador.disconnect()
      canvas.removeEventListener('pointerdown', alBajar)
      canvas.removeEventListener('pointermove', alMover)
      canvas.removeEventListener('pointerup', alSoltar)
      canvas.removeEventListener('wheel', alRueda)
    }
  }, [grafo])

  const zoom = (f: number): void => acercar.current(f)
  const totalMensajes = mensajes.filter((m) => m.de !== m.para).length

  return (
    <div className="pestana-contenido grafo">
      <div className="barra-herramientas">
        <strong className="pixel">Grafo</strong>
        <span className="suave pequeno">
          {agentes.length} agentes · {totalMensajes} mensajes · {tareas.filter((t) => !t.archivada).length} tareas
        </span>
        <span className="espaciador" />
        <label className="casilla">
          <input type="checkbox" checked={verTareas} onChange={(e) => setVerTareas(e.target.checked)} />
          ver tareas
        </label>
      </div>
      <div className="grafo-lienzo">
        <canvas ref={lienzo} />
        <div className="grafo-zoom">
          <button className="boton-icono" onClick={() => zoom(1.2)} aria-label="Acercar">
            +
          </button>
          <button className="boton-icono" onClick={() => zoom(1 / 1.2)} aria-label="Alejar">
            −
          </button>
          <button
            className="boton-mini"
            onClick={() => ajustar.current()}
          >
            Ajustar
          </button>
        </div>
      </div>
      <p className="grafo-leyenda suave pequeno">
        <span className="leyenda-punto" style={{ background: '#bfdcee' }} /> agente
        <span className="leyenda-punto" style={{ background: '#2b2530' }} /> Tú
        <span className="leyenda-cuadro" style={{ background: '#d9a441' }} /> tarea
        <span className="espaciador" />
        punteado = mensajes · arrastra un nodo para fijarlo · rueda para zoom · clic en un agente para abrirlo
      </p>
    </div>
  )
}
