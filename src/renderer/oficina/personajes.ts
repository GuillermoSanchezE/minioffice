import { Container, Graphics } from 'pixi.js'
import { personajeDe, type Apariencia, type Peinado } from '../../shared/reparto'

export type Orientacion = 'frente' | 'derecha' | 'izquierda'

export interface Figura {
  raiz: Container
  ojosAbiertos: Graphics
  ojosCerrados: Graphics
}

const OJOS = 0x1d2029
const LABIOS = 0x8a4038
const PANTALON = 0x2f3440
const ANCHO_TORSO = { delgada: 21, normal: 24, gruesa: 31 } as const
// Centro de la cabeza respecto a la cadera (el punto donde el personaje se sienta).
const CY = -37

function mezclar(color: number, destino: number, t: number): number {
  const canal = (c: number, s: number): number => (c >> s) & 0xff
  const r = Math.round(canal(color, 16) + (canal(destino, 16) - canal(color, 16)) * t)
  const g = Math.round(canal(color, 8) + (canal(destino, 8) - canal(color, 8)) * t)
  const b = Math.round(canal(color, 0) + (canal(destino, 0) - canal(color, 0)) * t)
  return (r << 16) | (g << 8) | b
}

const oscurecer = (color: number, t: number): number => mezclar(color, 0x000000, t)
const aclarar = (color: number, t: number): number => mezclar(color, 0xffffff, t)

// --------------------------------------------------------------- apariencia

const PIELES = [0xf2cfae, 0xe8bd96, 0xd4a176, 0xb07a52, 0x7a4b2e]
const PELOS = [0x2b2018, 0x5b3f2a, 0x8a6a45, 0xd8b56a, 0x1a1a1a, 0x9a9a9a]
const CAMISAS = [0x4f8cff, 0xff8a4f, 0x3fcf8e, 0xc77dff, 0xffc94f, 0x4fd6ff, 0xff5f8f]
const PEINADOS: Peinado[] = ['corto', 'despeinado', 'largo', 'bob', 'rizado', 'raya']

function hash(texto: string): number {
  let h = 0
  for (const letra of texto) h = (h * 31 + letra.charCodeAt(0)) >>> 0
  return h
}

/** Apariencia del personaje del reparto, o una generada a partir del id para agentes propios. */
export function aparienciaDe(id: string): Apariencia {
  const personaje = personajeDe(id)
  if (personaje) return personaje.apariencia
  const h = hash(id)
  return {
    piel: PIELES[h % PIELES.length],
    pelo: PELOS[(h >>> 3) % PELOS.length],
    peinado: PEINADOS[(h >>> 6) % PEINADOS.length],
    camisa: CAMISAS[(h >>> 9) % CAMISAS.length],
    prenda: 'camisa'
  }
}

/** Color que identifica al personaje en listas y chat: su prenda principal. */
export function colorPrincipal(ap: Apariencia): number {
  return ap.prenda === 'camisa' ? ap.camisa : (ap.colorPrenda ?? ap.camisa)
}

// ------------------------------------------------------------------- dibujo

export function crearFigura(ap: Apariencia, orientacion: Orientacion): Figura {
  const raiz = new Container()
  raiz.scale.set(ap.altura ?? 1)

  const cuerpo = new Graphics()
  const ojosAbiertos = new Graphics()
  const ojosCerrados = new Graphics()
  const lentes = new Graphics()

  if (orientacion === 'frente') {
    dibujarFrente(cuerpo, ap)
    ojosAbiertos.circle(-4, CY + 0.5, 1.6).circle(4, CY + 0.5, 1.6).fill(OJOS)
    for (const x of [-4, 4]) {
      ojosCerrados.moveTo(x - 2, CY + 0.8).quadraticCurveTo(x, CY + 2.2, x + 2, CY + 0.8)
    }
    ojosCerrados.stroke({ width: 1.2, color: OJOS })
    if (ap.lentes) {
      lentes
        .roundRect(-7.8, CY - 2, 6.6, 5, 1.6)
        .roundRect(1.2, CY - 2, 6.6, 5, 1.6)
        .moveTo(-1.2, CY - 0.2)
        .lineTo(1.2, CY - 0.2)
        .stroke({ width: 1.2, color: 0x2b2f3a })
    }
  } else {
    dibujarPerfil(cuerpo, ap)
    ojosAbiertos.circle(6.8, CY, 1.6).fill(OJOS)
    ojosCerrados.moveTo(5.2, CY + 0.4).quadraticCurveTo(6.8, CY + 1.8, 8.4, CY + 0.4).stroke({ width: 1.2, color: OJOS })
    if (ap.lentes) {
      lentes
        .roundRect(3.8, CY - 2.5, 6.4, 5, 1.6)
        .moveTo(3.8, CY - 0.6)
        .lineTo(-1.5, CY - 0.6)
        .stroke({ width: 1.2, color: 0x2b2f3a })
    }
  }

  ojosCerrados.visible = false
  raiz.addChild(cuerpo, ojosAbiertos, ojosCerrados, lentes)
  return { raiz, ojosAbiertos, ojosCerrados }
}

function colores(ap: Apariencia): { torso: number; mangas: number } {
  const torso = colorPrincipal(ap)
  const mangas = ap.prenda === 'traje' || ap.prenda === 'cardigan' ? torso : ap.camisa
  return { torso, mangas }
}

function dibujarFrente(g: Graphics, ap: Apariencia): void {
  const mitad = ANCHO_TORSO[ap.complexion ?? 'normal'] / 2
  const { torso, mangas } = colores(ap)

  // Pelo largo: va detras de hombros y cabeza
  if (ap.peinado === 'largo') g.roundRect(-14, -49, 28, 36, 9).fill(ap.pelo)
  if (ap.peinado === 'bob') g.roundRect(-14, -48, 28, 22, 9).fill(ap.pelo)

  // Brazos
  for (const x of [-mitad - 5, mitad - 3]) {
    if (ap.mangasCortas) {
      g.roundRect(x, -21, 8, 24, 4).fill(ap.piel)
      g.roundRect(x, -21, 8, 10, 4).fill(mangas)
    } else {
      g.roundRect(x, -21, 8, 24, 4).fill(mangas)
    }
  }

  // Torso y prenda
  g.roundRect(-mitad, -24, mitad * 2, 30, 8).fill(torso)
  if (ap.prenda === 'traje') g.poly([-6, -24, 6, -24, 0, -7]).fill(ap.camisa)
  if (ap.prenda === 'chaleco') g.poly([-6, -24, 6, -24, 0, -12]).fill(ap.camisa)
  if (ap.prenda === 'cardigan') g.rect(-4, -23, 8, 29).fill(ap.camisa)

  if (ap.corbata !== undefined || ap.prenda === 'traje') {
    const cuello = aclarar(ap.camisa, 0.35)
    g.poly([-5.5, -24, -1, -24, -3.5, -19]).fill(cuello)
    g.poly([1, -24, 5.5, -24, 3.5, -19]).fill(cuello)
  }
  if (ap.corbata !== undefined) {
    g.rect(-1.8, -23, 3.6, 3).fill(oscurecer(ap.corbata, 0.2))
    g.poly([-2, -20, 2, -20, 3.2, -9, 0, -6, -3.2, -9]).fill(ap.corbata)
  }

  // Cuello y cabeza
  g.rect(-3.5, -28, 7, 5).fill(oscurecer(ap.piel, 0.08))
  g.circle(-11, CY + 1, 2.8).circle(11, CY + 1, 2.8).fill(oscurecer(ap.piel, 0.1))
  g.circle(0, CY, 11).fill(ap.piel)

  if (ap.barba !== undefined) {
    g.moveTo(11.3, CY).arc(0, CY, 11.3, 0, Math.PI).closePath().fill(ap.barba)
    g.ellipse(0, CY - 0.5, 7.5, 6).fill(ap.piel)
  }

  peloFrente(g, ap)

  g.circle(0, CY + 3.2, 1.2).fill(oscurecer(ap.piel, 0.15))
  if (ap.bigote !== undefined) g.roundRect(-5, CY + 4.3, 10, 2.8, 1.4).fill(ap.bigote)
  boca(g, ap, -3, 3, CY + 7.3)
}

function dibujarPerfil(g: Graphics, ap: Apariencia): void {
  const { torso, mangas } = colores(ap)

  if (ap.peinado === 'largo') g.roundRect(-13, -49, 14, 36, 7).fill(ap.pelo)
  if (ap.peinado === 'bob') g.roundRect(-13, -48, 14, 22, 7).fill(ap.pelo)

  // Pierna sentada, bajo el escritorio
  g.roundRect(-6, 1, 19, 7, 3.5).fill(PANTALON)

  // Torso y prenda
  const grueso = ap.complexion === 'gruesa' ? 3 : 0
  g.roundRect(-9 - grueso, -24, 18 + grueso * 2, 30, 7).fill(torso)
  if (ap.prenda !== 'camisa') g.rect(5 + grueso, -23, 3, ap.prenda === 'cardigan' ? 28 : 14).fill(ap.camisa)
  if (ap.corbata !== undefined) g.poly([6 + grueso, -21, 9 + grueso, -21, 9.6 + grueso, -9, 7.6 + grueso, -6.5, 6 + grueso, -9]).fill(ap.corbata)

  // Cuello y cabeza
  g.rect(-2, -28, 6, 5).fill(oscurecer(ap.piel, 0.08))
  g.circle(1, CY, 11).fill(ap.piel)
  g.circle(11.4, CY + 2.6, 2.2).fill(ap.piel)

  if (ap.barba !== undefined) {
    g.poly([-3, CY + 1, 5, CY + 3, 12, CY + 5.5, 10, CY + 10.5, 1, CY + 11.5, -4, CY + 6]).fill(ap.barba)
  }

  peloPerfil(g, ap)

  g.circle(-2, CY + 1, 2.8).fill(oscurecer(ap.piel, 0.1))
  if (ap.bigote !== undefined) g.roundRect(7, CY + 4.6, 5.8, 2.4, 1.2).fill(ap.bigote)
  boca(g, ap, 7.2, 10.6, CY + 7.6)

  // Brazo apoyado en el teclado
  if (ap.mangasCortas) {
    g.roundRect(-3, -22, 8, 16, 4).fill(ap.piel)
    g.roundRect(-3, -22, 8, 8, 4).fill(mangas)
    g.roundRect(1, -12.5, 19, 6.5, 3.2).fill(ap.piel)
  } else {
    g.roundRect(-3, -22, 8, 16, 4).fill(mangas)
    g.roundRect(1, -12.5, 19, 6.5, 3.2).fill(mangas)
  }
  g.circle(21, -9.4, 3.2).fill(ap.piel)
}

function boca(g: Graphics, ap: Apariencia, x1: number, x2: number, y: number): void {
  const medio = (x1 + x2) / 2
  const trazo = { width: 1.3, color: LABIOS }
  switch (ap.boca ?? 'sonrisa') {
    case 'sonrisa':
      g.moveTo(x1, y).quadraticCurveTo(medio, y + 2.4, x2, y).stroke(trazo)
      break
    case 'seria':
      g.moveTo(x1 + 0.5, y + 0.8).lineTo(x2 - 0.5, y + 0.8).stroke(trazo)
      break
    case 'triste':
      g.moveTo(x1, y + 1.8).quadraticCurveTo(medio, y - 0.6, x2, y + 1.8).stroke(trazo)
      break
  }
}

/** Casquete de pelo: media cupula sobre la cabeza. */
function casquete(g: Graphics, cx: number, cy: number, r: number, color: number, alpha = 1): void {
  g.moveTo(cx - r, cy).arc(cx, cy, r, Math.PI, Math.PI * 2).closePath().fill({ color, alpha })
}

function peloFrente(g: Graphics, ap: Apariencia): void {
  const c = ap.pelo
  switch (ap.peinado) {
    case 'corto':
      casquete(g, 0, CY - 3, 11.8, c)
      g.rect(-11.6, CY - 3, 2.6, 6).rect(9, CY - 3, 2.6, 6).fill(c)
      break
    case 'raya':
      casquete(g, 0, CY - 3, 12, c)
      g.rect(-12, CY - 4, 3.2, 8).rect(8.8, CY - 4, 3.2, 8).rect(-10, CY - 5, 20, 3).fill(c)
      g.moveTo(-3, CY - 14).lineTo(-2, CY - 6).stroke({ width: 1, color: oscurecer(c, 0.45) })
      break
    case 'despeinado':
      casquete(g, 0, CY - 3, 12, c)
      g.circle(-7, CY - 12, 4.5).circle(-1, CY - 15, 5).circle(6, CY - 13, 4.5).circle(10, CY - 9, 3.5).fill(c)
      g.poly([-11, CY - 3, -4, CY - 7, 3, CY - 4, 9, CY - 7, 11, CY - 3]).fill(c)
      break
    case 'largo':
      casquete(g, 0, CY - 3, 12, c)
      g.roundRect(-13.2, CY - 6, 5, 21, 2.5).roundRect(8.2, CY - 6, 5, 21, 2.5).fill(c)
      g.poly([-12, CY - 3, -2, CY - 8, 6, CY - 5, 12, CY - 3]).fill(c)
      break
    case 'bob':
      casquete(g, 0, CY - 3, 12.2, c)
      g.roundRect(-13.4, CY - 6, 5, 15, 2.5).roundRect(8.4, CY - 6, 5, 15, 2.5).fill(c)
      break
    case 'moño':
      g.circle(0, CY - 14, 5.5).fill(c)
      casquete(g, 0, CY - 3, 11.4, c)
      g.rect(-2.5, CY - 10.5, 5, 1.6).fill(oscurecer(c, 0.3))
      break
    case 'calvo':
      casquete(g, 0, CY - 3, 11.2, c, 0.25)
      break
    case 'calvoLados':
      g.roundRect(-12.5, CY - 5, 4, 9, 2).roundRect(8.5, CY - 5, 4, 9, 2).fill(c)
      break
    case 'entradas':
      casquete(g, 0, CY - 6.5, 10, c)
      g.rect(-11.6, CY - 6.5, 2.6, 9).rect(9, CY - 6.5, 2.6, 9).fill(c)
      break
    case 'rizado':
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI + (i * Math.PI) / 6
        g.circle(Math.cos(a) * 11, CY - 3 + Math.sin(a) * 11, 4.2)
      }
      g.circle(-12, CY + 2, 3.6).circle(12, CY + 2, 3.6).fill(c)
      casquete(g, 0, CY - 3, 11.6, c)
      break
  }
}

function peloPerfil(g: Graphics, ap: Apariencia): void {
  const c = ap.pelo
  const nuca = (alto = 9): void => {
    g.roundRect(-11.4, CY - 4, 8.5, alto, 3.5).fill(c)
  }
  switch (ap.peinado) {
    case 'corto':
      casquete(g, 0.5, CY - 3, 11.8, c)
      nuca()
      break
    case 'raya':
      casquete(g, 0.5, CY - 3, 12, c)
      nuca(11)
      g.roundRect(2, CY - 6, 10.5, 3, 1.5).fill(c)
      break
    case 'despeinado':
      casquete(g, 0.5, CY - 3, 12, c)
      nuca()
      g.circle(-6, CY - 12, 4.5).circle(0, CY - 15, 5).circle(6, CY - 13, 4.5).circle(10.5, CY - 8, 3.5).fill(c)
      break
    case 'largo':
    case 'bob':
      casquete(g, 0.5, CY - 3, 12.2, c)
      nuca(ap.peinado === 'largo' ? 16 : 12)
      break
    case 'moño':
      g.circle(-9.5, CY - 10, 5.5).fill(c)
      casquete(g, 0.5, CY - 3, 11.4, c)
      nuca()
      break
    case 'calvo':
      casquete(g, 0.5, CY - 3, 11.2, c, 0.25)
      break
    case 'calvoLados':
      g.roundRect(-11.6, CY - 5, 9, 10, 3.5).fill(c)
      break
    case 'entradas':
      casquete(g, -1.5, CY - 6, 10, c)
      nuca(10)
      break
    case 'rizado':
      for (let i = 0; i <= 5; i++) {
        const a = Math.PI + (i * Math.PI) / 6
        g.circle(0.5 + Math.cos(a) * 11, CY - 3 + Math.sin(a) * 11, 4.2)
      }
      g.circle(-10, CY + 2, 3.8).fill(c)
      casquete(g, 0.5, CY - 3, 11.6, c)
      nuca(10)
      break
  }
}
