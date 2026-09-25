import 'pixi.js/unsafe-eval'
import { Application, Container, Graphics, Rectangle, Text, type FederatedPointerEvent, type TextStyleOptions } from 'pixi.js'
import type { AgenteConEstado } from '../../shared/api'
import type { AgentStatus } from '../../shared/types'
import { COLOR_ESTADO } from '../colores'
import { aparienciaDe, crearFigura, type Figura } from './personajes'
import {
  ASIENTOS,
  ASIENTOS_LIBRES,
  LIMITES,
  dibujarPlano,
  escritorioFrente,
  escritorioLado,
  monitor,
  objeto,
  sillaFrente,
  sillaLado,
  teclado,
  type Asiento
} from './plano'

const ZOOM_MAXIMO = 3.5
const MARGEN_PX = 10
const UMBRAL_ARRASTRE_PX = 5
const DURACION_SOBRE_MS = 950
const RESOLUCION_TEXTO = 4
const ALTURA_CABEZA = 44

const PANTALLA: Record<AgentStatus, number> = {
  detenido: 0x1a1f2b,
  iniciando: 0xfacc15,
  inactivo: 0x3b6fb8,
  trabajando: 0x34d399,
  error: 0xb83b3b
}

const estiloEtiqueta: TextStyleOptions = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 11,
  fontWeight: '600',
  fill: 0xeef1f6
}

interface Puesto {
  id: string
  asiento: Asiento
  contenedor: Container
  figura: Figura
  manos: [Graphics, Graphics] | null
  pantalla: Graphics
  resaltado: Graphics
  borde: Graphics
  punto: Graphics
  burbuja: Container
  textoBurbuja: Text
  zzz: Text
  alerta: Container
  cimaCabeza: number
  estado: AgentStatus
  esCoordinador: boolean
  proximoParpadeo: number
  finParpadeo: number
  fase: number
}

interface Sobre {
  g: Graphics
  desde: { x: number; y: number }
  hasta: { x: number; y: number }
  t: number
}

const limitar = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

/**
 * La oficina en 2D. Cada personaje tiene su puesto fijo: sin sesion se queda
 * dormido en su escritorio; con sesion abre los ojos, enciende el monitor y
 * teclea cuando su terminal tiene actividad. Los mensajes del hive vuelan
 * como sobres. Rueda del raton para acercar, arrastrar para moverse.
 */
export class EscenaOficina {
  private app = new Application()
  private listo: Promise<void>
  private destruida = false

  private mundo = new Container()
  private capaPuestos = new Container()
  private capaEfectos = new Container()

  private puestos = new Map<string, Puesto>()
  private libresUsados = 0
  private sobres: Sobre[] = []
  private seleccionado: string | null = null
  private tiempo = 0
  private tamano = { ancho: 0, alto: 0 }

  private camara = { zoom: 1, x: 0, y: 0 }
  private arrastre: { px: number; py: number; x: number; y: number } | null = null
  private huboArrastre = false

  private alRueda = (e: WheelEvent): void => {
    e.preventDefault()
    const caja = this.app.canvas.getBoundingClientRect()
    this.acercarEn(e.clientX - caja.left, e.clientY - caja.top, e.deltaY < 0 ? 1.15 : 1 / 1.15)
  }

  private alDobleClic = (): void => {
    this.camara = { zoom: 1, x: 0, y: 0 }
    this.aplicarCamara()
  }

  constructor(
    private host: HTMLElement,
    private alSeleccionar: (agentId: string) => void
  ) {
    this.capaPuestos.sortableChildren = true
    this.mundo.addChild(dibujarPlano(), this.capaPuestos, this.capaEfectos)
    this.listo = this.iniciar()
  }

  private async iniciar(): Promise<void> {
    await this.app.init({
      background: 0x151922,
      resizeTo: this.host,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1
    })
    if (this.destruida) return
    this.host.appendChild(this.app.canvas)
    this.app.stage.addChild(this.mundo)
    this.configurarCamara()
    this.app.ticker.add((ticker) => this.tick(ticker.deltaMS))
  }

  destruir(): void {
    if (this.destruida) return
    this.destruida = true
    this.host.removeEventListener('wheel', this.alRueda)
    this.host.removeEventListener('dblclick', this.alDobleClic)
    // init es asincrono: se destruye cuando termina, aunque se pida antes.
    this.listo.then(() => this.app.destroy(true, { children: true })).catch(() => undefined)
  }

  sincronizar(agentes: AgenteConEstado[]): void {
    void this.listo.then(() => {
      if (this.destruida) return
      for (const agente of agentes) {
        const puesto = this.puestos.get(agente.id) ?? this.crearPuesto(agente)
        this.cambiarEstado(puesto, agente.estado)
      }
    })
  }

  seleccionar(agentId: string | null): void {
    this.seleccionado = agentId
    for (const puesto of this.puestos.values()) {
      const activo = puesto.id === agentId
      puesto.resaltado.visible = activo
      puesto.borde.visible = activo
    }
  }

  enviarSobre(deId: string, paraId: string): void {
    const de = this.puestos.get(deId)
    const para = this.puestos.get(paraId)
    if (!de || !para) return

    const g = new Graphics()
      .roundRect(-9, -6, 18, 12, 2)
      .fill(0xfdfcf7)
      .stroke({ width: 1, color: 0x9ca3af })
      .moveTo(-9, -6)
      .lineTo(0, 1)
      .lineTo(9, -6)
      .stroke({ width: 1, color: 0x9ca3af })
    const desde = { x: de.asiento.x, y: de.asiento.y - ALTURA_CABEZA }
    g.position.set(desde.x, desde.y)
    this.capaEfectos.addChild(g)
    this.sobres.push({ g, desde, hasta: { x: para.asiento.x, y: para.asiento.y - ALTURA_CABEZA }, t: 0 })
  }

  // ---------------------------------------------------------------- puestos

  private asientoPara(agentId: string): Asiento {
    const propio = ASIENTOS[agentId]
    if (propio) return propio
    const i = this.libresUsados++
    const base = ASIENTOS_LIBRES[i % ASIENTOS_LIBRES.length]
    const vuelta = Math.floor(i / ASIENTOS_LIBRES.length)
    return { ...base, x: base.x + vuelta * 10, y: base.y + vuelta * 10 }
  }

  private crearPuesto(agente: AgenteConEstado): Puesto {
    const asiento = this.asientoPara(agente.id)
    const ap = aparienciaDe(agente.id)
    const frente = asiento.orientacion === 'frente'
    const izquierda = asiento.orientacion === 'izquierda'
    const zona = frente
      ? new Rectangle(-58, -64, 116, 122)
      : new Rectangle(izquierda ? -70 : -24, -64, 94, 100)

    const contenedor = new Container()
    contenedor.position.set(asiento.x, asiento.y)
    contenedor.zIndex = asiento.y
    contenedor.eventMode = 'static'
    contenedor.cursor = 'pointer'
    contenedor.hitArea = zona
    contenedor.on('pointertap', () => {
      if (!this.huboArrastre) this.alSeleccionar(agente.id)
    })

    const resaltado = new Graphics()
      .roundRect(zona.x, zona.y, zona.width, zona.height, 14)
      .fill({ color: 0xfacc15, alpha: 0.08 })
      .stroke({ width: 2, color: 0xfacc15, alpha: 0.85 })

    // Silla, escritorio y personaje; se refleja entero para quien mira a la izquierda.
    const grupo = new Container()
    if (izquierda) grupo.scale.x = -1
    const atras = new Graphics()
    const adelante = new Graphics()
    const marco = new Graphics()
    const pantalla = new Graphics()
    const figura = crearFigura(ap, asiento.orientacion)
    let manos: [Graphics, Graphics] | null = null
    let etiquetaY: number

    if (frente) {
      sillaFrente(atras)
      etiquetaY = escritorioFrente(adelante, asiento.mueble ?? 'normal').etiquetaY
      teclado(adelante, -13, -6, 26)
      monitor(marco, pantalla, 22, -30)
      if (asiento.objeto) objeto(adelante, asiento.objeto, -30, -1)
      manos = [new Graphics().circle(-7, -3.5, 3.2).fill(ap.piel), new Graphics().circle(7, -3.5, 3.2).fill(ap.piel)]
      grupo.addChild(atras, figura.raiz, adelante, marco, pantalla, ...manos)
    } else {
      sillaLado(atras)
      escritorioLado(atras)
      teclado(atras, 16, -17, 18)
      monitor(marco, pantalla, 40, -50)
      if (asiento.objeto) objeto(atras, asiento.objeto, 56, -9)
      etiquetaY = 24
      grupo.addChild(atras, marco, pantalla, figura.raiz)
    }

    // Etiqueta con el nombre de pila y el punto de estado
    const texto = new Text({ text: agente.nombre.split(' ')[0], style: estiloEtiqueta, resolution: RESOLUCION_TEXTO })
    texto.anchor.set(0, 0.5)
    const ancho = texto.width + 22
    const etiqueta = new Container()
    etiqueta.position.set(0, etiquetaY)
    const fondo = new Graphics().roundRect(-ancho / 2, -8.5, ancho, 17, 8.5).fill({ color: 0x10131a, alpha: 0.85 })
    const borde = new Graphics().roundRect(-ancho / 2, -8.5, ancho, 17, 8.5).stroke({ width: 1.5, color: 0xfacc15 })
    const punto = new Graphics().circle(-ancho / 2 + 9, 0, 3.3).fill(0xffffff)
    texto.position.set(-ancho / 2 + 15, 0)
    etiqueta.addChild(fondo, borde, punto, texto)

    // Globos sobre la cabeza
    const cimaCabeza = -48 * (ap.altura ?? 1)
    const burbuja = new Container()
    burbuja.addChild(
      new Graphics().roundRect(-14, -9, 28, 16, 7).fill(0xf8fafc).poly([-10, 5, -16, 12, -4, 6]).fill(0xf8fafc)
    )
    const textoBurbuja = new Text({
      text: '.',
      style: { ...estiloEtiqueta, fill: 0x111827, fontSize: 12 },
      resolution: RESOLUCION_TEXTO
    })
    textoBurbuja.anchor.set(0.5)
    textoBurbuja.position.set(0, -3)
    burbuja.addChild(textoBurbuja)
    burbuja.position.set(frente ? 24 : 30, cimaCabeza - (frente ? -2 : 5))

    const zzz = new Text({
      text: 'zZ',
      style: { ...estiloEtiqueta, fontSize: 10, fill: 0xc7d2fe, fontStyle: 'italic' },
      resolution: RESOLUCION_TEXTO
    })
    zzz.anchor.set(0.5)

    const alerta = new Container()
    const signo = new Text({ text: '!', style: { ...estiloEtiqueta, fontSize: 11, fill: 0xffffff }, resolution: RESOLUCION_TEXTO })
    signo.anchor.set(0.5)
    alerta.addChild(new Graphics().circle(0, 0, 7).fill(0xef4444), signo)
    alerta.position.set(14, cimaCabeza - 4)

    contenedor.addChild(resaltado, grupo, etiqueta, burbuja, zzz, alerta)
    this.capaPuestos.addChild(contenedor)

    const activo = this.seleccionado === agente.id
    resaltado.visible = activo
    borde.visible = activo

    const puesto: Puesto = {
      id: agente.id,
      asiento,
      contenedor,
      figura,
      manos,
      pantalla,
      resaltado,
      borde,
      punto,
      burbuja,
      textoBurbuja,
      zzz,
      alerta,
      cimaCabeza,
      estado: agente.estado,
      esCoordinador: !!agente.esCoordinador,
      proximoParpadeo: Math.random() * 4000,
      finParpadeo: 0,
      fase: Math.random() * Math.PI * 2
    }
    this.puestos.set(agente.id, puesto)
    return puesto
  }

  private cambiarEstado(puesto: Puesto, estado: AgentStatus): void {
    puesto.estado = estado
    puesto.punto.tint = COLOR_ESTADO[estado]
  }

  // ----------------------------------------------------------------- camara

  private configurarCamara(): void {
    const stage = this.app.stage
    const eventos = this.app.renderer.events
    eventos.cursorStyles.default = 'grab'
    stage.eventMode = 'static'
    stage.hitArea = this.app.screen

    stage.on('pointerdown', (e: FederatedPointerEvent) => {
      this.arrastre = { px: e.global.x, py: e.global.y, x: this.camara.x, y: this.camara.y }
      this.huboArrastre = false
    })
    stage.on('globalpointermove', (e: FederatedPointerEvent) => {
      if (!this.arrastre) return
      const dx = e.global.x - this.arrastre.px
      const dy = e.global.y - this.arrastre.py
      if (!this.huboArrastre && Math.hypot(dx, dy) < UMBRAL_ARRASTRE_PX) return
      this.huboArrastre = true
      eventos.cursorStyles.default = 'grabbing'
      this.camara.x = this.arrastre.x + dx
      this.camara.y = this.arrastre.y + dy
      this.aplicarCamara()
    })
    const soltar = (): void => {
      this.arrastre = null
      eventos.cursorStyles.default = 'grab'
    }
    stage.on('pointerup', soltar)
    stage.on('pointerupoutside', soltar)

    this.host.addEventListener('wheel', this.alRueda, { passive: false })
    this.host.addEventListener('dblclick', this.alDobleClic)
  }

  private escalaBase(): number {
    const { width, height } = this.app.screen
    return Math.max(0.05, Math.min((width - MARGEN_PX * 2) / LIMITES.ancho, (height - MARGEN_PX * 2) / LIMITES.alto))
  }

  /** Posicion del mundo centrado, sin desplazamiento de la camara. */
  private origen(escala: number): { x: number; y: number } {
    const { width, height } = this.app.screen
    return {
      x: (width - LIMITES.ancho * escala) / 2 - LIMITES.x * escala,
      y: (height - LIMITES.alto * escala) / 2 - LIMITES.y * escala
    }
  }

  private aplicarCamara(): void {
    const { width, height } = this.app.screen
    const escala = this.escalaBase() * this.camara.zoom
    const holguraX = Math.max(0, (LIMITES.ancho * escala - width) / 2 + MARGEN_PX)
    const holguraY = Math.max(0, (LIMITES.alto * escala - height) / 2 + MARGEN_PX)
    this.camara.x = limitar(this.camara.x, -holguraX, holguraX)
    this.camara.y = limitar(this.camara.y, -holguraY, holguraY)
    const origen = this.origen(escala)
    this.mundo.scale.set(escala)
    this.mundo.position.set(origen.x + this.camara.x, origen.y + this.camara.y)
  }

  /** Acerca o aleja manteniendo fijo el punto del mundo bajo el cursor. */
  private acercarEn(px: number, py: number, factor: number): void {
    const escalaAntes = this.mundo.scale.x
    const mundoX = (px - this.mundo.x) / escalaAntes
    const mundoY = (py - this.mundo.y) / escalaAntes
    this.camara.zoom = limitar(this.camara.zoom * factor, 1, ZOOM_MAXIMO)
    const escala = this.escalaBase() * this.camara.zoom
    const origen = this.origen(escala)
    this.camara.x = px - mundoX * escala - origen.x
    this.camara.y = py - mundoY * escala - origen.y
    this.aplicarCamara()
  }

  // -------------------------------------------------------------- animacion

  private tick(dtMs: number): void {
    this.tiempo += dtMs
    const { width, height } = this.app.screen
    if (width !== this.tamano.ancho || height !== this.tamano.alto) {
      this.tamano = { ancho: width, alto: height }
      this.aplicarCamara()
    }
    for (const puesto of this.puestos.values()) this.animarPuesto(puesto)
    this.animarSobres(dtMs)
  }

  private animarPuesto(p: Puesto): void {
    const t = this.tiempo
    const despierto = p.estado !== 'detenido'
    const trabajando = p.estado === 'trabajando'

    let ojosCerrados = !despierto
    if (despierto && t >= p.proximoParpadeo) {
      p.finParpadeo = t + 140
      p.proximoParpadeo = t + 2500 + Math.random() * 4000
    }
    if (despierto) ojosCerrados = t < p.finParpadeo
    p.figura.ojosAbiertos.visible = !ojosCerrados
    p.figura.ojosCerrados.visible = ojosCerrados

    const raiz = p.figura.raiz
    raiz.y = trabajando ? Math.sin(t / 120 + p.fase) * 0.8 : despierto ? 0 : 1.5
    raiz.rotation = despierto ? 0 : 0.06

    if (p.manos) {
      p.manos[0].y = trabajando ? Math.sin(t / 55 + p.fase) * 1.2 : 0
      p.manos[1].y = trabajando ? Math.sin(t / 55 + p.fase + Math.PI) * 1.2 : 0
    }

    p.burbuja.visible = trabajando
    if (trabajando) {
      const puntos = '.'.repeat(1 + (Math.floor(t / 350) % 3))
      if (p.textoBurbuja.text !== puntos) p.textoBurbuja.text = puntos
    }

    p.zzz.visible = !despierto
    if (!despierto) {
      const avance = (t / 1800 + p.fase) % 1
      p.zzz.position.set(16 + avance * 6, p.cimaCabeza - avance * 12)
      p.zzz.alpha = 1 - avance
    }

    p.alerta.visible = p.estado === 'error'

    if (p.estado === 'iniciando') {
      p.pantalla.tint = Math.floor(t / 300) % 2 ? PANTALLA.iniciando : 0x3a3f4b
    } else if (trabajando) {
      p.pantalla.tint = Math.floor(t / 400) % 2 ? PANTALLA.trabajando : 0x2bb07a
    } else if (p.esCoordinador) {
      p.pantalla.tint = 0x8e9ab3
    } else {
      p.pantalla.tint = PANTALLA[p.estado]
    }
  }

  private animarSobres(dtMs: number): void {
    for (const sobre of this.sobres) {
      sobre.t = Math.min(1, sobre.t + dtMs / DURACION_SOBRE_MS)
      const t = sobre.t
      const suave = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      const distancia = Math.hypot(sobre.hasta.x - sobre.desde.x, sobre.hasta.y - sobre.desde.y)
      const arco = Math.min(90, 20 + distancia * 0.25)
      sobre.g.x = sobre.desde.x + (sobre.hasta.x - sobre.desde.x) * suave
      sobre.g.y = sobre.desde.y + (sobre.hasta.y - sobre.desde.y) * suave - Math.sin(Math.PI * t) * arco
      sobre.g.rotation = Math.sin(Math.PI * t * 2) * 0.3
    }
    if (!this.sobres.some((s) => s.t >= 1)) return
    for (const sobre of this.sobres) if (sobre.t >= 1) sobre.g.destroy()
    this.sobres = this.sobres.filter((s) => s.t < 1)
  }
}
