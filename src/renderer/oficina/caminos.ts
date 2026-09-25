import type { Punto, Rect } from './plano'

const CELDA = 4

/**
 * Rejilla de celdas de 4 px con A* de 8 direcciones. No permite cortar esquinas
 * en diagonal para que nadie atraviese la punta de un escritorio o un muro.
 */
export class Rejilla {
  private readonly columnas: number
  private readonly filas: number
  private readonly bloqueada: Uint8Array

  constructor(ancho: number, alto: number, obstaculos: Rect[]) {
    this.columnas = Math.ceil(ancho / CELDA)
    this.filas = Math.ceil(alto / CELDA)
    this.bloqueada = new Uint8Array(this.columnas * this.filas)
    for (const o of obstaculos) {
      const c0 = Math.max(0, Math.floor(o.x / CELDA))
      const c1 = Math.min(this.columnas - 1, Math.floor((o.x + o.w - 1) / CELDA))
      const f0 = Math.max(0, Math.floor(o.y / CELDA))
      const f1 = Math.min(this.filas - 1, Math.floor((o.y + o.h - 1) / CELDA))
      for (let f = f0; f <= f1; f++) for (let c = c0; c <= c1; c++) this.bloqueada[f * this.columnas + c] = 1
    }
  }

  private libre(c: number, f: number): boolean {
    return c >= 0 && f >= 0 && c < this.columnas && f < this.filas && this.bloqueada[f * this.columnas + c] === 0
  }

  private celda(p: Punto): [number, number] {
    return [
      Math.min(this.columnas - 1, Math.max(0, Math.floor(p.x / CELDA))),
      Math.min(this.filas - 1, Math.max(0, Math.floor(p.y / CELDA)))
    ]
  }

  /** Celda libre mas cercana (para salir de una silla o llegar junto a un mueble). */
  private liberar(c: number, f: number): [number, number] {
    if (this.libre(c, f)) return [c, f]
    for (let radio = 1; radio < 12; radio++) {
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radio) continue
          if (this.libre(c + dx, f + dy)) return [c + dx, f + dy]
        }
      }
    }
    return [c, f]
  }

  /**
   * Camino de `desde` a `hasta` como lista de puntos del mundo. El inicio y el
   * final pueden estar dentro de un obstaculo (una silla detras del escritorio):
   * se sale y se entra por la celda libre mas cercana.
   */
  camino(desde: Punto, hasta: Punto): Punto[] {
    const [c0, f0] = this.liberar(...this.celda(desde))
    const [c1, f1] = this.liberar(...this.celda(hasta))
    const total = this.columnas * this.filas
    const g = new Float32Array(total).fill(Infinity)
    const previo = new Int32Array(total).fill(-1)
    const cerrado = new Uint8Array(total)
    const inicio = f0 * this.columnas + c0
    const meta = f1 * this.columnas + c1
    g[inicio] = 0

    // Monticulo binario sencillo de [prioridad, indice]
    const monticulo: Array<[number, number]> = [[0, inicio]]
    const subir = (i: number): void => {
      while (i > 0) {
        const p = (i - 1) >> 1
        if (monticulo[p][0] <= monticulo[i][0]) break
        ;[monticulo[p], monticulo[i]] = [monticulo[i], monticulo[p]]
        i = p
      }
    }
    const bajar = (i: number): void => {
      for (;;) {
        const a = i * 2 + 1
        const b = a + 1
        let menor = i
        if (a < monticulo.length && monticulo[a][0] < monticulo[menor][0]) menor = a
        if (b < monticulo.length && monticulo[b][0] < monticulo[menor][0]) menor = b
        if (menor === i) return
        ;[monticulo[menor], monticulo[i]] = [monticulo[i], monticulo[menor]]
        i = menor
      }
    }
    const heuristica = (c: number, f: number): number => {
      const dx = Math.abs(c - c1)
      const dy = Math.abs(f - f1)
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)
    }

    while (monticulo.length > 0) {
      const [, actual] = monticulo[0]
      const ultimo = monticulo.pop()!
      if (monticulo.length > 0) {
        monticulo[0] = ultimo
        bajar(0)
      }
      if (cerrado[actual]) continue
      if (actual === meta) break
      cerrado[actual] = 1
      const c = actual % this.columnas
      const f = Math.floor(actual / this.columnas)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nc = c + dx
          const nf = f + dy
          if (!this.libre(nc, nf)) continue
          if (dx !== 0 && dy !== 0 && (!this.libre(c + dx, f) || !this.libre(c, f + dy))) continue
          const vecino = nf * this.columnas + nc
          const costo = g[actual] + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1)
          if (costo < g[vecino]) {
            g[vecino] = costo
            previo[vecino] = actual
            monticulo.push([costo + heuristica(nc, nf), vecino])
            subir(monticulo.length - 1)
          }
        }
      }
    }

    if (previo[meta] === -1 && meta !== inicio) return [hasta]
    const celdas: number[] = []
    for (let i = meta; i !== -1; i = previo[i]) celdas.push(i)
    celdas.reverse()
    const puntos = celdas.map((i) => ({
      x: (i % this.columnas) * CELDA + CELDA / 2,
      y: Math.floor(i / this.columnas) * CELDA + CELDA / 2
    }))
    return [...this.simplificar(puntos), hasta]
  }

  /** Quita los puntos intermedios de tramos rectos. */
  private simplificar(puntos: Punto[]): Punto[] {
    if (puntos.length < 3) return puntos
    const salida = [puntos[0]]
    for (let i = 1; i < puntos.length - 1; i++) {
      const a = salida[salida.length - 1]
      const b = puntos[i]
      const c = puntos[i + 1]
      const cruz = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
      if (Math.abs(cruz) > 0.01) salida.push(b)
    }
    salida.push(puntos[puntos.length - 1])
    return salida
  }
}
