import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable, Writable } from 'node:stream'
import { app, net, protocol, shell, systemPreferences } from 'electron'
import {
  ESQUEMA_MODELOS,
  HOST_HF,
  MODELOS_DICTADO,
  type AjustesDictado,
  type EstadoDictado,
  type ModeloDictado,
  type PermisoMicrofono
} from '../shared/dictado'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': 'content-length, content-range, content-type'
}

const REPOS = new Set(Object.values(MODELOS_DICTADO).map((m) => m.repo))
const SEGMENTO_VALIDO = /^[\w.-]+$/

/** Tiene que llamarse antes de que la app esté lista. */
export function registrarEsquemaModelos(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ESQUEMA_MODELOS,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
    }
  ])
}

function tipoDe(ruta: string): string {
  if (ruta.endsWith('.json')) return 'application/json'
  if (ruta.endsWith('.txt')) return 'text/plain'
  return 'application/octet-stream'
}

function comoWeb(r: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(r) as unknown as ReadableStream<Uint8Array>
}

function bytesEn(dir: string): number {
  let total = 0
  let entradas: import('node:fs').Dirent[] = []
  try {
    entradas = readdirSync(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const e of entradas) {
    const ruta = join(dir, e.name)
    if (e.isDirectory()) total += bytesEn(ruta)
    else if (!e.name.endsWith('.parcial')) total += statSync(ruta).size
  }
  return total
}

/**
 * El lado "servidor" del dictado. El renderer pide los archivos del modelo a
 * modelos://hf/<repo>/resolve/main/<archivo>; la primera vez se descargan de
 * Hugging Face y se guardan en la carpeta de la app, después salen del disco.
 * Solo se sirven los modelos de Whisper de la lista.
 */
export class Dictado {
  readonly carpeta: string
  private archivo: string
  private ajustes: AjustesDictado = { modelo: 'small', idioma: 'es' }
  private listos = new Set<ModeloDictado>()
  private descargando = new Set<string>()

  constructor() {
    this.carpeta = join(app.getPath('userData'), 'modelos')
    this.archivo = join(app.getPath('userData'), 'dictado.json')
    try {
      const d = JSON.parse(readFileSync(this.archivo, 'utf8')) as Partial<AjustesDictado> & { listos?: ModeloDictado[] }
      if (d.modelo && d.modelo in MODELOS_DICTADO) this.ajustes.modelo = d.modelo
      if (d.idioma === 'es' || d.idioma === 'en' || d.idioma === 'auto') this.ajustes.idioma = d.idioma
      for (const m of d.listos ?? []) if (m in MODELOS_DICTADO) this.listos.add(m)
    } catch {
      // primera vez
    }
  }

  iniciar(): void {
    protocol.handle(ESQUEMA_MODELOS, (req) => this.servir(req))
  }

  private persistir(): void {
    mkdirSync(dirname(this.archivo), { recursive: true })
    writeFileSync(this.archivo, `${JSON.stringify({ ...this.ajustes, listos: [...this.listos] }, null, 2)}\n`)
  }

  estado(): EstadoDictado {
    const guardados = {} as Record<ModeloDictado, number>
    for (const m of Object.values(MODELOS_DICTADO)) {
      guardados[m.id] = bytesEn(join(this.carpeta, ...m.repo.split('/')))
    }
    return {
      ...this.ajustes,
      guardados,
      listos: [...this.listos].filter((id) => guardados[id] > 0),
      carpeta: this.carpeta
    }
  }

  guardarAjustes(cambios: Partial<AjustesDictado>): EstadoDictado {
    if (cambios.modelo && cambios.modelo in MODELOS_DICTADO) this.ajustes.modelo = cambios.modelo
    if (cambios.idioma === 'es' || cambios.idioma === 'en' || cambios.idioma === 'auto') this.ajustes.idioma = cambios.idioma
    this.persistir()
    return this.estado()
  }

  /** El renderer avisa cuando el modelo cargó entero: ya funciona sin internet. */
  preparado(modelo: ModeloDictado): void {
    if (!(modelo in MODELOS_DICTADO) || this.listos.has(modelo)) return
    this.listos.add(modelo)
    this.persistir()
  }

  borrar(modelo: ModeloDictado): EstadoDictado {
    const info = MODELOS_DICTADO[modelo]
    if (info) rmSync(join(this.carpeta, ...info.repo.split('/')), { recursive: true, force: true })
    this.listos.delete(modelo)
    this.persistir()
    return this.estado()
  }

  /** En Mac, la primera vez macOS pregunta si minioffice puede usar el micrófono. */
  async permiso(): Promise<PermisoMicrofono> {
    if (process.platform !== 'darwin' && process.platform !== 'win32') return 'concedido'
    // Pruebas automáticas con un micrófono simulado.
    if (app.commandLine.hasSwitch('use-fake-device-for-media-stream')) return 'concedido'
    const estado = systemPreferences.getMediaAccessStatus('microphone')
    if (estado === 'granted') return 'concedido'
    if (estado === 'denied') return 'denegado'
    if (estado === 'restricted') return 'restringido'
    if (process.platform === 'darwin') return (await systemPreferences.askForMediaAccess('microphone')) ? 'concedido' : 'denegado'
    return 'sin-preguntar'
  }

  abrirPrivacidad(): void {
    const url =
      process.platform === 'darwin'
        ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
        : 'ms-settings:privacy-microphone'
    void shell.openExternal(url)
  }

  // ------------------------------------------------------------ protocolo

  private async servir(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    const url = new URL(req.url)
    const partes = url.pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p))
    const repo = partes.slice(0, 2).join('/')
    const archivo = partes.slice(4)
    const valido =
      url.host === 'hf' &&
      REPOS.has(repo) &&
      partes[2] === 'resolve' &&
      partes[3] === 'main' &&
      archivo.length > 0 &&
      archivo.every((p) => SEGMENTO_VALIDO.test(p) && p !== '.' && p !== '..')
    if (!valido) return new Response(null, { status: 404, headers: CORS })

    const ruta = join(this.carpeta, ...repo.split('/'), ...archivo)
    const rango = req.headers.get('range')
    if (existsSync(ruta)) return this.desdeDisco(ruta, rango)
    return this.desdeHuggingFace(`${HOST_HF}${repo}/resolve/main/${archivo.join('/')}`, ruta, rango)
  }

  private desdeDisco(ruta: string, rango: string | null): Response {
    const tamano = statSync(ruta).size
    const tipo = tipoDe(ruta)
    const m = rango ? /^bytes=(\d+)-(\d*)$/.exec(rango) : null
    if (!m) {
      return new Response(comoWeb(createReadStream(ruta)), {
        status: 200,
        headers: { ...CORS, 'content-type': tipo, 'content-length': String(tamano) }
      })
    }
    const inicio = Number(m[1])
    const fin = m[2] ? Math.min(Number(m[2]), tamano - 1) : tamano - 1
    if (inicio > fin) return new Response(null, { status: 416, headers: { ...CORS, 'content-range': `bytes */${tamano}` } })
    return new Response(comoWeb(createReadStream(ruta, { start: inicio, end: fin })), {
      status: 206,
      headers: {
        ...CORS,
        'content-type': tipo,
        'content-length': String(fin - inicio + 1),
        'content-range': `bytes ${inicio}-${fin}/${tamano}`
      }
    })
  }

  private async desdeHuggingFace(remota: string, ruta: string, rango: string | null): Promise<Response> {
    let r: Response
    try {
      r = await net.fetch(remota, rango ? { headers: { range: rango } } : undefined)
    } catch {
      return new Response('Sin conexión con Hugging Face', { status: 503, headers: CORS })
    }
    // Si vino comprimido, net.fetch ya lo descomprimió y su content-length no vale.
    const comprimido = !!r.headers.get('content-encoding') && r.headers.get('content-encoding') !== 'identity'
    const cabeceras: Record<string, string> = { ...CORS }
    for (const c of ['content-type', 'content-length', 'content-range']) {
      const v = r.headers.get(c)
      if (v && !(comprimido && c === 'content-length')) cabeceras[c] = v
    }
    // Consultas de tamaño (Range) y errores pasan tal cual, sin guardarse.
    if (rango || !r.ok || !r.body) return new Response(r.body, { status: r.status, headers: cabeceras })

    const total = comprimido ? 0 : Number(r.headers.get('content-length')) || 0
    const [paraApp, paraDisco] = r.body.tee()
    if (this.descargando.has(ruta)) {
      void paraDisco.cancel()
    } else {
      this.descargando.add(ruta)
      void this.guardar(paraDisco, ruta, total).finally(() => this.descargando.delete(ruta))
    }
    return new Response(paraApp, { status: 200, headers: cabeceras })
  }

  private async guardar(cuerpo: ReadableStream<Uint8Array>, ruta: string, total: number): Promise<void> {
    const temporal = `${ruta}.${process.pid}.parcial`
    try {
      mkdirSync(dirname(ruta), { recursive: true })
      await cuerpo.pipeTo(Writable.toWeb(createWriteStream(temporal)) as unknown as WritableStream<Uint8Array>)
      if (total && statSync(temporal).size !== total) throw new Error('Descarga incompleta')
      renameSync(temporal, ruta)
    } catch {
      rmSync(temporal, { force: true })
    }
  }
}
