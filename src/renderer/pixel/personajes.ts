import type { Texture } from 'pixi.js'
import { personajeDe, type Apariencia, type Peinado } from '../../shared/reparto'
import { Lienzo, aclarar, mezclar, oscurecer } from './lienzo'

/**
 * Personajes en pixel art, generados a partir de su apariencia. Cabeza grande
 * (12x12) para que la cara se lea bien: cejas, ojos de 2x2 con brillo, nariz
 * y boca. Lienzo base de 18x28; con el contorno queda en 20x30.
 */

export const ANCHO_SPRITE = 20
export const ALTO_SPRITE = 30

const OJO = 0x1d1a24
const BRILLO = 0xffffff
const BOCA = 0x8a3a30
const LENTES = 0x3a3440
const LENTE = 0xe4eef5
const CINTURON = 0x2f2622
const ZAPATOS = 0x2a2220
const PANTALON = 0x3a4150

type Vista = 'frente' | 'espalda' | 'lado'
type Paso = 0 | 1 | 2
type Brazos = 'colgando' | 'teclado' | 'teclado2'

export interface SpritesPersonaje {
  frente: { quieto: Texture; quietoCerrados: Texture; pasos: [Texture, Texture] }
  espalda: { quieto: Texture; pasos: [Texture, Texture] }
  lado: { quieto: Texture; pasos: [Texture, Texture] }
  sentado: { normal: Texture; cerrados: Texture; teclea: Texture }
}

// ------------------------------------------------------------- apariencia

const PIELES = [0xf2cfae, 0xe8bd96, 0xd4a176, 0xb07a52, 0x7a4b2e]
const PELOS = [0x2b2018, 0x5b3f2a, 0x8a6a45, 0xd8b56a, 0x1a1a1a, 0x9a9a9a]
const CAMISAS = [0x4f8cff, 0xff8a4f, 0x3fcf8e, 0xc77dff, 0xffc94f, 0x4fd6ff, 0xff5f8f]
const PEINADOS: Peinado[] = ['corto', 'despeinado', 'largo', 'bob', 'rizado', 'raya']

function hash(texto: string): number {
  let h = 0
  for (const letra of texto) h = (h * 31 + letra.charCodeAt(0)) >>> 0
  return h
}

/** Apariencia del personaje del reparto, o una generada a partir del id. */
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

/** Color que identifica al personaje: su prenda principal. */
export function colorPrincipal(ap: Apariencia): number {
  return ap.prenda === 'camisa' ? ap.camisa : (ap.colorPrenda ?? ap.camisa)
}

// ----------------------------------------------------------------- piezas

interface Colores {
  piel: number
  pielSombra: number
  pelo: number
  peloSombra: number
  cejas: number
  torso: number
  mangas: number
  pantalon: number
}

function colores(ap: Apariencia): Colores {
  const torso = colorPrincipal(ap)
  const oscuro = ap.pelo < 0x404040 || (((ap.pelo >> 16) & 0xff) < 70 && ((ap.pelo >> 8) & 0xff) < 70)
  return {
    piel: ap.piel,
    pielSombra: oscurecer(ap.piel, 0.14),
    pelo: ap.pelo,
    peloSombra: oscurecer(ap.pelo, 0.25),
    cejas: oscuro ? ap.pelo : oscurecer(ap.pelo, 0.45),
    torso,
    mangas: ap.prenda === 'traje' || ap.prenda === 'cardigan' ? torso : ap.camisa,
    pantalon: ap.pantalon ?? PANTALON
  }
}

function anchoTorso(ap: Apariencia): { x: number; w: number } {
  switch (ap.complexion) {
    case 'delgada':
      return { x: 5, w: 8 }
    case 'gruesa':
      return { x: 3, w: 12 }
    default:
      return { x: 4, w: 10 }
  }
}

/** Pelo que cae por detras de la cabeza y los hombros (se pinta antes que la cabeza). */
function peloTrasero(l: Lienzo, ap: Apariencia, c: Colores, vista: Vista): void {
  if (vista === 'lado') {
    if (ap.peinado === 'largo') l.r(2, 4, 6, 12, c.pelo)
    if (ap.peinado === 'bob') l.r(2, 4, 6, 8, c.pelo)
    return
  }
  if (ap.peinado === 'largo') l.r(2, 3, 14, 13, c.pelo)
  if (ap.peinado === 'bob') l.r(2, 3, 14, 9, c.pelo)
}

function peloFrente(l: Lienzo, ap: Apariencia, c: Colores): void {
  const p = c.pelo
  switch (ap.peinado) {
    case 'corto':
      l.r(4, 1, 10, 1, p).r(3, 2, 12, 3, p).r(3, 5, 1, 2, p).r(14, 5, 1, 2, p)
      l.r(6, 2, 3, 1, aclarar(p, 0.18))
      break
    case 'raya':
      l.r(4, 1, 10, 1, p).r(3, 2, 12, 4, p).r(2, 4, 2, 4, p).r(14, 4, 2, 4, p)
      l.r(7, 1, 1, 3, c.peloSombra)
      break
    case 'despeinado':
      l.r(3, 1, 12, 4, p).r(4, 0, 3, 1, p).r(8, 0, 2, 1, p).r(11, 0, 3, 1, p)
      l.p(5, 5, p).p(9, 5, p).p(12, 5, p).r(3, 5, 1, 2, p).r(14, 5, 1, 2, p)
      l.r(6, 1, 2, 1, aclarar(p, 0.2)).p(11, 1, aclarar(p, 0.2))
      break
    case 'largo':
      l.r(4, 1, 10, 1, p).r(3, 2, 12, 3, p).r(3, 5, 1, 7, p).r(14, 5, 1, 7, p).r(4, 5, 4, 1, p)
      l.r(6, 1, 3, 1, aclarar(p, 0.2))
      break
    case 'bob':
      l.r(4, 1, 10, 1, p).r(3, 2, 12, 3, p).r(2, 5, 2, 6, p).r(14, 5, 2, 6, p).r(4, 5, 3, 1, p)
      l.r(6, 2, 3, 1, aclarar(p, 0.18))
      break
    case 'moño':
      l.r(6, 0, 6, 2, p).p(8, 0, aclarar(p, 0.25))
      l.r(4, 1, 10, 1, p).r(3, 2, 12, 3, p).p(3, 5, p).p(14, 5, p)
      l.r(7, 2, 4, 1, aclarar(p, 0.2))
      break
    case 'calvo':
      l.r(5, 2, 8, 1, mezclar(ap.piel, p, 0.25)).r(3, 6, 1, 2, p).r(14, 6, 1, 2, p)
      l.r(6, 3, 2, 1, aclarar(ap.piel, 0.25))
      break
    case 'calvoLados':
      l.r(2, 5, 2, 4, p).r(14, 5, 2, 4, p)
      l.r(6, 3, 2, 1, aclarar(ap.piel, 0.2))
      break
    case 'entradas':
      l.r(5, 1, 8, 1, p).r(4, 2, 10, 2, p).p(8, 4, p).r(3, 3, 1, 4, p).r(14, 3, 1, 4, p)
      break
    case 'rizado':
      l.r(3, 1, 12, 4, p).p(2, 2, p).p(15, 2, p).r(2, 3, 1, 5, p).r(15, 3, 1, 5, p)
      l.r(4, 0, 2, 1, p).r(8, 0, 2, 1, p).r(12, 0, 2, 1, p)
      l.p(4, 5, p).p(7, 5, p).p(10, 5, p).p(13, 5, p)
      l.p(5, 2, aclarar(p, 0.25)).p(9, 1, aclarar(p, 0.25)).p(12, 3, aclarar(p, 0.25))
      break
  }
}

function peloEspalda(l: Lienzo, ap: Apariencia, c: Colores): void {
  const p = c.pelo
  switch (ap.peinado) {
    case 'calvo':
      l.r(6, 3, 2, 1, aclarar(ap.piel, 0.25))
      break
    case 'calvoLados':
      l.r(3, 8, 12, 3, p).r(4, 11, 10, 1, p)
      break
    case 'entradas':
      l.r(3, 4, 12, 9, p).r(4, 3, 10, 1, p)
      break
    case 'moño':
      l.r(6, 0, 6, 2, p)
      l.redondo(3, 2, 12, 11, p)
      break
    case 'largo':
      l.redondo(3, 1, 12, 13, p).r(3, 14, 12, 4, p)
      break
    case 'bob':
      l.redondo(3, 1, 12, 12, p)
      break
    case 'rizado':
      l.redondo(2, 1, 14, 12, p).r(4, 0, 2, 1, p).r(8, 0, 2, 1, p).r(12, 0, 2, 1, p)
      break
    default:
      l.redondo(3, 1, 12, 12, p)
      if (ap.peinado === 'despeinado') l.r(4, 0, 3, 1, p).r(8, 0, 2, 1, p).r(11, 0, 3, 1, p)
  }
}

function peloLado(l: Lienzo, ap: Apariencia, c: Colores): void {
  const p = c.pelo
  switch (ap.peinado) {
    case 'calvo':
      l.r(4, 6, 2, 2, p)
      break
    case 'calvoLados':
      l.r(3, 5, 5, 4, p)
      break
    case 'entradas':
      l.r(5, 1, 7, 1, p).r(4, 2, 8, 2, p).r(3, 3, 5, 6, p)
      break
    case 'moño':
      l.r(1, 2, 3, 3, p)
      l.r(5, 1, 8, 1, p).r(4, 2, 10, 3, p).r(3, 4, 4, 5, p)
      break
    case 'rizado':
      l.r(4, 0, 9, 2, p).r(3, 2, 11, 3, p).r(2, 3, 5, 7, p).p(13, 5, p)
      break
    case 'despeinado':
      l.r(5, 0, 2, 1, p).r(9, 0, 3, 1, p).r(4, 1, 10, 1, p).r(3, 2, 11, 3, p).r(3, 5, 4, 4, p).p(13, 5, p)
      break
    case 'raya':
      l.r(5, 1, 9, 1, p).r(3, 2, 12, 4, p).r(3, 6, 4, 4, p)
      break
    default:
      l.r(5, 1, 9, 1, p).r(3, 2, 11, 3, p).r(3, 5, 4, ap.peinado === 'largo' || ap.peinado === 'bob' ? 5 : 3, p)
  }
}

function luminancia(color: number): number {
  return (0.299 * ((color >> 16) & 0xff) + 0.587 * ((color >> 8) & 0xff) + 0.114 * (color & 0xff)) / 255
}

/** En piel oscura la boca se aclara para que se siga leyendo. */
function colorBoca(ap: Apariencia): number {
  return luminancia(ap.piel) < 0.45 ? 0xe8a090 : BOCA
}

/** Un ojo de 2x2 en (x, 7). Con lentes, cristal claro y pupila hacia el centro de la cara. */
function ojo(l: Lienzo, x: number, cerrado: boolean, lentes: boolean, pupilaDerecha: boolean): void {
  if (lentes) {
    l.r(x, 7, 2, 2, LENTE)
    if (cerrado) l.r(x, 8, 2, 1, OJO)
    else l.r(pupilaDerecha ? x + 1 : x, 7, 1, 2, OJO)
    return
  }
  if (cerrado) l.r(x, 8, 2, 1, OJO)
  else l.r(x, 7, 2, 2, OJO).p(x, 7, BRILLO)
}

function cara(l: Lienzo, ap: Apariencia, c: Colores, cerrados: boolean): void {
  const lentes = !!ap.lentes
  l.r(5, lentes ? 5 : 6, 2, 1, c.cejas).r(11, lentes ? 5 : 6, 2, 1, c.cejas)
  if (lentes) l.marco(4, 6, 4, 4, LENTES).marco(10, 6, 4, 4, LENTES).r(8, 7, 2, 1, LENTES)
  ojo(l, 5, cerrados, lentes, true)
  ojo(l, 11, cerrados, lentes, false)
  l.r(8, 9, 2, 1, c.pielSombra)
  if (ap.rubor) {
    const rubor = mezclar(ap.piel, 0xe0707a, 0.45)
    l.p(4, 10, rubor).p(13, 10, rubor)
  }
  if (ap.barba !== undefined) l.r(3, 9, 2, 4, ap.barba).r(13, 9, 2, 4, ap.barba).r(4, 12, 10, 2, ap.barba)
  if (ap.bigote !== undefined) l.r(6, 10, 6, 1, ap.bigote)
  const boca = colorBoca(ap)
  switch (ap.boca ?? 'sonrisa') {
    case 'sonrisa':
      l.r(7, 11, 4, 1, boca).p(6, 10, boca).p(11, 10, boca)
      break
    case 'seria':
      l.r(7, 11, 4, 1, boca)
      break
    case 'triste':
      l.r(7, 11, 4, 1, boca).p(6, 12, boca).p(11, 12, boca)
      break
  }
}

function caraLado(l: Lienzo, ap: Apariencia, c: Colores): void {
  const lentes = !!ap.lentes
  l.r(11, lentes ? 5 : 6, 2, 1, c.cejas)
  if (lentes) {
    l.marco(10, 6, 4, 4, LENTES).r(6, 7, 4, 1, LENTES)
    l.r(11, 7, 2, 2, LENTE).r(12, 7, 1, 2, OJO)
  } else {
    l.r(11, 7, 2, 2, OJO).p(11, 7, BRILLO)
  }
  if (ap.rubor) l.p(10, 10, mezclar(ap.piel, 0xe0707a, 0.45))
  if (ap.barba !== undefined) l.r(5, 9, 3, 4, ap.barba).r(6, 12, 8, 2, ap.barba)
  if (ap.bigote !== undefined) l.r(12, 10, 3, 1, ap.bigote)
  l.r(12, 11, 2, 1, colorBoca(ap))
  l.r(7, 7, 2, 3, c.pielSombra)
}

/** Torso, brazos y piernas. */
function cuerpo(l: Lienzo, ap: Apariencia, c: Colores, vista: Vista, paso: Paso, brazos: Brazos): void {
  if (vista === 'lado') {
    cuerpoLado(l, ap, c, paso)
    return
  }
  const { x, w } = anchoTorso(ap)
  const derecha = x + w

  // Cuello
  l.r(7, 14, 4, 1, c.pielSombra)

  // Brazos
  const brazo = (bx: number): void => {
    if (brazos === 'colgando') {
      if (ap.mangasCortas) {
        l.r(bx, 15, 2, 7, c.piel).r(bx, 15, 2, 3, c.mangas)
      } else {
        l.r(bx, 15, 2, 7, c.mangas)
      }
      l.r(bx, 22, 2, 1, c.piel)
    } else {
      l.r(bx, 15, 2, 4, ap.mangasCortas ? c.piel : c.mangas)
      if (ap.mangasCortas) l.r(bx, 15, 2, 2, c.mangas)
    }
  }
  brazo(x - 2)
  brazo(derecha)

  // Torso
  l.r(x, 15, w, 7, c.torso).borrar(x, 15).borrar(derecha - 1, 15)
  if (vista === 'frente') {
    if (ap.prenda === 'traje') {
      l.r(7, 15, 4, 1, ap.camisa).r(8, 16, 2, 1, ap.camisa)
      l.p(6, 16, oscurecer(c.torso, 0.25)).p(11, 16, oscurecer(c.torso, 0.25))
    }
    if (ap.prenda === 'chaleco') l.r(7, 15, 4, 1, ap.camisa).r(8, 16, 2, 1, ap.camisa)
    if (ap.prenda === 'cardigan') l.r(8, 15, 2, 7, ap.camisa).p(7, 18, oscurecer(c.torso, 0.3))
    if (ap.corbata !== undefined || ap.prenda === 'traje') {
      const cuello = aclarar(ap.camisa, 0.4)
      l.p(7, 15, cuello).p(10, 15, cuello)
    }
    if (ap.corbata !== undefined) l.r(8, 15, 2, 1, oscurecer(ap.corbata, 0.3)).r(8, 16, 2, 5, ap.corbata)
  }

  // Manos sobre el teclado (sentado)
  if (brazos !== 'colgando') {
    const yIzq = brazos === 'teclado2' ? 19 : 20
    const yDer = 20
    l.r(x - 1, 19, 2, 1, c.mangas).r(derecha - 1, 19, 2, 1, c.mangas)
    l.r(5, yIzq, 2, 1, c.piel).r(11, yDer, 2, 1, c.piel)
  }

  // Cadera y piernas
  if (ap.falda !== undefined) {
    l.r(x, 22, w, 2, ap.falda).r(x - 1, 24, w + 2, 1, ap.falda)
    const pierna = (px: number, largo: number): void => {
      l.r(px, 25, 2, largo, c.piel).r(px - 1, 25 + largo, 3, 1, ZAPATOS)
    }
    pierna(6, paso === 1 ? 1 : 2)
    pierna(10, paso === 2 ? 1 : 2)
    return
  }
  l.r(x, 22, w, 1, CINTURON)
  l.r(5, 23, 8, 1, c.pantalon)
  const pierna = (px: number, alzada: boolean): void => {
    const largo = alzada ? 2 : 3
    l.r(px, 24, 3, largo, c.pantalon).r(px - (px < 9 ? 1 : 0), 24 + largo, 4, 1, ZAPATOS)
  }
  pierna(5, paso === 1)
  pierna(10, paso === 2)
}

function cuerpoLado(l: Lienzo, ap: Apariencia, c: Colores, paso: Paso): void {
  const grueso = ap.complexion === 'gruesa' ? 1 : 0
  l.r(8, 14, 4, 1, c.pielSombra)
  l.r(6 - grueso, 15, 7 + grueso * 2, 7, c.torso)
  if (ap.prenda !== 'camisa') l.r(11 + grueso, 15, 2, 6, ap.camisa)
  if (ap.corbata !== undefined) l.r(12 + grueso, 16, 1, 5, ap.corbata)

  // Brazo que balancea al caminar
  const brazoX = paso === 1 ? 10 : paso === 2 ? 6 : 8
  if (ap.mangasCortas) {
    l.r(brazoX, 15, 3, 6, c.piel).r(brazoX, 15, 3, 2, c.mangas)
  } else {
    l.r(brazoX, 15, 3, 6, c.mangas)
  }
  l.r(brazoX, 21, 3, 1, c.piel)

  if (ap.falda !== undefined) {
    l.r(6, 22, 7, 3, ap.falda)
    if (paso === 1) {
      l.r(10, 25, 2, 2, c.piel).r(10, 27, 3, 1, ZAPATOS).r(6, 25, 2, 1, c.piel).r(5, 26, 3, 1, ZAPATOS)
    } else {
      l.r(8, 25, 2, 2, c.piel).r(8, 27, 4, 1, ZAPATOS)
    }
    return
  }
  l.r(6 - grueso, 22, 7 + grueso * 2, 1, CINTURON)
  if (paso === 1) {
    l.r(9, 23, 3, 4, c.pantalon).r(10, 27, 4, 1, ZAPATOS)
    l.r(5, 23, 3, 3, c.pantalon).r(4, 26, 3, 1, ZAPATOS)
  } else {
    l.r(7, 23, 4, 4, c.pantalon).r(7, 27, 5, 1, ZAPATOS)
  }
}

// ---------------------------------------------------------------- figuras

export function pintar(ap: Apariencia, vista: Vista, paso: Paso, brazos: Brazos, cerrados: boolean): Lienzo {
  const c = colores(ap)
  const l = new Lienzo(18, 28)

  peloTrasero(l, ap, c, vista)
  cuerpo(l, ap, c, vista, paso, brazos)

  if (vista === 'lado') {
    l.redondo(4, 2, 11, 12, c.piel).r(15, 8, 1, 2, c.piel)
    peloLado(l, ap, c)
    caraLado(l, ap, c)
  } else if (vista === 'espalda') {
    l.redondo(3, 2, 12, 12, c.piel).r(2, 7, 1, 3, c.pielSombra).r(15, 7, 1, 3, c.pielSombra)
    peloEspalda(l, ap, c)
  } else {
    l.r(2, 7, 1, 3, c.pielSombra).r(15, 7, 1, 3, c.pielSombra)
    l.redondo(3, 2, 12, 12, c.piel)
    l.r(5, 13, 8, 1, c.pielSombra)
    peloFrente(l, ap, c)
    cara(l, ap, c, cerrados)
  }
  return l
}

const cacheSprites = new Map<string, SpritesPersonaje>()
const cacheRetratos = new Map<string, string>()

export function spritesDe(personajeId: string): SpritesPersonaje {
  const guardado = cacheSprites.get(personajeId)
  if (guardado) return guardado
  const ap = aparienciaDe(personajeId)
  const t = (vista: Vista, paso: Paso, brazos: Brazos = 'colgando', cerrados = false): Texture =>
    pintar(ap, vista, paso, brazos, cerrados).contornear().textura()
  const sprites: SpritesPersonaje = {
    frente: { quieto: t('frente', 0), quietoCerrados: t('frente', 0, 'colgando', true), pasos: [t('frente', 1), t('frente', 2)] },
    espalda: { quieto: t('espalda', 0), pasos: [t('espalda', 1), t('espalda', 2)] },
    lado: { quieto: t('lado', 0), pasos: [t('lado', 1), t('lado', 2)] },
    sentado: {
      normal: t('frente', 0, 'teclado'),
      cerrados: t('frente', 0, 'teclado', true),
      teclea: t('frente', 0, 'teclado2')
    }
  }
  cacheSprites.set(personajeId, sprites)
  return sprites
}

/** Retrato (cabeza y hombros) ampliado para tarjetas y listas, como data URL. */
export function retratoDe(personajeId: string, fondo = 0xbfdcee): string {
  const clave = `${personajeId}:${fondo}`
  const guardado = cacheRetratos.get(clave)
  if (guardado) return guardado
  const completo = pintar(aparienciaDe(personajeId), 'frente', 0, 'colgando', false)
  const recorte = new Lienzo(18, 21)
  recorte.ctx.drawImage(completo.canvas, 0, 0, 18, 21, 0, 0, 18, 21)
  const conMarco = new Lienzo(22, 24)
  conMarco.pegar(recorte.contornear(), 1, 1)
  const url = conMarco.dataURL(4, fondo)
  cacheRetratos.set(clave, url)
  return url
}
