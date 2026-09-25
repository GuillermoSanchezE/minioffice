import type { Texture } from 'pixi.js'
import { Lienzo, aclarar, oscurecer } from '../pixel/lienzo'

/**
 * Plano de la oficina en pixeles, inspirado en Dunder Mifflin Scranton y con
 * la paleta de Munder Difflin: baldosas verde salvia, muros blancos con
 * contorno oscuro y la pared del fondo con ventanas, reloj y calendario.
 * Todas las medidas estan en pixeles de arte; la escena los amplia sin suavizar.
 */

export const ANCHO = 432
export const ALTO = 272
/** Altura de la pared del fondo, dibujada por encima de y = 0. */
export const ALTO_PARED = 22
export const LIMITES = { x: -8, y: -ALTO_PARED - 4, ancho: ANCHO + 16, alto: ALTO + ALTO_PARED + 12 }

export type Mueble = 'normal' | 'ejecutivo' | 'recepcion'
export type Objeto = 'taza' | 'dulces' | 'gelatina' | 'gato' | 'bombones' | 'crucigrama' | 'tejido' | 'revista'
export type Mirada = 'frente' | 'espalda' | 'izquierda' | 'derecha'

export interface Asiento {
  /** Esquina superior izquierda del escritorio. */
  dx: number
  dy: number
  mueble: Mueble
  objeto?: Objeto
}

export interface Punto {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// ----------------------------------------------------------------- paleta

const BALDOSA = 0x879c8b
const JUNTA = 0x7d9282
const ROMBO = 0x688681
const BALDOSA_COCINA = 0xc9c1ad
const JUNTA_COCINA = 0xb3aa94
const MURO = 0xfffeff
const MURO_CARA = 0xe8e3ea
const MURO_BORDE = 0x282729
const PARED_FONDO = 0xf5f1ea
const PARED_FONDO_SOMBRA = 0xe3ddd3
const VIDRIO = 0x9fc6e8
const VIDRIO_BRILLO = 0xd6ecff
const MARCO = 0x3a3a4a
const MADERA = 0xd8a766
const MADERA_LUZ = 0xe8c08a
const MADERA_BORDE = 0xa8743f
const MADERA_FRENTE = 0xb98450
const MADERA_PATA = 0x8a5a33
const MONITOR = 0x3b2a33
const MONITOR_LUZ = 0x5a4450
const TECLADO = 0xd9d4cf
const TECLAS = 0xb5ada6
const SILLA = 0xc49a5c
const SILLA_RESPALDO = 0xa97a42
const CIRUELA = 0x803c56
const CIRUELA_LUZ = 0x9c4f6e
const HOJA = 0x4f9a5c
const HOJA_OSCURA = 0x2f6e44
const MACETA = 0xb07048

// --------------------------------------------------------------- asientos

export const ASIENTOS: Record<string, Asiento> = {
  michael: { dx: 30, dy: 30, mueble: 'ejecutivo', objeto: 'taza' },
  pam: { dx: 146, dy: 26, mueble: 'recepcion', objeto: 'dulces' },
  andy: { dx: 8, dy: 100, mueble: 'normal' },
  dwight: { dx: 112, dy: 100, mueble: 'normal', objeto: 'gelatina' },
  jim: { dx: 150, dy: 100, mueble: 'normal' },
  phyllis: { dx: 112, dy: 150, mueble: 'normal', objeto: 'tejido' },
  stanley: { dx: 150, dy: 150, mueble: 'normal', objeto: 'crucigrama' },
  creed: { dx: 8, dy: 206, mueble: 'normal' },
  meredith: { dx: 46, dy: 206, mueble: 'normal' },
  angela: { dx: 277, dy: 100, mueble: 'normal', objeto: 'gato' },
  oscar: { dx: 258, dy: 150, mueble: 'normal' },
  kevin: { dx: 296, dy: 150, mueble: 'normal', objeto: 'bombones' },
  kelly: { dx: 352, dy: 100, mueble: 'normal', objeto: 'revista' },
  ryan: { dx: 392, dy: 100, mueble: 'normal' },
  toby: { dx: 372, dy: 156, mueble: 'normal' }
}

/** Escritorios vacios; los ocupan los agentes que no son del reparto, en este orden. */
export const ASIENTOS_LIBRES: Asiento[] = [
  { dx: 196, dy: 100, mueble: 'normal' },
  { dx: 196, dy: 150, mueble: 'normal' },
  { dx: 112, dy: 206, mueble: 'normal' },
  { dx: 150, dy: 206, mueble: 'normal' },
  { dx: 352, dy: 212, mueble: 'normal' },
  { dx: 392, dy: 212, mueble: 'normal' },
  { dx: 8, dy: 150, mueble: 'normal' }
]

const ANCHO_MUEBLE: Record<Mueble, number> = { normal: 36, ejecutivo: 46, recepcion: 50 }
const CENTRO_PERSONA: Record<Mueble, number> = { normal: 12, ejecutivo: 15, recepcion: 18 }

/** Donde quedan los pies del personaje sentado (el escritorio le tapa las piernas). */
export function puntoSentado(a: Asiento): Punto {
  return { x: a.dx + CENTRO_PERSONA[a.mueble], y: a.dy + 18 }
}

/** Pantalla del monitor, para teñirla segun el estado del agente. */
export function pantallaDe(a: Asiento): Rect {
  switch (a.mueble) {
    case 'ejecutivo':
      return { x: a.dx + 34, y: a.dy + 2, w: 9, h: 7 }
    case 'recepcion':
      return { x: a.dx + 38, y: a.dy + 4, w: 9, h: 7 }
    default:
      return { x: a.dx + 24, y: a.dy + 2, w: 9, h: 7 }
  }
}

export function anchoMueble(a: Asiento): number {
  return ANCHO_MUEBLE[a.mueble]
}

// ---------------------------------------------------- puntos de interes

export interface Actividad {
  punto: Punto
  mirada: Mirada
  frases: string[]
}

/** Lugares a los que los personajes van cuando no tienen trabajo. */
export const ACTIVIDADES: Actividad[] = [
  { punto: { x: 312, y: 256 }, mirada: 'espalda', frases: ['preparando un café', 'otro café más'] },
  { punto: { x: 272, y: 256 }, mirada: 'espalda', frases: ['lavando la taza'] },
  { punto: { x: 330, y: 244 }, mirada: 'espalda', frases: ['buscando su almuerzo', '¿quién se comió mi yogur?'] },
  { punto: { x: 294, y: 236 }, mirada: 'frente', frases: ['tomando un descanso'] },
  { punto: { x: 401, y: 40 }, mirada: 'espalda', frases: ['sacudiéndola. suave. con respeto.', 'se atoró otra vez'] },
  { punto: { x: 420, y: 40 }, mirada: 'espalda', frases: ['comprando un refresco'] },
  { punto: { x: 226, y: 76 }, mirada: 'derecha', frases: ['tomando agua', 'charla junto al garrafón'] },
  { punto: { x: 118, y: 80 }, mirada: 'espalda', frases: ['sacando copias', 'la copiadora otra vez'] },
  { punto: { x: 26, y: 262 }, mirada: 'izquierda', frases: ['regando las plantas'] },
  { punto: { x: 232, y: 262 }, mirada: 'derecha', frases: ['regando las plantas'] },
  { punto: { x: 170, y: 72 }, mirada: 'espalda', frases: ['platicando con Pam', 'dejando un paquete en recepción'] },
  { punto: { x: 294, y: 70 }, mirada: 'espalda', frases: ['preparando la junta', 'revisando la sala'] },
  { punto: { x: 58, y: 76 }, mirada: 'espalda', frases: ['reportándose con Michael', 'que no me vea Michael'] }
]

export const FRASES_VISITA = [
  '¿viste la junta de hoy?',
  '¿tienes un minuto?',
  'te traje un café',
  'pregunta rápida…',
  '¿revisaste mi PR?'
]

/** Donde se para alguien que visita un escritorio. */
export function puntoVisita(a: Asiento): Punto {
  return { x: a.dx + CENTRO_PERSONA[a.mueble], y: a.dy + 38 }
}

// ------------------------------------------------------------- obstaculos

/** Rectangulos del piso por los que no se puede caminar. */
export function obstaculos(asientos: Asiento[]): Rect[] {
  const muros: Rect[] = [
    // Oficina de Michael
    { x: 100, y: 0, w: 5, h: 86 },
    { x: 0, y: 80, w: 72, h: 6 },
    { x: 92, y: 80, w: 13, h: 6 },
    // Sala de conferencias
    { x: 240, y: 0, w: 5, h: 86 },
    { x: 240, y: 80, w: 10, h: 6 },
    { x: 272, y: 80, w: 77, h: 6 },
    // Sala de descanso y anexo
    { x: 344, y: 0, w: 5, h: 96 },
    { x: 344, y: 80, w: 8, h: 6 },
    { x: 374, y: 80, w: 58, h: 6 },
    { x: 344, y: 120, w: 5, h: 116 },
    { x: 344, y: 260, w: 5, h: 12 },
    // Cocina
    { x: 244, y: 200, w: 12, h: 6 },
    { x: 282, y: 200, w: 62, h: 6 },
    { x: 244, y: 200, w: 5, h: 72 }
  ]
  const muebles: Rect[] = [
    { x: 4, y: 18, w: 14, h: 50 }, // sofá de Michael
    { x: 108, y: 58, w: 20, h: 16 }, // fotocopiadora
    { x: 230, y: 52, w: 10, h: 18 }, // dispensador
    { x: 262, y: 30, w: 66, h: 30 }, // mesa de conferencias
    { x: 360, y: 38, w: 30, h: 22 }, // mesa redonda
    { x: 382, y: 0, w: 48, h: 30 }, // máquinas
    { x: 250, y: 252, w: 80, h: 20 }, // encimera
    { x: 322, y: 210, w: 22, h: 30 }, // refrigerador
    { x: 276, y: 222, w: 36, h: 14 }, // mesa de cocina
    { x: 4, y: 250, w: 14, h: 18 }, // plantas
    { x: 226, y: 250, w: 14, h: 18 },
    { x: 414, y: 250, w: 14, h: 18 },
    { x: 86, y: 60, w: 12, h: 16 }
  ]
  const escritorios = asientos.map((a) => ({ x: a.dx, y: a.dy + 10, w: anchoMueble(a), h: 16 }))
  return [...muros, ...muebles, ...escritorios]
}

// ------------------------------------------------------------------ fondo

function baldosas(l: Lienzo, ox: number, oy: number, x: number, y: number, w: number, h: number, cocina = false): void {
  const base = cocina ? BALDOSA_COCINA : BALDOSA
  const junta = cocina ? JUNTA_COCINA : JUNTA
  l.r(ox + x, oy + y, w, h, base)
  const lado = cocina ? 8 : 16
  for (let tx = x - (x % lado); tx < x + w; tx += lado) {
    for (let ty = y - (y % lado); ty < y + h; ty += lado) {
      const px = ox + tx
      const py = oy + ty
      if (tx >= x && tx < x + w) l.r(px, Math.max(oy + y, py), 1, Math.min(lado, y + h - ty), junta)
      if (ty >= y && ty < y + h) l.r(Math.max(ox + x, px), py, Math.min(lado, x + w - tx), 1, junta)
      if (!cocina && tx >= x + 1 && ty >= y + 1 && tx < x + w - 1 && ty < y + h - 1) {
        l.p(px, py - 1, ROMBO).p(px - 1, py, ROMBO).p(px, py, ROMBO).p(px + 1, py, ROMBO).p(px, py + 1, ROMBO)
      }
      if (cocina && ((tx + ty) / lado) % 2 === 0 && tx >= x && ty >= y) {
        l.r(px + 1, py + 1, Math.min(lado - 1, x + w - tx - 1), Math.min(lado - 1, y + h - ty - 1), aclarar(base, 0.12))
      }
    }
  }
}

function muroH(l: Lienzo, ox: number, oy: number, x: number, y: number, w: number): void {
  l.r(ox + x, oy + y, w, 6, MURO_BORDE)
  l.r(ox + x, oy + y + 1, w, 3, MURO)
  l.r(ox + x, oy + y + 4, w, 1, MURO_CARA)
}

function muroV(l: Lienzo, ox: number, oy: number, x: number, y: number, h: number): void {
  l.r(ox + x, oy + y, 5, h, MURO_BORDE)
  l.r(ox + x + 1, oy + y, 3, h, MURO)
}

/** Ventana interior con persianas, sobre un muro horizontal. */
function persiana(l: Lienzo, ox: number, oy: number, x: number, y: number, w: number): void {
  l.r(ox + x, oy + y + 1, w, 3, VIDRIO)
  for (let i = x + 2; i < x + w; i += 3) l.r(ox + i, oy + y + 1, 1, 3, VIDRIO_BRILLO)
}

function ventanaFondo(l: Lienzo, x: number, y: number, w: number): void {
  l.r(x, y, w, 12, MARCO)
  const mitad = Math.floor((w - 3) / 2)
  l.r(x + 1, y + 1, mitad, 10, VIDRIO).r(x + 2 + mitad, y + 1, w - 3 - mitad, 10, VIDRIO)
  l.r(x + 2, y + 2, 3, 1, VIDRIO_BRILLO).r(x + 3 + mitad, y + 2, 3, 1, VIDRIO_BRILLO)
  l.r(x + 1, y + 6, w - 2, 1, oscurecer(VIDRIO, 0.12))
}

/** Dibuja piso, muros y la pared del fondo. Devuelve la textura y su origen en el mundo. */
export function dibujarFondo(): { textura: Texture; x: number; y: number } {
  const ox = -LIMITES.x
  const oy = -LIMITES.y
  const l = new Lienzo(LIMITES.ancho, LIMITES.alto)

  // Piso
  baldosas(l, ox, oy, 0, 0, ANCHO, ALTO)
  baldosas(l, ox, oy, 249, 206, 95, 66, true)

  // Pared del fondo con ventanas, reloj y calendario
  const pared = oy - ALTO_PARED
  l.r(ox - 6, pared - 1, ANCHO + 12, ALTO_PARED + 1, MURO_BORDE)
  l.r(ox - 5, pared, ANCHO + 10, ALTO_PARED - 1, PARED_FONDO)
  l.r(ox - 5, oy - 4, ANCHO + 10, 3, PARED_FONDO_SOMBRA)
  // Reloj y calendario (oficina de Michael)
  l.r(ox + 6, pared + 5, 9, 9, MURO_BORDE).r(ox + 7, pared + 6, 7, 7, 0xd9483b).r(ox + 8, pared + 7, 5, 5, 0xfdf6ee)
  l.r(ox + 10, pared + 8, 1, 3, MURO_BORDE).r(ox + 10, pared + 10, 2, 1, MURO_BORDE)
  l.r(ox + 70, pared + 3, 13, 14, MURO_BORDE).r(ox + 71, pared + 4, 11, 12, 0xfdf6ee).r(ox + 71, pared + 4, 11, 3, 0xd9483b)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) l.p(ox + 73 + i * 3, pared + 9 + j * 2, 0x9a8f86)
  ventanaFondo(l, ox + 24, pared + 5, 26)
  // Letrero de recepción (el texto se pone encima como rotulo)
  l.r(ox + 146, pared + 5, 50, 11, MURO_BORDE).r(ox + 147, pared + 6, 48, 9, 0x2d3748)
  // Puerta de entrada (doble, de vidrio)
  l.r(ox + 206, pared + 2, 28, ALTO_PARED - 2, MURO_BORDE)
  l.r(ox + 207, pared + 3, 12, ALTO_PARED - 4, 0x6f8fb0).r(ox + 221, pared + 3, 12, ALTO_PARED - 4, 0x6f8fb0)
  l.r(ox + 208, pared + 4, 2, 10, VIDRIO_BRILLO).r(ox + 222, pared + 4, 2, 10, VIDRIO_BRILLO)
  l.r(ox + 217, pared + 11, 1, 3, 0xd6c28a).r(ox + 223, pared + 11, 1, 3, 0xd6c28a)
  // Ventanas y pizarra
  ventanaFondo(l, ox + 110, pared + 5, 26)
  l.r(ox + 268, pared + 4, 50, 14, MURO_BORDE).r(ox + 269, pared + 5, 48, 12, 0xf8f8f4)
  l.r(ox + 272, pared + 8, 20, 1, 0x4f8cff).r(ox + 272, pared + 11, 30, 1, 0xd9483b).r(ox + 272, pared + 14, 14, 1, 0x3a3a4a)
  ventanaFondo(l, ox + 356, pared + 5, 22)

  // Muros exteriores laterales e inferior
  muroV(l, ox, oy, -5, -2, ALTO + 7)
  muroV(l, ox, oy, ANCHO, -2, ALTO + 7)
  muroH(l, ox, oy, -5, ALTO, ANCHO + 10)
  l.r(ox + 190, oy + ALTO + 1, 30, 3, BALDOSA) // salida al almacén

  // Oficina de Michael
  muroV(l, ox, oy, 100, -2, 88)
  muroH(l, ox, oy, 0, 80, 72)
  muroH(l, ox, oy, 92, 80, 13)
  persiana(l, ox, oy, 8, 80, 54)
  // Sala de conferencias
  muroV(l, ox, oy, 240, -2, 88)
  muroH(l, ox, oy, 240, 80, 10)
  muroH(l, ox, oy, 272, 80, 77)
  persiana(l, ox, oy, 282, 80, 52)
  // Sala de descanso y anexo
  muroV(l, ox, oy, 344, -2, 98)
  muroH(l, ox, oy, 344, 80, 8)
  muroH(l, ox, oy, 374, 80, 58)
  muroV(l, ox, oy, 344, 120, 116)
  muroV(l, ox, oy, 344, 260, 12)
  // Cocina
  muroH(l, ox, oy, 244, 200, 12)
  muroH(l, ox, oy, 282, 200, 62)
  muroV(l, ox, oy, 244, 200, 72)

  return { textura: l.textura(), x: LIMITES.x, y: LIMITES.y }
}

// ---------------------------------------------------------------- muebles

export interface MuebleSuelto {
  textura: Texture
  x: number
  y: number
  /** Coordenada y de la base, para ordenar por profundidad. */
  base: number
}

function sprite(l: Lienzo, x: number, y: number, base?: number): MuebleSuelto {
  const c = l.contornear()
  return { textura: c.textura(), x: x - 1, y: y - 1, base: base ?? y + l.alto }
}

function monitor(l: Lienzo, x: number, y: number): void {
  l.r(x, y, 13, 11, MONITOR).r(x + 1, y + 1, 11, 1, MONITOR_LUZ)
  l.r(x + 2, y + 2, 9, 7, 0x341422)
  l.r(x + 4, y + 11, 5, 2, MONITOR)
}

function teclado(l: Lienzo, x: number, y: number): void {
  l.r(x, y, 13, 3, TECLADO)
  for (let i = 1; i < 12; i += 2) l.p(x + i, y + 1, TECLAS)
  l.r(x + 15, y + 1, 2, 2, TECLADO)
}

function objetoEnMesa(l: Lienzo, objeto: Objeto, x: number, y: number): void {
  switch (objeto) {
    case 'taza':
      l.r(x, y, 4, 4, 0xf4f6f8).r(x + 4, y + 1, 1, 2, 0xf4f6f8).r(x + 1, y + 1, 2, 1, 0x2b2f3a)
      break
    case 'dulces':
      l.r(x, y - 1, 6, 5, 0xcfe6f5).r(x + 1, y + 1, 1, 1, 0xe74c3c).r(x + 3, y, 1, 1, 0xf1c40f)
      l.r(x + 4, y + 2, 1, 1, 0x2ecc71).r(x + 2, y + 3, 1, 1, 0x9b59b6).r(x + 1, y - 2, 4, 1, 0xe5ecf4)
      break
    case 'gelatina':
      l.r(x, y - 1, 7, 5, 0xd4e157).r(x + 2, y + 1, 3, 1, 0x3a3a44).r(x + 1, y - 1, 2, 1, aclarar(0xd4e157, 0.4))
      break
    case 'gato':
      l.r(x, y - 2, 5, 6, 0xe7a1c0).r(x + 1, y - 1, 3, 4, 0xf5e8ee).r(x + 1, y + 1, 3, 2, 0x4b4f58).p(x + 1, y, 0x4b4f58).p(x + 3, y, 0x4b4f58)
      break
    case 'bombones':
      l.r(x, y + 1, 7, 3, 0xeeeeee).p(x + 1, y + 1, 0xe74c3c).p(x + 3, y + 1, 0xf1c40f).p(x + 5, y + 1, 0x3498db).p(x + 2, y, 0x2ecc71)
      break
    case 'crucigrama':
      l.r(x, y, 7, 5, 0xf4f6f8).r(x + 2, y, 1, 5, 0x9aa3b1).r(x + 4, y, 1, 5, 0x9aa3b1).r(x, y + 2, 7, 1, 0x9aa3b1)
      break
    case 'tejido':
      l.r(x, y, 5, 4, 0xb56576).p(x + 1, y + 1, 0x8e4a5a).p(x + 3, y + 2, 0x8e4a5a).r(x + 5, y - 2, 1, 5, 0xd8d2c4)
      break
    case 'revista':
      l.r(x, y, 7, 5, 0xff6fb5).r(x + 1, y + 1, 5, 1, 0xffffff).r(x + 1, y + 3, 3, 1, 0xffffff)
      break
  }
}

/** Escritorio visto de frente, con monitor CRT, teclado y el objeto del personaje. */
export function escritorio(a: Asiento): MuebleSuelto {
  const w = anchoMueble(a)
  if (a.mueble === 'recepcion') {
    const l = new Lienzo(w, 34)
    monitor(l, 36, 2)
    l.r(0, 12, w, 5, 0xe6c89a).r(0, 12, w, 1, aclarar(0xe6c89a, 0.3))
    l.r(0, 17, w, 13, 0xa57a4a).r(0, 17, w, 2, 0xc9a06a)
    for (let x = 6; x < w; x += 12) l.r(x, 21, 1, 8, oscurecer(0xa57a4a, 0.15))
    l.r(0, 30, w, 2, 0x5f4228)
    teclado(l, 10, 13)
    if (a.objeto) objetoEnMesa(l, a.objeto, 2, 10)
    l.r(28, 10, 5, 3, 0x2b2f3a).r(29, 9, 3, 1, 0x2b2f3a)
    return sprite(l, a.dx, a.dy, a.dy + 32)
  }
  const ejecutivo = a.mueble === 'ejecutivo'
  const tapa = ejecutivo ? 0x9c6a3f : MADERA
  const frente = ejecutivo ? 0x7a4f2c : MADERA_FRENTE
  const l = new Lienzo(w, 26)
  monitor(l, w - 14, 0)
  l.r(0, 10, w, 7, tapa).r(0, 10, w, 1, ejecutivo ? aclarar(tapa, 0.2) : MADERA_LUZ).r(0, 16, w, 1, MADERA_BORDE)
  l.r(0, 17, w, 7, frente).r(0, 17, 3, 7, MADERA_PATA).r(w - 3, 17, 3, 7, MADERA_PATA)
  l.r(8, 19, w - 16, 1, oscurecer(frente, 0.2))
  l.r(0, 24, w, 2, oscurecer(MADERA_PATA, 0.3))
  teclado(l, 6, 12)
  if (a.objeto) objetoEnMesa(l, a.objeto, 1, 11)
  if (ejecutivo) l.r(w - 22, 13, 6, 3, 0x2e8b57).r(w - 22, 13, 6, 1, 0x3fae6e)
  return sprite(l, a.dx, a.dy, a.dy + 26)
}

/** Silla detras del escritorio: se ve el respaldo alrededor de los hombros. */
export function silla(a: Asiento): MuebleSuelto {
  const l = new Lienzo(16, 18)
  l.redondo(1, 0, 14, 10, SILLA_RESPALDO).r(3, 2, 10, 6, SILLA)
  l.r(0, 10, 16, 4, SILLA).r(0, 10, 16, 1, aclarar(SILLA, 0.25))
  l.r(2, 14, 2, 4, MADERA_PATA).r(12, 14, 2, 4, MADERA_PATA)
  const centro = puntoSentado(a).x
  return sprite(l, centro - 8, a.dy + 2, a.dy + 17)
}

function planta(x: number, y: number, grande = false): MuebleSuelto {
  const l = new Lienzo(14, grande ? 22 : 18)
  const alto = l.alto
  l.r(3, alto - 7, 8, 7, MACETA).r(2, alto - 8, 10, 2, aclarar(MACETA, 0.2))
  l.r(6, 0, 2, alto - 8, HOJA_OSCURA)
  l.r(2, 3, 4, 3, HOJA).r(8, 2, 4, 3, HOJA).r(1, 7, 5, 3, HOJA_OSCURA).r(8, 6, 5, 3, HOJA).r(4, alto - 12, 6, 4, HOJA)
  l.p(3, 3, aclarar(HOJA, 0.3)).p(9, 2, aclarar(HOJA, 0.3))
  return sprite(l, x, y)
}

function sillaCiruela(x: number, y: number): MuebleSuelto {
  const l = new Lienzo(10, 11)
  l.redondo(0, 0, 10, 7, CIRUELA).r(1, 1, 8, 2, CIRUELA_LUZ).r(1, 7, 8, 2, oscurecer(CIRUELA, 0.2)).r(1, 9, 2, 2, MONITOR).r(7, 9, 2, 2, MONITOR)
  return sprite(l, x, y)
}

function sillaVisita(x: number, y: number): MuebleSuelto {
  const l = new Lienzo(12, 13)
  l.r(0, 5, 12, 4, SILLA).redondo(1, 0, 10, 6, SILLA_RESPALDO).r(1, 9, 2, 4, MADERA_PATA).r(9, 9, 2, 4, MADERA_PATA)
  return sprite(l, x, y)
}

/** Todo el mobiliario que no es un escritorio de agente. */
export function mobiliario(): MuebleSuelto[] {
  const piezas: MuebleSuelto[] = []

  // Oficina de Michael: sofá, librero y sillas de visita
  {
    const l = new Lienzo(14, 50)
    l.r(0, 0, 14, 50, 0x6d4c41).r(0, 0, 5, 50, 0x5d4037).r(5, 3, 8, 21, 0x7d5a4d).r(5, 26, 8, 21, 0x7d5a4d)
    piezas.push(sprite(l, 4, 18))
  }
  {
    const l = new Lienzo(18, 24)
    l.r(0, 0, 18, 24, 0x6e4b33)
    for (let y = 6; y < 24; y += 6) l.r(1, y, 16, 1, 0x4e3423)
    const libros = [0xc0392b, 0x2e86de, 0xf1c40f, 0x27ae60, 0x8e44ad]
    for (let fila = 0; fila < 3; fila++) {
      for (let i = 0; i < 5; i++) l.r(2 + i * 3, 1 + fila * 6, 2, 5, libros[(i + fila) % libros.length])
    }
    piezas.push(sprite(l, 80, 2))
  }
  piezas.push(sillaVisita(38, 64), sillaVisita(58, 64))
  piezas.push(planta(86, 58))

  // Recepción: fotocopiadora, dispensador de agua y sillas de espera
  {
    const l = new Lienzo(20, 16)
    l.r(0, 3, 20, 13, 0xd6dbe4).r(0, 3, 20, 3, 0xb8c0cc).r(2, 0, 16, 3, 0x9aa3b1).r(3, 8, 10, 1, 0x2e86de).r(15, 8, 3, 2, 0x3fae6e)
    piezas.push(sprite(l, 108, 58))
  }
  {
    const l = new Lienzo(8, 18)
    l.r(1, 0, 6, 7, 0x74b9ff).r(2, 1, 2, 4, 0xb7dcff).r(0, 7, 8, 11, 0xe5ecf4).r(2, 10, 4, 2, 0x9aa3b1)
    piezas.push(sprite(l, 231, 52))
  }
  piezas.push(sillaVisita(212, 30), sillaVisita(226, 30))
  piezas.push(planta(122, 2, true))

  // Sala de conferencias
  for (let i = 0; i < 5; i++) {
    piezas.push(sillaCiruela(266 + i * 12, 22))
    piezas.push(sillaCiruela(266 + i * 12, 56))
  }
  {
    const l = new Lienzo(68, 26)
    l.r(0, 0, 68, 22, 0xcfa46a).r(0, 0, 68, 1, aclarar(0xcfa46a, 0.3)).r(0, 22, 68, 4, 0xa07640)
    l.r(26, 6, 14, 10, 0x9fc6e8).r(27, 7, 12, 8, 0xdfe9f4)
    piezas.push(sprite(l, 262, 32))
  }
  piezas.push(planta(248, 58))

  // Sala de descanso: máquinas y mesa redonda
  {
    const l = new Lienzo(18, 30)
    l.r(0, 0, 18, 30, 0xc0392b).r(2, 3, 11, 20, 0x2d1b1b)
    const snacks = [0xf5b041, 0x58d68d, 0xec7063, 0x5dade2]
    for (let y = 5; y < 22; y += 5) for (let x = 3; x < 12; x += 3) l.r(x, y, 2, 3, snacks[(x + y) % 4])
    l.r(14, 5, 3, 6, 0xd5d8dc).r(3, 25, 10, 3, 0x1b1010)
    piezas.push(sprite(l, 392, 0, 30))
  }
  {
    const l = new Lienzo(18, 30)
    l.r(0, 0, 18, 30, 0x2e5aa8).r(2, 3, 11, 20, 0xdfe9f4)
    for (let x = 3; x < 12; x += 3) l.r(x, 5, 2, 16, 0x3c8dde)
    l.r(14, 5, 3, 6, 0xd5d8dc).r(3, 25, 10, 3, 0x14233f)
    piezas.push(sprite(l, 411, 0, 30))
  }
  {
    const l = new Lienzo(24, 16)
    l.redondo(0, 0, 24, 12, 0xe4ddd0).r(2, 1, 20, 1, 0xf4efe6).r(10, 12, 4, 4, 0x8a8f99)
    piezas.push(sillaVisita(356, 40), sillaVisita(386, 40))
    piezas.push(sprite(l, 364, 40))
  }
  piezas.push(planta(420, 60))

  // Cocina: encimera, refrigerador y mesa
  {
    const l = new Lienzo(80, 20)
    l.r(0, 0, 80, 6, 0xcfd4dc).r(0, 6, 80, 14, 0xb8c0cc)
    for (let x = 0; x < 80; x += 20) l.r(x, 8, 1, 12, 0x9aa3b1)
    l.r(14, 1, 14, 4, 0x9aa3b1).r(19, 0, 2, 2, 0x7d8699) // fregadero
    l.r(52, 0, 10, 5, 0x1f2430).r(54, 1, 4, 2, 0xd9483b) // cafetera
    l.r(64, 0, 14, 6, 0x2b2f3a).r(65, 1, 9, 4, 0x4b5566) // microondas
    piezas.push(sprite(l, 250, 252))
  }
  {
    const l = new Lienzo(20, 30)
    l.r(0, 0, 20, 30, 0xe8ecf1).r(0, 11, 20, 1, 0xb8c0cc).r(16, 4, 2, 5, 0x9aa3b1).r(16, 14, 2, 10, 0x9aa3b1)
    piezas.push(sprite(l, 323, 210))
  }
  {
    const l = new Lienzo(36, 14)
    l.r(0, 0, 36, 10, 0xe4ddd0).r(0, 0, 36, 1, 0xf4efe6).r(0, 10, 36, 4, 0xc2b8a6)
    piezas.push(sillaVisita(270, 214), sillaVisita(306, 214))
    piezas.push(sprite(l, 276, 222))
  }

  // Plantas del bullpen y del anexo
  piezas.push(planta(4, 250, true), planta(226, 250, true), planta(414, 250, true), planta(226, 90))

  return piezas
}

/** Rotulos de las salas (texto). */
export const ROTULOS: Array<{ texto: string; x: number; y: number; letrero?: boolean }> = [
  { texto: 'DUNDER MIFFLIN', x: 171, y: -11, letrero: true },
  { texto: 'Recepción', x: 196, y: 74 },
  { texto: 'Sala de conferencias', x: 294, y: 74 },
  { texto: 'Descanso', x: 372, y: 74 },
  { texto: 'Contabilidad', x: 270, y: 194 },
  { texto: 'Cocina', x: 270, y: 212 },
  { texto: 'Anexo', x: 372, y: 262 }
]
