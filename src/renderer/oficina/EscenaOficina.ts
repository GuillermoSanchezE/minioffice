import 'pixi.js/unsafe-eval'
import {
  Application,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  type FederatedPointerEvent,
  type TextStyleOptions
} from 'pixi.js'
import type { AgentStatus } from '../../shared/types'
import { spritesDe, type SpritesPersonaje } from '../pixel/personajes'
import { Rejilla } from './caminos'
import {
  ACTIVIDADES,
  ALTO,
  ANCHO,
  ASIENTOS,
  ASIENTOS_LIBRES,
  FRASES_VISITA,
  LIMITES,
  ROTULOS,
  dibujarFondo,
  escritorio,
  mobiliario,
  obstaculos,
  pantallaDe,
  puntoSentado,
  puntoVisita,
  silla,
  type Asiento,
  type Mirada,
  type Punto
} from './plano'

/** Lo que la escena necesita saber de cada agente. */
export interface AgenteEnEscena {
  id: string
  personaje: string
  nombre: string
  estado: AgentStatus
  herramienta?: string
  esCoordinador?: boolean
}

const ZOOM_MAXIMO = 5
const MARGEN_PX = 8
const UMBRAL_ARRASTRE_PX = 5
const VELOCIDAD = 34
const MS_PASO = 150
const DURACION_SOBRE_MS = 950
const RESOLUCION_TEXTO = 10

const PANTALLA: Record<AgentStatus, number> = {
  detenido: 0x341422,
  iniciando: 0xfacc15,
  inactivo: 0x5c8ade,
  trabajando: 0x7fb3ff,
  esperando: 0xf0b429,
  pausado: 0x9aa3b1,
  error: 0xd9483b
}

const COLOR_PUNTO: Record<AgentStatus, number> = {
  detenido: 0x8a8f99,
  iniciando: 0xfacc15,
  inactivo: 0x7fb3ff,
  trabajando: 0x4fd1a5,
  esperando: 0xf0b429,
  pausado: 0xb8c0cc,
  error: 0xef5350
}

const fuenteMono = '"JetBrains Mono", ui-monospace, monospace'

const estiloGlobo: TextStyleOptions = { fontFamily: fuenteMono, fontSize: 6, fontWeight: '600', fill: 0x2a1f26 }
const estiloEtiqueta: TextStyleOptions = { fontFamily: fuenteMono, fontSize: 5, fontWeight: '700', fill: 0xfdf7ef }
const estiloRotulo: TextStyleOptions = { fontFamily: fuenteMono, fontSize: 5, fontWeight: '700', fill: 0x5d7465, letterSpacing: 0.3 }

/** Texto del globo segun la herramienta que Claude Code esta usando. */
export function textoHerramienta(herramienta: string): string {
  const prefijos: Record<string, string> = { Bash: '$', Read: '<', Write: '>', Edit: '✎', MultiEdit: '✎', Grep: '?', Glob: '?' }
  return `${prefijos[herramienta] ?? '·'} usando ${herramienta}`
}

type Modo = 'sentado' | 'caminando' | 'de-pie'

interface Actor {
  id: string
  nombre: string
  asiento: Asiento
  sprites: SpritesPersonaje
  cuerpo: Sprite
  pantalla: Sprite
  halo: Graphics
  seleccion: Graphics
  etiqueta: Container
  borde: Graphics
  punto: Graphics
  globo: Container
  fondoGlobo: Graphics
  textoGlobo: Text
  colaGlobo: number
  zzz: Text
  estado: AgentStatus
  herramienta?: string
  esCoordinador: boolean

  pos: Punto
  modo: Modo
  camino: Punto[]
  mirada: Mirada
  /** Al llegar al destino: sentarse o hacer una actividad. */
  alLlegar: 'sentarse' | { frase: string; mirada: Mirada }
  frase?: string
  finActividad: number
  proximaSalida: number
  proximoParpadeo: number
  finParpadeo: number
  inicioPaso: number
  fase: number
}

interface Sobre {
  g: Graphics
  de: Actor
  para: Actor
  t: number
}

const limitar = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))
const azar = <T>(lista: T[]): T => lista[Math.floor(Math.random() * lista.length)]

/** Libres (sin trabajo) o sin sesion pasean; el resto se queda en su escritorio. */
function debeEstarSentado(estado: AgentStatus): boolean {
  return estado !== 'inactivo' && estado !== 'detenido'
}

/**
 * La oficina en pixel art. Cada personaje tiene su escritorio: ahi trabaja y
 * duerme si no tiene sesion; cuando esta libre se levanta a por un café, a la
 * máquina de snacks o a visitar a un compañero, y vuelve en cuanto le llega
 * trabajo. Rueda para acercar, arrastrar para moverse, doble clic para ver todo.
 */
export class EscenaOficina {
  private app = new Application()
  private listo: Promise<void>
  private destruida = false

  private mundo = new Container()
  private capaSuelo = new Container()
  private capaObjetos = new Container()
  private capaEncima = new Container()

  private actores = new Map<string, Actor>()
  private escritoriosOcupados = new Set<Asiento>()
  private rejilla: Rejilla
  private sobres: Sobre[] = []
  private seleccionado: string | null = null
  private tiempo = 0
  private tamano = { ancho: 0, alto: 0 }
  private mostrarNombres = true
  private paseos = true

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
    const todos = [...Object.values(ASIENTOS), ...ASIENTOS_LIBRES]
    this.rejilla = new Rejilla(ANCHO, ALTO, obstaculos(todos))
    this.capaObjetos.sortableChildren = true
    this.mundo.addChild(this.capaSuelo, this.capaObjetos, this.capaEncima)
    this.listo = this.iniciar()
  }

  private async iniciar(): Promise<void> {
    await Promise.all([
      this.app.init({
        background: 0x19121e,
        resizeTo: this.host,
        antialias: false,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1
      }),
      document.fonts.load(`600 12px ${fuenteMono}`).catch(() => undefined),
      document.fonts.load(`700 12px ${fuenteMono}`).catch(() => undefined)
    ])
    if (this.destruida) return
    this.construirOficina()
    this.host.appendChild(this.app.canvas)
    this.app.stage.addChild(this.mundo)
    this.configurarCamara()
    this.app.ticker.add((ticker) => this.tick(ticker.deltaMS))
    // El pixel art no necesita 60-120 fps: 30 con la ventana activa y 12 si estás en otra app
    // (las animaciones van por tiempo, así que solo cambia la suavidad). Ahorra CPU y batería.
    this.ajustarFps()
    window.addEventListener('focus', this.ajustarFps)
    window.addEventListener('blur', this.ajustarFps)
  }

  private ajustarFps = (): void => {
    this.app.ticker.maxFPS = document.hasFocus() ? 30 : 12
  }

  destruir(): void {
    if (this.destruida) return
    this.destruida = true
    this.host.removeEventListener('wheel', this.alRueda)
    this.host.removeEventListener('dblclick', this.alDobleClic)
    window.removeEventListener('focus', this.ajustarFps)
    window.removeEventListener('blur', this.ajustarFps)
    this.listo.then(() => this.app.destroy(true, { children: true })).catch(() => undefined)
  }

  sincronizar(agentes: AgenteEnEscena[]): void {
    void this.listo.then(() => {
      if (this.destruida) return
      for (const agente of agentes) {
        const actor = this.actores.get(agente.id) ?? this.crearActor(agente)
        actor.estado = agente.estado
        actor.herramienta = agente.herramienta
        actor.punto.tint = COLOR_PUNTO[agente.estado]
      }
      const vigentes = new Set(agentes.map((a) => a.id))
      for (const actor of [...this.actores.values()]) if (!vigentes.has(actor.id)) this.quitarActor(actor)
    })
  }

  /** Alguien dejo la oficina: se va su personaje y su escritorio queda libre. */
  private quitarActor(actor: Actor): void {
    for (const pieza of [actor.cuerpo, actor.halo, actor.seleccion, actor.etiqueta, actor.globo, actor.zzz]) pieza.destroy({ children: true })
    actor.pantalla.tint = PANTALLA.detenido
    this.escritoriosOcupados.delete(actor.asiento)
    this.sobres = this.sobres.filter((s) => {
      const suelto = s.de === actor || s.para === actor
      if (suelto) s.g.destroy()
      return !suelto
    })
    this.actores.delete(actor.id)
  }

  seleccionar(agentId: string | null): void {
    this.seleccionado = agentId
    for (const actor of this.actores.values()) this.pintarSeleccion(actor)
  }

  verNombres(visible: boolean): void {
    this.mostrarNombres = visible
  }

  /** Sin paseos, todos vuelven a su escritorio y se quedan ahi. */
  permitirPaseos(si: boolean): void {
    this.paseos = si
  }

  enviarSobre(deId: string, paraId: string): void {
    const de = this.actores.get(deId)
    const para = this.actores.get(paraId)
    if (!de || !para) return
    const g = new Graphics()
      .rect(-5, -3.5, 10, 7)
      .fill(0xfdfcf7)
      .stroke({ width: 1, color: 0x2a1f26, alignment: 1 })
      .moveTo(-5, -3.5)
      .lineTo(0, 0.5)
      .lineTo(5, -3.5)
      .stroke({ width: 0.75, color: 0x9ca3af })
    g.position.set(de.pos.x, de.pos.y - 26)
    this.capaEncima.addChild(g)
    this.sobres.push({ g, de, para, t: 0 })
  }

  // ------------------------------------------------------------ montaje

  private construirOficina(): void {
    const fondo = dibujarFondo()
    const sprite = new Sprite(fondo.textura)
    sprite.position.set(fondo.x, fondo.y)
    this.capaSuelo.addChild(sprite)

    for (const rotulo of ROTULOS) {
      const estilo = rotulo.letrero ? { ...estiloRotulo, fill: 0xf4f6f8, fontSize: 4.5, letterSpacing: 0.6 } : estiloRotulo
      const t = new Text({ text: rotulo.texto, style: estilo, resolution: RESOLUCION_TEXTO })
      t.anchor.set(0.5)
      t.position.set(rotulo.x, rotulo.y)
      this.capaSuelo.addChild(t)
    }

    for (const pieza of mobiliario()) {
      const s = new Sprite(pieza.textura)
      s.position.set(pieza.x, pieza.y)
      s.zIndex = pieza.base
      this.capaObjetos.addChild(s)
    }

    // Escritorios vacios: se pintan todos; los ocupados se reutilizan al crear actores.
    for (const asiento of ASIENTOS_LIBRES) this.montarEscritorio(asiento)
  }

  private escritoriosMontados = new Map<Asiento, { pantalla: Sprite }>()

  private montarEscritorio(asiento: Asiento): { pantalla: Sprite } {
    const existente = this.escritoriosMontados.get(asiento)
    if (existente) return existente
    const mesa = escritorio(asiento)
    const s = new Sprite(mesa.textura)
    s.position.set(mesa.x, mesa.y)
    s.zIndex = mesa.base
    const asientoSilla = silla(asiento)
    const sillaSprite = new Sprite(asientoSilla.textura)
    sillaSprite.position.set(asientoSilla.x, asientoSilla.y)
    sillaSprite.zIndex = asientoSilla.base
    const zona = pantallaDe(asiento)
    const pantalla = new Sprite(Texture.WHITE)
    pantalla.position.set(zona.x, zona.y)
    pantalla.width = zona.w
    pantalla.height = zona.h
    pantalla.tint = PANTALLA.detenido
    pantalla.zIndex = mesa.base + 0.01
    this.capaObjetos.addChild(sillaSprite, s, pantalla)
    const montado = { pantalla }
    this.escritoriosMontados.set(asiento, montado)
    return montado
  }

  private asientoPara(agente: AgenteEnEscena): Asiento {
    const propio = ASIENTOS[agente.personaje] ?? ASIENTOS[agente.id]
    if (propio && !this.escritoriosOcupados.has(propio)) return propio
    const libre = ASIENTOS_LIBRES.find((a) => !this.escritoriosOcupados.has(a))
    if (libre) return libre
    const base = ASIENTOS_LIBRES[this.escritoriosOcupados.size % ASIENTOS_LIBRES.length]
    return { ...base, dx: base.dx + 4, dy: base.dy + 4 }
  }

  private crearActor(agente: AgenteEnEscena): Actor {
    const asiento = this.asientoPara(agente)
    this.escritoriosOcupados.add(asiento)
    const { pantalla } = this.montarEscritorio(asiento)
    const sprites = spritesDe(agente.personaje)
    const pos = puntoSentado(asiento)

    const cuerpo = new Sprite(sprites.sentado.normal)
    cuerpo.anchor.set(0.5, 1)
    cuerpo.position.set(pos.x, pos.y)
    cuerpo.zIndex = pos.y
    cuerpo.eventMode = 'static'
    cuerpo.cursor = 'pointer'
    cuerpo.hitArea = new Rectangle(-10, -30, 20, 30)
    cuerpo.on('pointertap', () => {
      if (!this.huboArrastre) this.alSeleccionar(agente.id)
    })

    const halo = new Graphics().ellipse(0, 0, 15, 5).fill({ color: 0x4fd1c5, alpha: 0.35 })
    halo.position.set(pos.x, asiento.dy + 14)
    halo.visible = false
    const seleccion = new Graphics().ellipse(0, 0, 11, 4).stroke({ width: 1.5, color: 0xf2c94c })
    seleccion.visible = false
    this.capaSuelo.addChild(halo, seleccion)

    // Etiqueta con el nombre de pila
    const texto = new Text({ text: agente.nombre.split(' ')[0], style: estiloEtiqueta, resolution: RESOLUCION_TEXTO })
    texto.anchor.set(0, 0.5)
    const ancho = Math.ceil(texto.width) + 11
    const etiqueta = new Container()
    const fondo = new Graphics().roundRect(-ancho / 2, -4, ancho, 8, 3).fill({ color: 0x2a1f26, alpha: 0.85 })
    const borde = new Graphics().roundRect(-ancho / 2, -4, ancho, 8, 3).stroke({ width: 1, color: 0xf2c94c })
    const punto = new Graphics().circle(-ancho / 2 + 4.5, 0, 1.6).fill(0xffffff)
    texto.position.set(-ancho / 2 + 8, 0)
    etiqueta.addChild(fondo, borde, punto, texto)

    // Globo de estado
    const globo = new Container()
    const fondoGlobo = new Graphics()
    const textoGlobo = new Text({ text: '', style: estiloGlobo, resolution: RESOLUCION_TEXTO })
    textoGlobo.anchor.set(0.5, 0.5)
    globo.addChild(fondoGlobo, textoGlobo)
    globo.visible = false

    const zzz = new Text({
      text: 'zZ',
      style: { ...estiloGlobo, fill: 0xc7d2fe, fontSize: 6, fontStyle: 'italic', fontWeight: '700' },
      resolution: RESOLUCION_TEXTO
    })
    zzz.anchor.set(0.5)
    zzz.visible = false

    this.capaObjetos.addChild(cuerpo)
    this.capaEncima.addChild(etiqueta, globo, zzz)

    const actor: Actor = {
      id: agente.id,
      nombre: agente.nombre,
      asiento,
      sprites,
      cuerpo,
      pantalla,
      halo,
      seleccion,
      etiqueta,
      borde,
      punto,
      globo,
      fondoGlobo,
      textoGlobo,
      colaGlobo: 0,
      zzz,
      estado: agente.estado,
      herramienta: agente.herramienta,
      esCoordinador: !!agente.esCoordinador,
      pos,
      modo: 'sentado',
      camino: [],
      mirada: 'frente',
      alLlegar: 'sentarse',
      finActividad: 0,
      proximaSalida: this.tiempo + 6000 + Math.random() * 20000,
      proximoParpadeo: Math.random() * 4000,
      finParpadeo: 0,
      inicioPaso: 0,
      fase: Math.random() * 1000
    }
    this.actores.set(agente.id, actor)
    this.pintarSeleccion(actor)
    return actor
  }

  private pintarSeleccion(actor: Actor): void {
    const activo = actor.id === this.seleccionado
    actor.seleccion.visible = activo
    actor.borde.visible = activo
  }

  // ---------------------------------------------------------- comportamiento

  private irA(actor: Actor, destino: Punto, alLlegar: Actor['alLlegar']): void {
    actor.camino = this.rejilla.camino(actor.pos, destino)
    actor.alLlegar = alLlegar
    actor.modo = 'caminando'
    actor.frase = undefined
    actor.inicioPaso = this.tiempo
  }

  private volverAlEscritorio(actor: Actor): void {
    this.irA(actor, puntoSentado(actor.asiento), 'sentarse')
  }

  private salirDeActividad(actor: Actor): void {
    const otros = [...this.actores.values()].filter((a) => a !== actor)
    if (otros.length > 0 && Math.random() < 0.3) {
      const visitado = azar(otros)
      this.irA(actor, puntoVisita(visitado.asiento), { frase: azar(FRASES_VISITA), mirada: 'espalda' })
      return
    }
    const actividad = azar(ACTIVIDADES)
    this.irA(actor, actividad.punto, { frase: azar(actividad.frases), mirada: actividad.mirada })
  }

  private decidir(actor: Actor): void {
    const sentarse = debeEstarSentado(actor.estado) || !this.paseos
    if (sentarse) {
      const yendoAlEscritorio = actor.modo === 'caminando' && actor.alLlegar === 'sentarse'
      if (actor.modo !== 'sentado' && !yendoAlEscritorio) this.volverAlEscritorio(actor)
      return
    }
    if (actor.modo === 'sentado' && this.tiempo >= actor.proximaSalida) {
      this.salirDeActividad(actor)
    } else if (actor.modo === 'de-pie' && this.tiempo >= actor.finActividad) {
      this.volverAlEscritorio(actor)
    }
  }

  private avanzar(actor: Actor, dtMs: number): void {
    let restante = (VELOCIDAD * dtMs) / 1000
    while (restante > 0 && actor.camino.length > 0) {
      const siguiente = actor.camino[0]
      const dx = siguiente.x - actor.pos.x
      const dy = siguiente.y - actor.pos.y
      const distancia = Math.hypot(dx, dy)
      if (distancia > 0.01) {
        actor.mirada = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'derecha' : 'izquierda') : dy < 0 ? 'espalda' : 'frente'
      }
      if (distancia <= restante) {
        actor.pos = { ...siguiente }
        actor.camino.shift()
        restante -= distancia
      } else {
        actor.pos = { x: actor.pos.x + (dx / distancia) * restante, y: actor.pos.y + (dy / distancia) * restante }
        restante = 0
      }
    }
    if (actor.camino.length > 0) return

    if (actor.alLlegar === 'sentarse') {
      actor.modo = 'sentado'
      actor.pos = puntoSentado(actor.asiento)
      // Quien no tiene sesion dormita mas rato antes de levantarse otra vez.
      actor.proximaSalida = this.tiempo + (actor.estado === 'detenido' ? 25000 + Math.random() * 45000 : 12000 + Math.random() * 30000)
    } else {
      actor.modo = 'de-pie'
      actor.mirada = actor.alLlegar.mirada
      actor.frase = actor.alLlegar.frase
      actor.finActividad = this.tiempo + 4000 + Math.random() * 4000
    }
  }

  // --------------------------------------------------------------- dibujo

  private textura(actor: Actor): { textura: Texture; espejo: boolean } {
    const s = actor.sprites
    const t = this.tiempo
    const despierto = actor.estado !== 'detenido' || actor.modo !== 'sentado'
    if (despierto && t >= actor.proximoParpadeo) {
      actor.finParpadeo = t + 130
      actor.proximoParpadeo = t + 2500 + Math.random() * 4000
    }
    const parpadea = t < actor.finParpadeo

    if (actor.modo === 'sentado') {
      if (!despierto || parpadea) return { textura: s.sentado.cerrados, espejo: false }
      if (actor.estado === 'trabajando' && Math.floor((t + actor.fase) / 130) % 2) return { textura: s.sentado.teclea, espejo: false }
      return { textura: s.sentado.normal, espejo: false }
    }
    const caminando = actor.modo === 'caminando'
    const ciclo = Math.floor((t - actor.inicioPaso) / MS_PASO) % 4
    const pie = (vista: { quieto: Texture; pasos: [Texture, Texture] }): Texture =>
      !caminando || ciclo % 2 === 1 ? vista.quieto : vista.pasos[ciclo === 0 ? 0 : 1]
    switch (actor.mirada) {
      case 'espalda':
        return { textura: pie(s.espalda), espejo: false }
      case 'izquierda':
        return { textura: pie(s.lado), espejo: true }
      case 'derecha':
        return { textura: pie(s.lado), espejo: false }
      default:
        if (!caminando && parpadea) return { textura: s.frente.quietoCerrados, espejo: false }
        return { textura: pie(s.frente), espejo: false }
    }
  }

  private textoDelGlobo(actor: Actor): string | null {
    if (actor.modo === 'de-pie' && actor.frase) return actor.frase
    if (actor.modo !== 'sentado') return null
    switch (actor.estado) {
      case 'trabajando':
        return actor.herramienta ? textoHerramienta(actor.herramienta) : 'pensando…'
      case 'iniciando':
        return 'iniciando'
      case 'esperando':
        return 'esperando permiso'
      case 'pausado':
        return 'en pausa'
      case 'error':
        return '¡error!'
      default:
        return null
    }
  }

  private dibujarActor(actor: Actor): void {
    const { textura, espejo } = this.textura(actor)
    const c = actor.cuerpo
    if (c.texture !== textura) c.texture = textura
    c.scale.x = espejo ? -1 : 1
    const rebote = actor.modo === 'caminando' && Math.floor((this.tiempo - actor.inicioPaso) / MS_PASO) % 2 === 0 ? -1 : 0
    c.position.set(Math.round(actor.pos.x), Math.round(actor.pos.y) + rebote)
    c.zIndex = actor.pos.y

    const sentado = actor.modo === 'sentado'
    const trabajando = sentado && actor.estado === 'trabajando'
    actor.halo.visible = trabajando
    if (trabajando) actor.halo.alpha = 0.65 + Math.sin(this.tiempo / 300 + actor.fase) * 0.35

    actor.seleccion.position.set(Math.round(actor.pos.x), sentado ? actor.asiento.dy + 14 : Math.round(actor.pos.y))

    const cima = Math.round(actor.pos.y) - 30
    const etiquetaY = sentado ? actor.asiento.dy + (actor.asiento.mueble === 'recepcion' ? 37 : 31) : Math.round(actor.pos.y) + 5
    actor.etiqueta.position.set(Math.round(actor.pos.x), etiquetaY)
    actor.etiqueta.visible = this.mostrarNombres || actor.id === this.seleccionado

    // Monitor
    const t = this.tiempo
    let tinte = PANTALLA[actor.estado]
    if (actor.estado === 'iniciando') tinte = Math.floor(t / 300) % 2 ? PANTALLA.iniciando : 0x3a2a14
    if (actor.estado === 'trabajando') tinte = Math.floor((t + actor.fase) / 400) % 2 ? PANTALLA.trabajando : 0x5c8ade
    actor.pantalla.tint = tinte

    // Globo
    const texto = this.textoDelGlobo(actor)
    actor.globo.visible = !!texto
    if (texto) {
      const ancho = Math.ceil(actor.textoGlobo.width) + 7
      // El globo no se sale de la oficina; la colita sigue apuntando a la cabeza.
      const centro = limitar(Math.round(actor.pos.x), LIMITES.x + ancho / 2 + 1, LIMITES.x + LIMITES.ancho - ancho / 2 - 1)
      const cola = Math.round(actor.pos.x) - centro
      if (actor.textoGlobo.text !== texto || actor.colaGlobo !== cola) {
        actor.textoGlobo.text = texto
        actor.colaGlobo = cola
        const w = Math.ceil(actor.textoGlobo.width) + 7
        actor.fondoGlobo
          .clear()
          .roundRect(-w / 2, -5, w, 10, 2)
          .fill(0xfffdf8)
          .stroke({ width: 1, color: 0x2a1f26, alignment: 1 })
          .poly([cola - 2, 5, cola + 2, 5, cola - 1, 8])
          .fill(0xfffdf8)
      }
      actor.globo.position.set(centro, cima - 7)
    }

    // Zzz al dormir
    const durmiendo = sentado && actor.estado === 'detenido'
    actor.zzz.visible = durmiendo
    if (durmiendo) {
      const avance = ((t + actor.fase * 7) / 1800) % 1
      actor.zzz.position.set(actor.pos.x + 9 + avance * 3, cima + 4 - avance * 7)
      actor.zzz.alpha = 1 - avance
    }
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

  private origen(escala: number): Punto {
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
    this.mundo.position.set(Math.round(origen.x + this.camara.x), Math.round(origen.y + this.camara.y))
  }

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
    const paso = Math.min(dtMs, 100)
    this.tiempo += paso
    const { width, height } = this.app.screen
    if (width !== this.tamano.ancho || height !== this.tamano.alto) {
      this.tamano = { ancho: width, alto: height }
      this.aplicarCamara()
    }
    for (const actor of this.actores.values()) {
      this.decidir(actor)
      if (actor.modo === 'caminando') this.avanzar(actor, paso)
      this.dibujarActor(actor)
    }
    this.animarSobres(paso)
  }

  private animarSobres(dtMs: number): void {
    for (const sobre of this.sobres) {
      sobre.t = Math.min(1, sobre.t + dtMs / DURACION_SOBRE_MS)
      const t = sobre.t
      const suave = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      const desde = { x: sobre.de.pos.x, y: sobre.de.pos.y - 26 }
      const hasta = { x: sobre.para.pos.x, y: sobre.para.pos.y - 26 }
      const arco = Math.min(40, 10 + Math.hypot(hasta.x - desde.x, hasta.y - desde.y) * 0.25)
      sobre.g.x = desde.x + (hasta.x - desde.x) * suave
      sobre.g.y = desde.y + (hasta.y - desde.y) * suave - Math.sin(Math.PI * t) * arco
      sobre.g.rotation = Math.sin(Math.PI * t * 2) * 0.3
    }
    if (!this.sobres.some((s) => s.t >= 1)) return
    for (const sobre of this.sobres) if (sobre.t >= 1) sobre.g.destroy()
    this.sobres = this.sobres.filter((s) => s.t < 1)
  }
}
