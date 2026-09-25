import 'pixi.js/unsafe-eval'
import { Application, Container, Graphics, Text, type TextStyleOptions } from 'pixi.js'
import type { AgenteConEstado } from '../../shared/api'
import type { AgentStatus } from '../../shared/types'
import { COLOR_ESTADO, colorDeAgente } from '../colores'

const TILE = 48
const COLUMNAS = 12
const FILAS = 8
const ANCHO_MUNDO = COLUMNAS * TILE
const ALTO_MUNDO = FILAS * TILE
const VELOCIDAD_CAMINAR = 110
const DURACION_SOBRE_MS = 900
const RESOLUCION_TEXTO = 3

interface Punto {
  x: number
  y: number
}

interface Avatar {
  id: string
  contenedor: Container
  cuerpo: Container
  indicador: Graphics
  anillo: Graphics
  burbuja: Container
  textoBurbuja: Text
  asiento: Punto
  descanso: Punto
  estado: AgentStatus
  esCoordinador: boolean
}

interface Sobre {
  g: Graphics
  desde: Punto
  // Se sigue al destinatario en vivo: puede ir caminando hacia su escritorio.
  para: Avatar
  t: number
}

const ALTURA_SOBRE = 34

const estiloEtiqueta: TextStyleOptions = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 11,
  fontWeight: '600',
  fill: 0xe5e7eb,
  stroke: { color: 0x0b0d12, width: 3 }
}

function oscurecer(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor)
  const g = Math.round(((color >> 8) & 0xff) * factor)
  const b = Math.round((color & 0xff) * factor)
  return (r << 16) | (g << 8) | b
}

function texto(contenido: string, estilo: TextStyleOptions): Text {
  const t = new Text({ text: contenido, style: estilo, resolution: RESOLUCION_TEXTO })
  t.anchor.set(0.5)
  return t
}

/**
 * Piso de oficina 2D. Cada agente tiene un escritorio; cuando su sesion esta
 * detenida espera en la sala de descanso y camina a su escritorio al iniciar.
 * Los mensajes del hive se ven como sobres que vuelan entre agentes.
 */
export class EscenaOficina {
  private app = new Application()
  private listo: Promise<void>
  private destruida = false

  private mundo = new Container()
  private capaMuebles = new Container()
  private capaAvatares = new Container()
  private capaEfectos = new Container()

  private avatares = new Map<string, Avatar>()
  private pantallas = new Map<string, Graphics>()
  private sobres: Sobre[] = []
  private seleccionado: string | null = null
  private tiempo = 0
  private ultimoTamano = { ancho: 0, alto: 0 }

  constructor(
    private host: HTMLElement,
    private alSeleccionar: (agentId: string) => void
  ) {
    this.capaAvatares.sortableChildren = true
    this.mundo.addChild(this.dibujarPiso(), this.capaMuebles, this.capaAvatares, this.capaEfectos)
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
    this.app.ticker.add((ticker) => this.tick(ticker.deltaMS))
  }

  destruir(): void {
    if (this.destruida) return
    this.destruida = true
    // init es asincrono: se destruye cuando termina, aunque se pida antes.
    this.listo.then(() => this.app.destroy(true, { children: true })).catch(() => undefined)
  }

  sincronizar(agentes: AgenteConEstado[]): void {
    let indiceDescanso = 0
    for (const agente of agentes) {
      let avatar = this.avatares.get(agente.id)
      if (!avatar) {
        const descanso = agente.esCoordinador ? null : this.puntoDescanso(indiceDescanso)
        avatar = this.crearAgente(agente, descanso)
      }
      if (!agente.esCoordinador) indiceDescanso++
      this.cambiarEstado(avatar, agente.estado)
    }
  }

  seleccionar(agentId: string | null): void {
    this.seleccionado = agentId
    for (const avatar of this.avatares.values()) avatar.anillo.visible = avatar.id === agentId
  }

  enviarSobre(deId: string, paraId: string): void {
    const de = this.avatares.get(deId)
    const para = this.avatares.get(paraId)
    if (!de || !para) return

    const g = new Graphics()
      .roundRect(-9, -6, 18, 12, 2)
      .fill(0xfdfcf7)
      .stroke({ width: 1, color: 0x9ca3af })
      .moveTo(-9, -6)
      .lineTo(0, 1)
      .lineTo(9, -6)
      .stroke({ width: 1, color: 0x9ca3af })
    const desde = { x: de.contenedor.x, y: de.contenedor.y - ALTURA_SOBRE }
    g.position.set(desde.x, desde.y)
    this.capaEfectos.addChild(g)
    this.sobres.push({ g, desde, para, t: 0 })
  }

  // ---------------------------------------------------------------- dibujo

  private dibujarPiso(): Container {
    const piso = new Container()
    const g = new Graphics()

    for (let y = 0; y < FILAS; y++) {
      for (let x = 0; x < COLUMNAS; x++) {
        g.rect(x * TILE, y * TILE, TILE, TILE).fill((x + y) % 2 === 0 ? 0x2a3142 : 0x272d3d)
      }
    }

    // Pared superior con ventanas
    g.rect(-8, -20, ANCHO_MUNDO + 16, 20).fill(0x3b4357)
    for (let x = 1; x < 9; x += 3) g.rect(x * TILE, -15, TILE * 1.6, 10).fill(0x7fa7d9)
    // Paredes laterales e inferior
    g.rect(-8, 0, 8, ALTO_MUNDO).fill(0x3b4357)
    g.rect(ANCHO_MUNDO, 0, 8, ALTO_MUNDO).fill(0x3b4357)
    g.rect(-8, ALTO_MUNDO, ANCHO_MUNDO + 16, 8).fill(0x3b4357)
    // Puerta de entrada
    g.rect(TILE * 0.3, ALTO_MUNDO, TILE * 1.1, 8).fill(0xc9a36b)

    // Oficina de Michael (esquina superior derecha, paredes de vidrio)
    const ox = 9 * TILE
    g.rect(ox, 0, 3 * TILE, 3 * TILE).fill(0x2f3a52)
    g.rect(ox, 0, 3, 3 * TILE).fill({ color: 0x9cc3ff, alpha: 0.7 })
    g.rect(ox, 3 * TILE - 3, TILE * 0.8, 3).fill({ color: 0x9cc3ff, alpha: 0.7 })
    g.rect(ox + TILE * 1.8, 3 * TILE - 3, TILE * 1.2, 3).fill({ color: 0x9cc3ff, alpha: 0.7 })

    // Sala de descanso (abajo a la izquierda)
    g.roundRect(TILE * 0.2, TILE * 5.6, TILE * 4, TILE * 2.2, 10).fill(0x33403a)
    g.roundRect(TILE * 0.4, TILE * 5.8, TILE * 3.6, TILE * 0.55, 6).fill(0x6b4f7a)
    g.roundRect(TILE * 0.4, TILE * 5.7, TILE * 3.6, TILE * 0.2, 4).fill(0x7d5f8c)

    // Plantas
    for (const [px, py] of [
      [0.5, 0.5],
      [8.5, 0.5],
      [4.6, 7.3],
      [11.5, 7.3]
    ]) {
      g.circle(px * TILE, py * TILE + 6, 9).fill(0x8a5a3c)
      g.circle(px * TILE, py * TILE - 4, 13).fill(0x3f8f55)
      g.circle(px * TILE - 6, py * TILE - 8, 8).fill(0x4fae68)
    }

    piso.addChild(g)

    const rotuloMichael = texto('Oficina de Michael', { ...estiloEtiqueta, fontSize: 10, fill: 0xb8c7e6 })
    rotuloMichael.position.set(ox + 1.5 * TILE, 12)
    const rotuloDescanso = texto('Sala de descanso', { ...estiloEtiqueta, fontSize: 10, fill: 0xb8d6c2 })
    rotuloDescanso.position.set(TILE * 2.2, TILE * 5.45)
    piso.addChild(rotuloMichael, rotuloDescanso)

    return piso
  }

  private dibujarEscritorio(agente: AgenteConEstado, asiento: Punto): void {
    const g = new Graphics()
    const madera = agente.esCoordinador ? 0x6e4b33 : 0x8a6a4a
    const ancho = agente.esCoordinador ? TILE * 2 : TILE * 1.6
    g.roundRect(asiento.x - ancho / 2, asiento.y - 44, ancho, 22, 4).fill(madera)
    g.roundRect(asiento.x - ancho / 2, asiento.y - 26, ancho, 4, 2).fill(oscurecer(madera, 0.7))
    // Silla
    g.circle(asiento.x, asiento.y + 2, 13).fill(0x3d4557)
    this.capaMuebles.addChild(g)

    // Monitor: blanco + tint, asi se puede "encender" sin redibujar
    const pantalla = new Graphics().roundRect(-14, -9, 28, 18, 3).fill(0xffffff)
    pantalla.position.set(asiento.x, asiento.y - 50)
    pantalla.tint = 0x1a1f2b
    const marco = new Graphics().roundRect(-16, -11, 32, 22, 4).fill(0x0f1218)
    marco.position.copyFrom(pantalla.position)
    this.capaMuebles.addChild(marco, pantalla)
    this.pantallas.set(agente.id, pantalla)
  }

  private crearAgente(agente: AgenteConEstado, descanso: Punto | null): Avatar {
    const asiento = {
      x: (agente.escritorio.x + 0.5) * TILE,
      y: (agente.escritorio.y + 0.5) * TILE + 10
    }
    this.dibujarEscritorio(agente, asiento)

    const color = colorDeAgente(agente.id, agente.esCoordinador)
    const contenedor = new Container()
    contenedor.eventMode = 'static'
    contenedor.cursor = 'pointer'
    contenedor.on('pointertap', () => this.alSeleccionar(agente.id))

    const anillo = new Graphics().ellipse(0, 14, 18, 7).stroke({ width: 2, color: 0xfacc15 })
    anillo.visible = this.seleccionado === agente.id
    const sombra = new Graphics().ellipse(0, 14, 12, 4).fill({ color: 0x000000, alpha: 0.3 })

    const cuerpo = new Container()
    const figura = new Graphics()
      .rect(-7, 6, 5, 9)
      .fill(0x2b2f3a)
      .rect(2, 6, 5, 9)
      .fill(0x2b2f3a)
      .roundRect(-11, -8, 22, 20, 8)
      .fill(color)
      .circle(0, -16, 10)
      .fill(0xf2c9a0)
      .roundRect(-10, -27, 20, 9, 4)
      .fill(oscurecer(color, 0.45))
    cuerpo.addChild(figura)
    if (agente.esCoordinador) {
      // La corbata de Michael
      cuerpo.addChild(new Graphics().poly([0, -7, -3, -3, 0, 9, 3, -3]).fill(0xc0392b))
    }

    const indicador = new Graphics().circle(0, 0, 4).fill(0xffffff).stroke({ width: 1.5, color: 0x0b0d12 })
    indicador.position.set(12, -24)

    const etiqueta = texto(agente.nombre, estiloEtiqueta)
    etiqueta.position.set(0, 26)

    const burbuja = new Container()
    // A un lado de la cabeza, para no tapar el monitor del escritorio
    burbuja.addChild(
      new Graphics().roundRect(-14, -9, 28, 16, 7).fill(0xf8fafc).poly([-10, 5, -16, 12, -4, 6]).fill(0xf8fafc)
    )
    const textoBurbuja = texto('.', { ...estiloEtiqueta, fill: 0x111827, stroke: undefined, fontSize: 12 })
    textoBurbuja.position.set(0, -3)
    burbuja.addChild(textoBurbuja)
    burbuja.position.set(30, -24)
    burbuja.visible = false

    contenedor.addChild(anillo, sombra, cuerpo, indicador, etiqueta, burbuja)

    const puntoInicial = agente.estado === 'detenido' && descanso ? descanso : asiento
    contenedor.position.set(puntoInicial.x, puntoInicial.y)
    this.capaAvatares.addChild(contenedor)

    const avatar: Avatar = {
      id: agente.id,
      contenedor,
      cuerpo,
      indicador,
      anillo,
      burbuja,
      textoBurbuja,
      asiento,
      descanso: descanso ?? asiento,
      estado: agente.estado,
      esCoordinador: !!agente.esCoordinador
    }
    this.avatares.set(agente.id, avatar)
    return avatar
  }

  private puntoDescanso(indice: number): Punto {
    const porFila = 4
    return {
      x: TILE * (0.8 + (indice % porFila) * 0.95),
      y: TILE * (6.95 + Math.floor(indice / porFila) * 0.6)
    }
  }

  private cambiarEstado(avatar: Avatar, estado: AgentStatus): void {
    avatar.estado = estado
    avatar.indicador.tint = COLOR_ESTADO[estado]
  }

  private destinoDe(avatar: Avatar): Punto {
    if (avatar.esCoordinador) return avatar.asiento
    return avatar.estado === 'detenido' || avatar.estado === 'error' ? avatar.descanso : avatar.asiento
  }

  // --------------------------------------------------------------- animacion

  private tick(dtMs: number): void {
    this.tiempo += dtMs
    const { width, height } = this.app.screen
    if (width !== this.ultimoTamano.ancho || height !== this.ultimoTamano.alto) {
      this.ultimoTamano = { ancho: width, alto: height }
      const escala = Math.min(width / (ANCHO_MUNDO + 40), height / (ALTO_MUNDO + 50))
      this.mundo.scale.set(escala)
      this.mundo.position.set((width - ANCHO_MUNDO * escala) / 2, (height - ALTO_MUNDO * escala) / 2 + 8 * escala)
    }

    for (const avatar of this.avatares.values()) this.animarAvatar(avatar, dtMs)
    this.animarSobres(dtMs)
  }

  private animarAvatar(avatar: Avatar, dtMs: number): void {
    const { contenedor, cuerpo } = avatar
    const destino = this.destinoDe(avatar)
    const dx = destino.x - contenedor.x
    const dy = destino.y - contenedor.y
    const distancia = Math.hypot(dx, dy)
    const paso = (VELOCIDAD_CAMINAR * dtMs) / 1000
    const caminando = distancia > 0.5

    if (caminando) {
      if (distancia <= paso) {
        contenedor.position.set(destino.x, destino.y)
      } else {
        contenedor.x += (dx / distancia) * paso
        contenedor.y += (dy / distancia) * paso
      }
      cuerpo.y = -Math.abs(Math.sin(this.tiempo / 90)) * 3
      cuerpo.rotation = Math.sin(this.tiempo / 90) * 0.06
    } else if (avatar.estado === 'trabajando') {
      cuerpo.y = Math.sin(this.tiempo / 110) * 1.2
      cuerpo.rotation = 0
    } else {
      cuerpo.y = 0
      cuerpo.rotation = 0
    }
    contenedor.zIndex = contenedor.y

    const tecleando = !caminando && avatar.estado === 'trabajando'
    avatar.burbuja.visible = tecleando
    if (tecleando) {
      const puntos = '.'.repeat(1 + (Math.floor(this.tiempo / 350) % 3))
      if (avatar.textoBurbuja.text !== puntos) avatar.textoBurbuja.text = puntos
    }

    const pantalla = this.pantallas.get(avatar.id)
    if (pantalla) {
      const enEscritorio = !caminando && avatar.estado !== 'detenido'
      if (tecleando) pantalla.tint = Math.floor(this.tiempo / 400) % 2 ? 0x34d399 : 0x2bb07a
      else if (enEscritorio) pantalla.tint = avatar.esCoordinador ? 0x8e9ab3 : 0x3b6fb8
      else pantalla.tint = 0x1a1f2b
    }
  }

  private animarSobres(dtMs: number): void {
    for (const sobre of this.sobres) {
      sobre.t = Math.min(1, sobre.t + dtMs / DURACION_SOBRE_MS)
      const t = sobre.t
      const suave = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      const hastaX = sobre.para.contenedor.x
      const hastaY = sobre.para.contenedor.y - ALTURA_SOBRE
      sobre.g.x = sobre.desde.x + (hastaX - sobre.desde.x) * suave
      sobre.g.y = sobre.desde.y + (hastaY - sobre.desde.y) * suave - Math.sin(Math.PI * t) * 60
      sobre.g.rotation = Math.sin(Math.PI * t * 2) * 0.3
    }
    const terminados = this.sobres.filter((s) => s.t >= 1)
    if (terminados.length === 0) return
    for (const sobre of terminados) sobre.g.destroy()
    this.sobres = this.sobres.filter((s) => s.t < 1)
  }
}
