import { CanvasSource, Texture } from 'pixi.js'

export const CONTORNO = 0x2a1f26

function css(color: number, alpha = 1): string {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`
}

export function mezclar(color: number, destino: number, t: number): number {
  const c = (v: number, s: number): number => (v >> s) & 0xff
  const canal = (s: number): number => Math.round(c(color, s) + (c(destino, s) - c(color, s)) * t)
  return (canal(16) << 16) | (canal(8) << 8) | canal(0)
}

export const oscurecer = (color: number, t: number): number => mezclar(color, 0x000000, t)
export const aclarar = (color: number, t: number): number => mezclar(color, 0xffffff, t)

/** Lienzo de pixel art: todas las coordenadas son enteras y no hay suavizado. */
export class Lienzo {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D

  constructor(
    readonly ancho: number,
    readonly alto: number
  ) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = ancho
    this.canvas.height = alto
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!
    this.ctx.imageSmoothingEnabled = false
  }

  r(x: number, y: number, w: number, h: number, color: number, alpha = 1): this {
    if (w <= 0 || h <= 0) return this
    this.ctx.fillStyle = css(color, alpha)
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
    return this
  }

  p(x: number, y: number, color: number, alpha = 1): this {
    return this.r(x, y, 1, 1, color, alpha)
  }

  /** Borra un pixel (lo deja transparente). */
  borrar(x: number, y: number, w = 1, h = 1): this {
    this.ctx.clearRect(x, y, w, h)
    return this
  }

  /** Rectangulo con las cuatro esquinas recortadas un pixel. */
  redondo(x: number, y: number, w: number, h: number, color: number): this {
    this.r(x + 1, y, w - 2, h, color)
    this.r(x, y + 1, 1, h - 2, color)
    this.r(x + w - 1, y + 1, 1, h - 2, color)
    return this
  }

  /** Borde de un pixel alrededor de un rectangulo. */
  marco(x: number, y: number, w: number, h: number, color: number): this {
    this.r(x, y, w, 1, color)
    this.r(x, y + h - 1, w, 1, color)
    this.r(x, y, 1, h, color)
    this.r(x + w - 1, y, 1, h, color)
    return this
  }

  pegar(otro: Lienzo, x: number, y: number, espejo = false): this {
    if (espejo) {
      this.ctx.save()
      this.ctx.translate(x + otro.ancho, y)
      this.ctx.scale(-1, 1)
      this.ctx.drawImage(otro.canvas, 0, 0)
      this.ctx.restore()
    } else {
      this.ctx.drawImage(otro.canvas, x, y)
    }
    return this
  }

  /**
   * Devuelve un lienzo un pixel mas grande por lado con un contorno oscuro
   * alrededor de todo lo dibujado: el acabado tipico del pixel art.
   */
  contornear(color = CONTORNO): Lienzo {
    const salida = new Lienzo(this.ancho + 2, this.alto + 2)
    const datos = this.ctx.getImageData(0, 0, this.ancho, this.alto).data
    const opaco = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < this.ancho && y < this.alto && datos[(y * this.ancho + x) * 4 + 3] > 16
    for (let y = -1; y <= this.alto; y++) {
      for (let x = -1; x <= this.ancho; x++) {
        if (opaco(x, y)) continue
        if (opaco(x - 1, y) || opaco(x + 1, y) || opaco(x, y - 1) || opaco(x, y + 1)) {
          salida.p(x + 1, y + 1, color)
        }
      }
    }
    salida.pegar(this, 1, 1)
    return salida
  }

  textura(): Texture {
    const source = new CanvasSource({ resource: this.canvas, scaleMode: 'nearest' })
    source.scaleMode = 'nearest'
    return new Texture({ source })
  }

  /** Imagen ampliada sin suavizado, para usar el sprite en la interfaz HTML. */
  dataURL(escala: number, fondo?: number): string {
    const ampliado = document.createElement('canvas')
    ampliado.width = this.ancho * escala
    ampliado.height = this.alto * escala
    const ctx = ampliado.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    if (fondo !== undefined) {
      ctx.fillStyle = css(fondo)
      ctx.fillRect(0, 0, ampliado.width, ampliado.height)
    }
    ctx.drawImage(this.canvas, 0, 0, ampliado.width, ampliado.height)
    return ampliado.toDataURL('image/png')
  }
}
