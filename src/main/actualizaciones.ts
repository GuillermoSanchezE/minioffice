import { app, net } from 'electron'

const REPO = 'GuillermoSanchezE/minioffice'
export const PAGINA_DESCARGAS = `https://github.com/${REPO}/releases`
const CADA_MS = 24 * 60 * 60_000
const ESPERA_MS = 10_000

export interface Actualizacion {
  version: string
  url: string
}

/** Compara versiones x.y.z: negativo si a < b. */
export function compararVersiones(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

/**
 * Avisa cuando hay una versión nueva publicada en GitHub (una consulta al abrir
 * y otra al día; solo la app instalada). No descarga nada: la descarga la haces
 * tú desde la página de versiones. La actualización automática llegará cuando la
 * app vaya firmada con un Developer ID (macOS la exige para instalar solo).
 */
export class Actualizaciones {
  private temporizadores: NodeJS.Timeout[] = []

  constructor(private avisar: (a: Actualizacion) => void) {}

  iniciar(): void {
    if (!app.isPackaged) return
    this.temporizadores.push(setTimeout(() => void this.revisar(), 20_000))
    this.temporizadores.push(setInterval(() => void this.revisar(), CADA_MS))
  }

  detener(): void {
    for (const t of this.temporizadores) clearTimeout(t)
  }

  async revisar(): Promise<void> {
    try {
      const respuesta = await Promise.race([
        net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { accept: 'application/vnd.github+json' } }),
        new Promise<never>((_, rechazar) => setTimeout(() => rechazar(new Error('sin respuesta')), ESPERA_MS))
      ])
      if (!respuesta.ok) return
      const datos = (await respuesta.json()) as { tag_name?: unknown; html_url?: unknown }
      const version = typeof datos.tag_name === 'string' ? datos.tag_name.replace(/^v/, '') : ''
      if (!/^\d+\.\d+\.\d+$/.test(version) || compararVersiones(version, app.getVersion()) <= 0) return
      // Solo se abre la página de versiones de este repositorio.
      const url = typeof datos.html_url === 'string' && datos.html_url.startsWith(`${PAGINA_DESCARGAS}/`) ? datos.html_url : PAGINA_DESCARGAS
      this.avisar({ version, url })
    } catch {
      // sin conexión: se vuelve a mirar mañana
    }
  }
}
