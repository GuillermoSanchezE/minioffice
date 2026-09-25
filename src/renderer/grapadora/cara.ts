/**
 * Criatura de la grapadora: un blob de color con ojos. La misma palabra
 * (semilla) siempre dibuja la misma cara. Forma y expresion 0 = "auto".
 */

export const FORMAS = ['Auto', 'Círculo', 'Suave', 'Caja', 'Ladeado', 'Osito', 'Frijol', 'Engrane', 'Píldora', 'Triángulo', 'Hexágono', 'Gota'] as const
export const EXPRESIONES = [
  'Auto',
  'Normal',
  'Dormido',
  'Feliz',
  'Guiño',
  'Sorpresa',
  'Mira a un lado',
  'Mira al otro',
  'Puntitos',
  'Enojado',
  'Triste',
  'Contento',
  'Cansado',
  'Lentes',
  'Estrellas'
] as const

export const COLORES_GRAPADORA = [
  '#f6efe3',
  '#cfc8d8',
  '#f2a39a',
  '#a7c7ee',
  '#a8d8b9',
  '#f2b33d',
  '#d9534f',
  '#d9824a',
  '#d4a02e',
  '#3f9b62',
  '#4f9faf',
  '#8a6fcf'
]

export interface OpcionesCara {
  semilla: string
  forma: number
  expresion: number
  color: string
  /** Sin animacion (miniaturas). */
  quieta?: boolean
}

function hash(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function aleatorio(semilla: number): () => number {
  let s = semilla || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 10000) / 10000
  }
}

function hex(color: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim())
  const n = m ? parseInt(m[1], 16) : 0xd9a441
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function aHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
}

function mezclar(a: string, b: string, t: number): string {
  const x = hex(a)
  const y = hex(b)
  return aHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t])
}

export function esColorValido(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color.trim())
}

function luminancia(color: string): number {
  const [r, g, b] = hex(color)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** Contorno de la forma como puntos en un lienzo de 100x100. */
function contorno(forma: number, r: () => number): Array<[number, number]> {
  const N = 96
  const puntos: Array<[number, number]> = []
  const jitter = 0.02 * r()
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    const superelipse = (a: number, b: number, n: number): [number, number] => [
      a * Math.sign(c) * Math.abs(c) ** (2 / n),
      b * Math.sign(s) * Math.abs(s) ** (2 / n)
    ]
    let p: [number, number]
    switch (forma) {
      case 1:
        p = [40 * c, 40 * s]
        break
      case 2:
        p = superelipse(40, 38, 3.2)
        break
      case 3:
        p = superelipse(39, 37, 6)
        break
      case 4: {
        const q = superelipse(40, 36, 3)
        const ang = -0.18
        p = [q[0] * Math.cos(ang) - q[1] * Math.sin(ang), q[0] * Math.sin(ang) + q[1] * Math.cos(ang)]
        break
      }
      case 5: {
        // Circulo con dos orejitas arriba.
        const oreja = (centro: number): number => 9 * Math.exp(-((Math.atan2(Math.sin(t - centro), Math.cos(t - centro))) ** 2) / 0.035)
        const radio = 35 + oreja(-Math.PI / 2 - 0.85) + oreja(-Math.PI / 2 + 0.85)
        p = [radio * c, radio * s + 3]
        break
      }
      case 6: {
        const radio = 38 + 5 * Math.sin(2 * t + 0.6)
        p = [radio * c * 1.05, radio * s * 0.92]
        break
      }
      case 7: {
        const radio = 36 + 4.5 * Math.cos(10 * t)
        p = [radio * c, radio * s]
        break
      }
      case 8:
        p = superelipse(46, 27, 2.6)
        break
      case 9:
      case 10: {
        // Poligono redondeado con un vertice arriba: triangulo o hexagono.
        const lados = forma === 9 ? 3 : 6
        const sector = (Math.PI * 2) / lados
        const a = ((((t + Math.PI / 2) % sector) + sector) % sector) - sector / 2
        const poligono = Math.cos(Math.PI / lados) / Math.cos(a)
        const radio = 40 * (0.78 * poligono + 0.22 * ((1 + Math.cos(Math.PI / lados)) / 2))
        p = [radio * c, radio * s]
        break
      }
      case 11: {
        const u = t
        const x = Math.sin(u) * Math.sin(u / 2) ** 1.1
        const y = -Math.cos(u)
        p = [x * 46, y * 42 + 2]
        break
      }
      default:
        p = [40 * c, 40 * s]
    }
    puntos.push([p[0] * (1 + jitter), p[1]])
  }
  // Encaja la forma en [10, 90] conservando proporciones.
  const xs = puntos.map((q) => q[0])
  const ys = puntos.map((q) => q[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const escala = 80 / Math.max(x1 - x0, y1 - y0)
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  return puntos.map(([x, y]) => [50 + (x - cx) * escala, 52 + (y - cy) * escala])
}

function camino(puntos: Array<[number, number]>): string {
  return `M${puntos.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`
}

function ojos(expresion: number, tinta: string, r: () => number, forma: number): string {
  const sep = 11 + Math.round(r() * 3)
  const alto = forma === 8 ? 49 : 50
  const iz = 50 - sep
  const de = 50 + sep
  const ojo = (x: number, y: number, w = 6.5, h = 13): string =>
    `<rect class="ojo" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${w / 2}" fill="${tinta}"/>`
  const trazo = (d: string, ancho = 3.4): string =>
    `<path d="${d}" fill="none" stroke="${tinta}" stroke-width="${ancho}" stroke-linecap="round" stroke-linejoin="round"/>`
  switch (expresion) {
    case 2:
      return trazo(`M${iz - 5} ${alto}h10M${de - 5} ${alto}h10`)
    case 3:
      return trazo(`M${iz - 5} ${alto + 2}q5 -8 10 0M${de - 5} ${alto + 2}q5 -8 10 0`)
    case 4:
      return ojo(iz, alto) + trazo(`M${de - 5} ${alto + 1}q5 -7 10 0`)
    case 5:
      return (
        `<circle class="ojo" cx="${iz}" cy="${alto - 1}" r="5.5" fill="${tinta}"/><circle class="ojo" cx="${de}" cy="${alto - 1}" r="5.5" fill="${tinta}"/>` +
        `<ellipse cx="50" cy="${alto + 13}" rx="3.2" ry="4" fill="${tinta}"/>`
      )
    case 6:
      return ojo(iz - 4, alto) + ojo(de - 4, alto)
    case 7:
      return ojo(iz + 4, alto) + ojo(de + 4, alto)
    case 8:
      return `<circle class="ojo" cx="${iz}" cy="${alto}" r="3.4" fill="${tinta}"/><circle class="ojo" cx="${de}" cy="${alto}" r="3.4" fill="${tinta}"/>`
    case 9:
      return ojo(iz, alto + 2, 6.5, 10) + ojo(de, alto + 2, 6.5, 10) + trazo(`M${iz - 6} ${alto - 9}l10 4M${de + 6} ${alto - 9}l-10 4`, 3)
    case 10:
      return ojo(iz, alto + 1, 6.5, 11) + ojo(de, alto + 1, 6.5, 11) + trazo(`M${iz - 6} ${alto - 6}l9 -4M${de + 6} ${alto - 6}l-9 -4`, 3) + trazo(`M44 ${alto + 15}q6 -5 12 0`, 3)
    case 11:
      return ojo(iz, alto) + ojo(de, alto) + trazo(`M43 ${alto + 11}q7 6 14 0`, 3)
    case 12:
      return (
        `<rect class="ojo" x="${iz - 3.25}" y="${alto - 1}" width="6.5" height="7" rx="3" fill="${tinta}"/><rect class="ojo" x="${de - 3.25}" y="${alto - 1}" width="6.5" height="7" rx="3" fill="${tinta}"/>` +
        trazo(`M${iz - 6} ${alto - 2}h12M${de - 6} ${alto - 2}h12`, 3)
      )
    case 13:
      return (
        `<circle cx="${iz}" cy="${alto}" r="9" fill="rgba(255,255,255,.35)" stroke="${tinta}" stroke-width="3"/><circle cx="${de}" cy="${alto}" r="9" fill="rgba(255,255,255,.35)" stroke="${tinta}" stroke-width="3"/>` +
        trazo(`M${iz + 9} ${alto}h${de - iz - 18}`, 3) +
        `<circle class="ojo" cx="${iz}" cy="${alto}" r="3" fill="${tinta}"/><circle class="ojo" cx="${de}" cy="${alto}" r="3" fill="${tinta}"/>`
      )
    case 14: {
      const estrella = (x: number): string =>
        `<path class="ojo" d="M${x} ${alto - 8}L${x + 2.4} ${alto - 2.4}L${x + 8} ${alto}L${x + 2.4} ${alto + 2.4}L${x} ${alto + 8}L${x - 2.4} ${alto + 2.4}L${x - 8} ${alto}L${x - 2.4} ${alto - 2.4}Z" fill="${tinta}"/>`
      return estrella(iz) + estrella(de)
    }
    default:
      return ojo(iz, alto) + ojo(de, alto)
  }
}

/** SVG completo de la criatura (100x100). */
export function svgCara(o: OpcionesCara): string {
  const h = hash(o.semilla.trim().toLowerCase() || 'minioffice')
  const r = aleatorio(h)
  const forma = o.forma > 0 ? o.forma : 1 + (h % (FORMAS.length - 1))
  const expresion = o.expresion > 0 ? o.expresion : 1 + ((h >>> 8) % 4 === 0 ? 10 : (h >>> 8) % 2 === 0 ? 0 : 7)
  const color = esColorValido(o.color) ? o.color : '#d9a441'
  const oscuro = luminancia(color) < 0.35
  const tinta = oscuro ? '#fbf6ee' : '#231c26'
  const sombra = mezclar(color, '#1b1420', 0.28)
  const brillo = mezclar(color, '#ffffff', 0.45)
  const id = `g${h.toString(36)}${forma}`
  const d = camino(contorno(forma, r))
  const anim = o.quieta
    ? ''
    : `<style>
.cuerpo-${id}{transform-origin:50px 90px;animation:respira-${id} 3.6s ease-in-out infinite}
.cuerpo-${id} .ojo{transform-box:fill-box;transform-origin:center;animation:parpadea-${id} 5.2s infinite}
@keyframes respira-${id}{0%,100%{transform:scale(1,1)}50%{transform:scale(1.025,.975)}}
@keyframes parpadea-${id}{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.12)}}
</style>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">${anim}
<defs><radialGradient id="${id}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${brillo}"/><stop offset=".55" stop-color="${color}"/><stop offset="1" stop-color="${sombra}"/></radialGradient></defs>
<ellipse cx="50" cy="94" rx="26" ry="3.5" fill="rgba(0,0,0,.14)"/>
<g class="cuerpo-${id}"><path d="${d}" fill="url(#${id})" stroke="${mezclar(color, '#1b1420', 0.45)}" stroke-width="1.6"/>${ojos(expresion, tinta, r, forma)}</g>
</svg>`
}

/** Una palabra al azar para "Barajar". */
export function palabraAlAzar(): string {
  const palabras = ['glaciar', 'papel', 'grapa', 'scranton', 'bears', 'beets', 'dundie', 'nashua', 'stamford', 'utica', 'kevin', 'pretzel', 'chili', 'parkour', 'serenity']
  return `${palabras[Math.floor(Math.random() * palabras.length)]} ${Math.floor(Math.random() * 90) + 10}`
}
