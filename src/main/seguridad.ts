import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, session } from 'electron'

/** De dónde carga minioffice sus propias páginas (el servidor de desarrollo o out/renderer). */
function origenPropio(): string {
  const dev = process.env['ELECTRON_RENDERER_URL']
  return dev ? new URL(dev).origin : pathToFileURL(join(__dirname, '../renderer')).href
}

function decodificar(url: string): string {
  try {
    return decodeURI(url)
  } catch {
    return url
  }
}

/** ¿Es una página de minioffice? Solo ellas pueden usar la API de la oficina. */
export function esUrlPropia(url: string | undefined): boolean {
  if (!url) return false
  const propio = origenPropio()
  if (!propio.startsWith('file:')) return url === propio || url.startsWith(`${propio}/`)
  // Rutas con espacios o acentos pueden venir codificadas de dos formas.
  return decodificar(url).startsWith(`${decodificar(propio)}/`)
}

/** Lo único que las páginas de minioffice necesitan: micrófono (dictado) y copiar al portapapeles. */
const PERMISOS = new Set(['media', 'clipboard-sanitized-write'])

/**
 * Defensa en profundidad: ninguna ventana navega fuera de minioffice ni abre
 * otras, y el navegador solo concede micrófono y portapapeles a nuestras páginas.
 */
export function endurecer(): void {
  app.on('web-contents-created', (_e, contenidos) => {
    contenidos.setWindowOpenHandler(() => ({ action: 'deny' }))
    contenidos.on('will-navigate', (evento, url) => {
      if (!esUrlPropia(url)) evento.preventDefault()
    })
    contenidos.on('will-redirect', (evento, url) => {
      if (!esUrlPropia(url)) evento.preventDefault()
    })
    contenidos.on('will-attach-webview', (evento) => evento.preventDefault())
  })

  const sesion = session.defaultSession
  sesion.setPermissionRequestHandler((contenidos, permiso, responder, detalles) => {
    const propio = esUrlPropia(detalles.requestingUrl || contenidos.getURL())
    if (permiso === 'media') {
      const tipos = (detalles as { mediaTypes?: string[] }).mediaTypes ?? []
      return responder(propio && !tipos.includes('video'))
    }
    responder(propio && PERMISOS.has(permiso))
  })
  // Con file:// el origen no dice de qué página se trata: se mira la página que pregunta.
  sesion.setPermissionCheckHandler((contenidos, permiso) => PERMISOS.has(permiso) && esUrlPropia(contenidos?.getURL()))
}
