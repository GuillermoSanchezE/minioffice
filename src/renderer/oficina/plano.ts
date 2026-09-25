import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js'
import type { Orientacion } from './personajes'

/**
 * Plano de la oficina, inspirado en Dunder Mifflin Scranton: la recepción de
 * Pam junto a la entrada, la oficina de Michael al lado, Jim frente a Dwight,
 * Phyllis frente a Stanley, el rincón de contabilidad junto a la cocina y el
 * anexo al fondo con Kelly, Ryan y Toby.
 */

export type Mueble = 'normal' | 'ejecutivo' | 'recepcion'
export type Objeto = 'taza' | 'dulces' | 'gelatina' | 'gato' | 'bombones' | 'crucigrama' | 'tejido' | 'revista'

export interface Asiento {
  x: number
  y: number
  orientacion: Orientacion
  mueble?: Mueble
  objeto?: Objeto
}

export const ANCHO = 1000
export const ALTO = 620

/** Zona visible completa (incluye el pasillo de la entrada y los muros). */
export const LIMITES = { x: -22, y: -54, ancho: ANCHO + 44, alto: ALTO + 72 }

export const ASIENTOS: Record<string, Asiento> = {
  michael: { x: 115, y: 82, orientacion: 'frente', mueble: 'ejecutivo', objeto: 'taza' },
  pam: { x: 335, y: 72, orientacion: 'frente', mueble: 'recepcion', objeto: 'dulces' },
  andy: { x: 115, y: 245, orientacion: 'frente' },
  dwight: { x: 300, y: 250, orientacion: 'derecha', objeto: 'gelatina' },
  jim: { x: 424, y: 250, orientacion: 'izquierda' },
  phyllis: { x: 300, y: 365, orientacion: 'derecha', objeto: 'tejido' },
  stanley: { x: 424, y: 365, orientacion: 'izquierda', objeto: 'crucigrama' },
  angela: { x: 675, y: 248, orientacion: 'frente', objeto: 'gato' },
  oscar: { x: 614, y: 368, orientacion: 'derecha' },
  kevin: { x: 736, y: 368, orientacion: 'izquierda', objeto: 'bombones' },
  creed: { x: 95, y: 530, orientacion: 'frente' },
  meredith: { x: 215, y: 530, orientacion: 'frente' },
  kelly: { x: 855, y: 272, orientacion: 'frente', objeto: 'revista' },
  ryan: { x: 948, y: 272, orientacion: 'frente' },
  toby: { x: 900, y: 412, orientacion: 'frente' }
}

/** Escritorios para agentes que no son del reparto, en orden de uso. */
export const ASIENTOS_LIBRES: Asiento[] = [
  { x: 340, y: 530, orientacion: 'frente' },
  { x: 460, y: 530, orientacion: 'frente' },
  { x: 855, y: 545, orientacion: 'frente' },
  { x: 948, y: 545, orientacion: 'frente' },
  { x: 520, y: 250, orientacion: 'frente' },
  { x: 520, y: 365, orientacion: 'frente' }
]

// ------------------------------------------------------------------ colores

const MURO = 0xb9ae98
const MURO_EXTERIOR = 0x8f8573
const VIDRIO = 0x8fb8de
const ALFOMBRA = 0x3e4659
const MADERA = 0x9a7a55
const SILLA = 0x2e3440

const estiloSala: TextStyleOptions = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 11,
  fontWeight: '600',
  letterSpacing: 0.5,
  fill: 0xaab4c8
}

function rotulo(texto: string, x: number, y: number, estilo: Partial<TextStyleOptions> = {}): Text {
  const t = new Text({ text: texto, style: { ...estiloSala, ...estilo }, resolution: 4 })
  t.anchor.set(0.5)
  t.position.set(x, y)
  return t
}

// ------------------------------------------------------------------- piezas

const GROSOR = 6

function muroH(g: Graphics, x1: number, x2: number, y: number): void {
  g.rect(x1, y - GROSOR / 2, x2 - x1, GROSOR).fill(MURO)
}

function muroV(g: Graphics, x: number, y1: number, y2: number): void {
  g.rect(x - GROSOR / 2, y1, GROSOR, y2 - y1).fill(MURO)
}

function ventanaH(g: Graphics, x1: number, x2: number, y: number, grosor = 4): void {
  g.rect(x1, y - grosor / 2, x2 - x1, grosor).fill(VIDRIO)
  for (let x = x1 + 22; x < x2; x += 22) g.rect(x - 0.75, y - grosor / 2, 1.5, grosor).fill(0xe6eef7)
}

function ventanaV(g: Graphics, x: number, y1: number, y2: number, grosor = 4): void {
  g.rect(x - grosor / 2, y1, grosor, y2 - y1).fill(VIDRIO)
  for (let y = y1 + 22; y < y2; y += 22) g.rect(x - grosor / 2, y - 0.75, grosor, 1.5).fill(0xe6eef7)
}

/** Persianas de las ventanas interiores (oficina de Michael y sala de conferencias). */
function persianaH(g: Graphics, x1: number, x2: number, y: number): void {
  g.rect(x1, y - 2, x2 - x1, 4).fill(0xc9d6e3)
  for (let x = x1 + 3; x < x2; x += 4) g.rect(x, y - 2, 1, 4).fill(0x9fb0c2)
}

function puerta(g: Graphics, x: number, y: number, ancho: number, hacia: 'abajo' | 'arriba' | 'derecha' | 'izquierda'): void {
  const trazo = { width: 1, color: 0x7d8699, alpha: 0.8 }
  switch (hacia) {
    case 'abajo':
      g.moveTo(x, y).lineTo(x, y + ancho).stroke(trazo)
      g.moveTo(x, y + ancho).arc(x, y, ancho, Math.PI / 2, 0, true).stroke({ ...trazo, alpha: 0.4 })
      break
    case 'arriba':
      g.moveTo(x, y).lineTo(x, y - ancho).stroke(trazo)
      g.moveTo(x, y - ancho).arc(x, y, ancho, -Math.PI / 2, 0).stroke({ ...trazo, alpha: 0.4 })
      break
    case 'derecha':
      g.moveTo(x, y).lineTo(x + ancho, y).stroke(trazo)
      g.moveTo(x + ancho, y).arc(x, y, ancho, 0, Math.PI / 2).stroke({ ...trazo, alpha: 0.4 })
      break
    case 'izquierda':
      g.moveTo(x, y).lineTo(x - ancho, y).stroke(trazo)
      g.moveTo(x - ancho, y).arc(x, y, ancho, Math.PI, Math.PI / 2, true).stroke({ ...trazo, alpha: 0.4 })
      break
  }
}

function planta(g: Graphics, x: number, y: number): void {
  g.roundRect(x - 7, y + 2, 14, 10, 3).fill(0x8a5a3c)
  g.circle(x, y - 3, 11).fill(0x3f8f55)
  g.circle(x - 6, y - 7, 7).circle(x + 5, y - 9, 6).fill(0x4fae68)
}

function sillaSuelta(g: Graphics, x: number, y: number): void {
  g.roundRect(x - 8, y - 8, 16, 16, 4).fill(SILLA)
  g.roundRect(x - 8, y - 8, 16, 5, 2).fill(0x3a4150)
}

function archivero(g: Graphics, x: number, y: number, ancho: number, alto: number): void {
  g.roundRect(x, y, ancho, alto, 2).fill(0x8b93a3)
  const cajones = Math.max(1, Math.round(alto / 18))
  for (let i = 1; i < cajones; i++) g.rect(x + 1, y + (alto / cajones) * i - 0.5, ancho - 2, 1).fill(0x6b7383)
  for (let i = 0; i < cajones; i++) g.rect(x + ancho / 2 - 3, y + (alto / cajones) * i + 3, 6, 1.5).fill(0xd6dbe4)
}

// -------------------------------------------------------------------- plano

export function dibujarPlano(): Container {
  const plano = new Container()
  const suelo = new Graphics()
  const g = new Graphics()

  // ---- Suelos
  suelo.rect(-10, -10, ANCHO + 20, ALTO + 20).fill(MURO_EXTERIOR)
  suelo.rect(0, 0, ANCHO, ALTO).fill(ALFOMBRA)
  for (let x = 0; x < ANCHO; x += 40) suelo.rect(x, 0, 1, ALTO).fill({ color: 0xffffff, alpha: 0.025 })
  for (let y = 0; y < ALTO; y += 40) suelo.rect(0, y, ANCHO, 1).fill({ color: 0xffffff, alpha: 0.025 })
  suelo.rect(0, 0, 230, 175).fill(0x4a4f63) // oficina de Michael
  suelo.rect(560, 0, 230, 175).fill(0x434b5f) // sala de conferencias
  suelo.rect(790, 0, 210, 175).fill(0x4d5263) // sala de descanso
  suelo.rect(790, 175, 210, 445).fill(0x3b4254) // anexo
  suelo.roundRect(575, 195, 200, 262, 10).fill(0x434c61) // contabilidad
  suelo.roundRect(262, 36, 150, 96, 12).fill(0x4b5367) // alfombra de recepción
  for (let x = 560; x < 790; x += 20) {
    for (let y = 470; y < ALTO; y += 20) {
      suelo.rect(x, y, 20, 20).fill(((x + y) / 20) % 2 === 0 ? 0x6b6f78 : 0x62666f) // cocina
    }
  }
  // Pasillo de la entrada
  suelo.rect(396, -46, 170, 36).fill(0x2c3140)
  suelo.rect(396, -50, 170, 4).fill(MURO_EXTERIOR)
  suelo.rect(470, -46, 44, 6).fill(0x8b93a3) // puertas del ascensor
  suelo.rect(491.5, -46, 1, 6).fill(0x5b6273)
  plano.addChild(suelo)

  // ---- Ventanas exteriores
  ventanaH(g, 18, 212, -3, 5)
  ventanaH(g, 578, 772, -3, 5)
  ventanaH(g, 808, 990, -3, 5)
  ventanaV(g, -3, 18, 158, 5)
  ventanaV(g, -3, 196, 300, 5)
  ventanaV(g, -3, 440, 600, 5)
  ventanaH(g, 20, 540, ALTO + 3, 5)
  ventanaH(g, 580, 770, ALTO + 3, 5)
  ventanaH(g, 810, 990, ALTO + 3, 5)
  ventanaV(g, ANCHO + 3, 196, 600, 5)

  // ---- Muros interiores
  // Oficina de Michael
  muroV(g, 230, 0, 175)
  muroH(g, 0, 180, 175)
  persianaH(g, 20, 160, 175)
  puerta(g, 220, 178, 38, 'izquierda')
  // Entrada desde el pasillo: puertas de vidrio en el muro superior
  g.rect(440, -10, 70, 10).fill(0x2c3140)
  g.rect(441, -6, 33, 3).rect(476, -6, 33, 3).fill({ color: VIDRIO, alpha: 0.9 })
  // Sala de conferencias
  muroV(g, 560, 0, 175)
  muroH(g, 610, 790, 175)
  persianaH(g, 630, 775, 175)
  puerta(g, 572, 178, 36, 'derecha')
  // Sala de descanso
  muroV(g, 790, 0, 175)
  muroH(g, 840, 1000, 175)
  puerta(g, 802, 172, 36, 'derecha')
  // Anexo
  muroV(g, 790, 175, 200)
  muroV(g, 790, 240, 575)
  muroV(g, 790, 612, ALTO)
  puerta(g, 793, 202, 36, 'abajo')
  puerta(g, 793, 577, 34, 'abajo')
  // Cocina
  muroH(g, 560, 600, 470)
  muroH(g, 645, 790, 470)
  muroV(g, 560, 470, ALTO)
  puerta(g, 602, 467, 40, 'arriba')

  // ---- Oficina de Michael
  g.roundRect(8, 58, 24, 96, 6).fill(0x6d4c41) // sofá
  g.roundRect(8, 58, 10, 96, 5).fill(0x5d4037)
  g.roundRect(188, 6, 36, 34, 2).fill(0x6e4b33) // librero
  for (let y = 14; y < 40; y += 9) g.rect(190, y, 32, 1.5).fill(0x4e3423)
  g.rect(192, 8, 4, 5).rect(198, 8, 3, 5).rect(203, 8, 5, 5).fill(0xc0392b)
  g.rect(192, 17, 6, 5).rect(200, 17, 3, 5).fill(0x2e86de)
  sillaSuelta(g, 88, 142)
  sillaSuelta(g, 142, 142)
  planta(g, 210, 150)

  // ---- Recepción
  g.roundRect(298, 1, 74, 13, 3).fill(0x1f2430) // letrero
  archivero(g, 238, 128, 34, 32) // fotocopiadora
  g.rect(238, 128, 34, 8).fill(0xd6dbe4)
  g.rect(242, 131, 22, 2).fill(0x2e86de)
  sillaSuelta(g, 530, 26)
  sillaSuelta(g, 530, 52)
  g.roundRect(538, 118, 14, 26, 3).fill(0xe5ecf4) // dispensador de agua
  g.roundRect(539, 110, 12, 12, 5).fill({ color: 0x74b9ff, alpha: 0.85 })
  planta(g, 424, 138)

  // ---- Sala de conferencias
  g.rect(640, 5, 70, 5).fill(0xf4f6f8) // pizarra
  const sillasMesa: Array<[number, number]> = [
    [628, 50],
    [660, 50],
    [692, 50],
    [724, 50],
    [628, 128],
    [660, 128],
    [692, 128],
    [724, 128],
    [594, 89],
    [758, 89]
  ]
  for (const [x, y] of sillasMesa) sillaSuelta(g, x, y)
  g.roundRect(606, 60, 140, 58, 26).fill(0x7a5236)
  g.roundRect(612, 64, 128, 50, 22).fill(0x8b6040)
  g.roundRect(783, 50, 5, 70, 1).fill(0x14171f) // televisión

  // ---- Sala de descanso
  g.roundRect(876, 6, 38, 40, 3).fill(0xc0392b) // máquina de snacks
  g.roundRect(880, 10, 24, 30, 2).fill(0x2d1b1b)
  for (let y = 13; y < 38; y += 6) for (let x = 882; x < 902; x += 5) g.rect(x, y, 3, 3).fill(0xf5b041)
  g.roundRect(920, 6, 38, 40, 3).fill(0x2e5aa8) // máquina de bebidas
  g.roundRect(924, 10, 24, 30, 2).fill(0xdfe9f4)
  for (let x = 926; x < 946; x += 6) g.rect(x, 13, 4, 24).fill(0x3c8dde)
  sillaSuelta(g, 880, 112)
  sillaSuelta(g, 920, 112)
  sillaSuelta(g, 900, 136)
  g.circle(900, 110, 20).fill(0xd8d2c4)
  planta(g, 978, 150)

  // ---- Bullpen
  archivero(g, 4, 310, 22, 110)
  planta(g, 26, 205)
  planta(g, 26, 455)
  planta(g, 545, 455)

  // ---- Contabilidad
  archivero(g, 740, 200, 44, 22)

  // ---- Cocina
  g.roundRect(572, 588, 170, 28, 2).fill(0xcfd4dc) // encimera
  g.roundRect(590, 594, 26, 16, 3).fill(0x9aa3b1) // fregadero
  g.roundRect(640, 591, 28, 16, 2).fill(0x2b2f3a) // microondas
  g.rect(643, 594, 18, 10).fill(0x4b5566)
  g.roundRect(680, 592, 14, 16, 2).fill(0x1f2430) // cafetera
  g.roundRect(744, 478, 40, 52, 3).fill(0xe8ecf1) // refrigerador
  g.rect(744, 500, 40, 1.5).fill(0xb8c0cc)
  g.rect(778, 484, 2, 12).rect(778, 504, 2, 18).fill(0x9aa3b1)
  sillaSuelta(g, 600, 540)
  sillaSuelta(g, 690, 540)
  g.roundRect(612, 520, 66, 40, 6).fill(0xd8d2c4)

  // ---- Anexo
  archivero(g, 976, 330, 20, 70)
  planta(g, 985, 604)

  plano.addChild(g)

  // ---- Rótulos
  plano.addChild(
    rotulo('DUNDER MIFFLIN', 335, 7.5, { fontSize: 7, fill: 0xf4f6f8, letterSpacing: 1 }),
    rotulo('Entrada · Ascensor', 481, -30, { fontSize: 10, fill: 0x8b93a7 }),
    rotulo('Oficina de Michael', 115, 164),
    rotulo('Recepción', 478, 112),
    rotulo('Sala de conferencias', 675, 163),
    rotulo('Sala de descanso', 900, 163),
    rotulo('Contabilidad', 675, 443),
    rotulo('Cocina', 715, 488),
    rotulo('Anexo', 900, 196)
  )

  return plano
}

// ---------------------------------------------------------------- mobiliario

/** Escritorio visto de frente: el personaje queda detras y asoma de la cintura para arriba. */
export function escritorioFrente(g: Graphics, mueble: Mueble): { etiquetaY: number } {
  switch (mueble) {
    case 'ejecutivo':
      g.roundRect(-62, -8, 124, 20, 3).fill(0x7a5236)
      g.roundRect(-62, 12, 124, 18, 2).fill(0x5e3e28)
      g.rect(-58, 14, 116, 1.5).fill(0x8b6040)
      return { etiquetaY: 42 }
    case 'recepcion':
      g.roundRect(-50, -8, 100, 16, 3).fill(0xb89a74)
      g.roundRect(-56, 8, 112, 26, 4).fill(0x8c6d4d)
      g.roundRect(-58, 4, 116, 6, 3).fill(0xd8c3a0)
      return { etiquetaY: 46 }
    default:
      g.roundRect(-44, -8, 88, 18, 3).fill(MADERA)
      g.roundRect(-44, 10, 88, 16, 2).fill(0x7a5f42)
      return { etiquetaY: 38 }
  }
}

export function sillaFrente(g: Graphics): void {
  g.roundRect(-17, -40, 34, 36, 8).fill(SILLA)
}

/** Escritorio de lado: el personaje mira hacia la derecha (se refleja para la izquierda). */
export function escritorioLado(g: Graphics): void {
  g.roundRect(12, -30, 52, 24, 3).fill(MADERA)
  g.roundRect(12, -6, 52, 10, 2).fill(0x7a5f42)
}

export function sillaLado(g: Graphics): void {
  g.roundRect(-18, -32, 7, 32, 3).fill(SILLA)
  g.roundRect(-14, -2, 24, 9, 4).fill(0x353c4a)
}

export function monitor(marco: Graphics, pantalla: Graphics, x: number, y: number): void {
  marco.roundRect(x, y, 24, 18, 2).fill(0x14171f)
  marco.rect(x + 10, y + 18, 4, 5).fill(0x14171f)
  pantalla.roundRect(x + 2, y + 2, 20, 14, 1).fill(0xffffff)
}

export function teclado(g: Graphics, x: number, y: number, ancho: number): void {
  g.roundRect(x, y, ancho, 6, 1.5).fill(0xd5d9e0)
  g.rect(x + 2, y + 2, ancho - 4, 1).fill(0xaeb5c1)
}

export function objeto(g: Graphics, tipo: Objeto, x: number, y: number): void {
  switch (tipo) {
    case 'taza':
      g.roundRect(x - 4, y - 7, 8, 9, 2).fill(0xf4f6f8)
      g.circle(x + 5, y - 3, 2.6).stroke({ width: 1.2, color: 0xf4f6f8 })
      g.rect(x - 2.5, y - 4, 5, 1).fill(0x2b2f3a)
      break
    case 'dulces':
      g.circle(x, y - 4, 6).fill({ color: 0xcfe6f5, alpha: 0.7 })
      for (const [dx, dy, c] of [
        [-2, -3, 0xe74c3c],
        [2, -5, 0xf1c40f],
        [0, -1, 0x2ecc71],
        [3, -1, 0x9b59b6],
        [-3, -6, 0x3498db]
      ]) {
        g.circle(x + dx, y + dy, 1.4).fill(c)
      }
      g.rect(x - 4, y - 11, 8, 2).fill(0xe5ecf4)
      break
    case 'gelatina':
      g.roundRect(x - 7, y - 8, 14, 11, 2).fill({ color: 0xd4e157, alpha: 0.9 })
      g.roundRect(x - 4, y - 4, 8, 3, 1).fill(0x2b2f3a)
      break
    case 'gato':
      g.roundRect(x - 5, y - 10, 10, 10, 1).fill(0xe7a1c0)
      g.rect(x - 3.5, y - 8.5, 7, 7).fill(0xf5e8ee)
      g.circle(x, y - 4, 2.2).poly([x - 2, y - 5.5, x - 1, y - 8, x, y - 5.5]).poly([x, y - 5.5, x + 1, y - 8, x + 2, y - 5.5]).fill(0x4b4f58)
      break
    case 'bombones':
      g.ellipse(x, y - 2, 7, 4).fill(0xeeeeee)
      for (const [dx, c] of [
        [-4, 0xe74c3c],
        [-1, 0xf1c40f],
        [2, 0x2ecc71],
        [4.5, 0x3498db]
      ]) {
        g.circle(x + dx, y - 3, 1.5).fill(c)
      }
      break
    case 'crucigrama':
      g.rect(x - 6, y - 8, 12, 10).fill(0xf4f6f8)
      for (let i = 1; i < 4; i++) {
        g.rect(x - 6 + i * 3, y - 8, 0.6, 10).rect(x - 6, y - 8 + i * 2.5, 12, 0.6)
      }
      g.fill(0x6b7383)
      break
    case 'tejido':
      g.circle(x, y - 3, 4.5).fill(0xb56576)
      g.moveTo(x - 3, y - 5).quadraticCurveTo(x, y - 1, x + 3, y - 6).stroke({ width: 0.8, color: 0x8e4a5a })
      g.moveTo(x + 2, y - 10).lineTo(x + 6, y).stroke({ width: 1, color: 0xd8d2c4 })
      break
    case 'revista':
      g.rect(x - 6, y - 8, 12, 9).fill(0xff6fb5)
      g.rect(x - 4, y - 6, 8, 1.5).rect(x - 4, y - 3, 5, 1).fill(0xffffff)
      break
  }
}
