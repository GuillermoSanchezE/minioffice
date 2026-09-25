import { useSyncExternalStore } from 'react'
import { IDIOMA_WHISPER, MODELOS_DICTADO, type EstadoDictado, type ModeloDictado } from '../../shared/dictado'
import { accion, avisar } from '../tienda'
import type { PedidoWhisper, RespuestaWhisper } from './whisper.worker'

/**
 * Dictado por voz: graba el micrófono, lo pasa a 16 kHz y se lo da a Whisper,
 * que corre en un worker. Solo un campo dicta a la vez.
 */

export type FaseVoz = 'libre' | 'grabando' | 'transcribiendo'

export interface EstadoVoz {
  fase: FaseVoz
  /** Qué botón está dictando. */
  dueno: string | null
  inicio: number
  /** Nivel del micrófono, 0..1. */
  nivel: number
  /** Descarga o carga del modelo en curso. */
  carga: { modelo: ModeloDictado; cargado: number; total: number } | null
  modeloCargado: ModeloDictado | null
  ajustes: EstadoDictado | null
}

const DURACION_MAXIMA_MS = 5 * 60_000
const MUESTREO = 16_000

let estado: EstadoVoz = { fase: 'libre', dueno: null, inicio: 0, nivel: 0, carga: null, modeloCargado: null, ajustes: null }
const oyentes = new Set<() => void>()

function cambiar(parcial: Partial<EstadoVoz>): void {
  estado = { ...estado, ...parcial }
  oyentes.forEach((o) => o())
}

export function useVoz<T>(selector: (e: EstadoVoz) => T): T {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o)
      return () => oyentes.delete(o)
    },
    () => selector(estado)
  )
}

export function estadoVoz(): EstadoVoz {
  return estado
}

// ------------------------------------------------------------------ ajustes

export async function leerAjustesDictado(): Promise<EstadoDictado | null> {
  const a = await accion({ tipo: 'dictado:estado' })
  if (a) cambiar({ ajustes: a })
  return a ?? null
}

export async function guardarAjustesDictado(cambios: Partial<Pick<EstadoDictado, 'modelo' | 'idioma'>>): Promise<void> {
  const a = await accion({ tipo: 'dictado:ajustes', ajustes: cambios })
  if (a) cambiar({ ajustes: a })
}

export async function borrarModelo(modelo: ModeloDictado): Promise<void> {
  if (estado.carga?.modelo === modelo) return avisar('Espera a que termine de cargar.', 'error')
  if (estado.modeloCargado === modelo) {
    cerrarWorker()
    cambiar({ modeloCargado: null })
  }
  const a = await accion({ tipo: 'dictado:borrar', modelo })
  if (a) cambiar({ ajustes: a })
}

/** Si hay que descargar el modelo antes de dictar (la primera vez). */
export function faltaDescargar(a: EstadoDictado): boolean {
  return !a.listos.includes(a.modelo) && estado.modeloCargado !== a.modelo
}

// ------------------------------------------------------------------ worker

let worker: Worker | null = null
let pendienteCarga: { modelo: ModeloDictado; promesa: Promise<void>; resolver: () => void; rechazar: (e: Error) => void } | null = null
const pendientesTexto = new Map<number, { resolver: (t: string) => void; rechazar: (e: Error) => void }>()
let siguienteId = 1

function cerrarWorker(): void {
  worker?.terminate()
  worker = null
  pendienteCarga?.rechazar(new Error('Se canceló la carga del modelo.'))
  pendienteCarga = null
  for (const p of pendientesTexto.values()) p.rechazar(new Error('Se reinició el dictado.'))
  pendientesTexto.clear()
}

function obtenerWorker(): Worker {
  if (worker) return worker
  const w = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module', name: 'whisper' })
  w.onmessage = (e: MessageEvent<RespuestaWhisper>) => {
    const m = e.data
    if (m.tipo === 'progreso') {
      if (estado.carga) cambiar({ carga: { ...estado.carga, cargado: m.cargado, total: m.total } })
    } else if (m.tipo === 'cargado') {
      const p = pendienteCarga
      pendienteCarga = null
      if (p) {
        cambiar({ carga: null, modeloCargado: p.modelo })
        void accion({ tipo: 'dictado:preparado', modelo: p.modelo }).then(() => leerAjustesDictado())
        p.resolver()
      }
    } else if (m.tipo === 'texto') {
      pendientesTexto.get(m.id)?.resolver(m.texto)
      pendientesTexto.delete(m.id)
    } else if (m.tipo === 'error') {
      const error = new Error(m.mensaje)
      if (m.id !== undefined) {
        pendientesTexto.get(m.id)?.rechazar(error)
        pendientesTexto.delete(m.id)
      } else if (pendienteCarga) {
        const p = pendienteCarga
        pendienteCarga = null
        cambiar({ carga: null })
        p.rechazar(error)
      }
    }
  }
  w.onerror = (e) => {
    cerrarWorker()
    cambiar({ carga: null, modeloCargado: null })
    avisar(`El dictado falló: ${e.message || 'error en el worker'}`, 'error')
  }
  worker = w
  return w
}

/** Descarga (la primera vez) y carga el modelo. */
export function prepararModelo(modelo: ModeloDictado): Promise<void> {
  if (estado.modeloCargado === modelo && worker) return Promise.resolve()
  if (pendienteCarga?.modelo === modelo) return pendienteCarga.promesa
  if (pendienteCarga) cerrarWorker()
  let resolver!: () => void
  let rechazar!: (e: Error) => void
  const promesa = new Promise<void>((res, rej) => {
    resolver = res
    rechazar = rej
  })
  pendienteCarga = { modelo, promesa, resolver, rechazar }
  cambiar({ carga: { modelo, cargado: 0, total: MODELOS_DICTADO[modelo].megas * 1e6 }, modeloCargado: null })
  const pedido: PedidoWhisper = { tipo: 'cargar', repo: MODELOS_DICTADO[modelo].repo, ort: new URL('ort/', document.baseURI).href }
  obtenerWorker().postMessage(pedido)
  return promesa
}

function transcribir(audio: Float32Array, idioma: string | undefined): Promise<string> {
  const id = siguienteId++
  return new Promise((resolver, rechazar) => {
    pendientesTexto.set(id, { resolver, rechazar })
    const pedido: PedidoWhisper = { tipo: 'transcribir', id, audio, idioma }
    obtenerWorker().postMessage(pedido, [audio.buffer])
  })
}

// ------------------------------------------------------------------ micrófono

interface Grabacion {
  flujo: MediaStream
  grabador: MediaRecorder
  trozos: Blob[]
  contexto: AudioContext
  alTexto: (texto: string) => void
  cancelada: boolean
  temporizador: number
  cuadro: number
}

let grabacion: Grabacion | null = null

export type ResultadoInicio = 'ok' | 'sin-permiso' | 'ocupado' | 'error'

export async function empezarDictado(dueno: string, alTexto: (texto: string) => void): Promise<ResultadoInicio> {
  if (estado.fase !== 'libre') return 'ocupado'
  const ajustes = estado.ajustes ?? (await leerAjustesDictado())
  if (!ajustes) return 'error'

  const permiso = await accion({ tipo: 'dictado:permiso' })
  if (permiso === 'denegado' || permiso === 'restringido') return 'sin-permiso'

  let flujo: MediaStream
  try {
    flujo = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    })
  } catch (err) {
    const nombre = (err as DOMException).name
    if (nombre === 'NotAllowedError' || nombre === 'SecurityError') return 'sin-permiso'
    avisar(nombre === 'NotFoundError' ? 'No encontré ningún micrófono conectado.' : `No pude abrir el micrófono: ${(err as Error).message}`, 'error')
    return 'error'
  }
  if (estado.fase !== 'libre') {
    flujo.getTracks().forEach((t) => t.stop())
    return 'ocupado'
  }

  // Mientras hablas, el modelo se va cargando.
  void prepararModelo(ajustes.modelo).catch(() => undefined)

  const contexto = new AudioContext()
  const analizador = contexto.createAnalyser()
  analizador.fftSize = 512
  contexto.createMediaStreamSource(flujo).connect(analizador)
  const muestras = new Float32Array(analizador.fftSize)
  let ultimoNivel = 0

  const grabador = new MediaRecorder(flujo)
  const g: Grabacion = {
    flujo,
    grabador,
    trozos: [],
    contexto,
    alTexto,
    cancelada: false,
    temporizador: window.setTimeout(() => detenerDictado(), DURACION_MAXIMA_MS),
    cuadro: 0
  }
  grabacion = g
  grabador.ondataavailable = (e) => e.data.size && g.trozos.push(e.data)
  grabador.onstop = () => void alTerminar(g)
  grabador.start(250)

  const medir = (): void => {
    if (grabacion !== g) return
    analizador.getFloatTimeDomainData(muestras)
    let suma = 0
    for (const v of muestras) suma += v * v
    const nivel = Math.min(1, Math.sqrt(suma / muestras.length) * 6)
    if (Math.abs(nivel - ultimoNivel) > 0.04) {
      ultimoNivel = nivel
      cambiar({ nivel })
    }
    g.cuadro = requestAnimationFrame(medir)
  }
  g.cuadro = requestAnimationFrame(medir)

  cambiar({ fase: 'grabando', dueno, inicio: Date.now(), nivel: 0 })
  return 'ok'
}

function soltarMicrofono(g: Grabacion): void {
  clearTimeout(g.temporizador)
  cancelAnimationFrame(g.cuadro)
  g.flujo.getTracks().forEach((t) => t.stop())
  void g.contexto.close()
}

export function detenerDictado(): void {
  const g = grabacion
  if (!g || g.grabador.state === 'inactive') return
  cambiar({ fase: 'transcribiendo', nivel: 0 })
  g.grabador.stop()
}

export function cancelarDictado(): void {
  const g = grabacion
  if (!g) return
  g.cancelada = true
  if (g.grabador.state !== 'inactive') g.grabador.stop()
}

async function aMono16k(blob: Blob): Promise<Float32Array> {
  const contexto = new AudioContext({ sampleRate: MUESTREO })
  try {
    const audio = await contexto.decodeAudioData(await blob.arrayBuffer())
    if (audio.numberOfChannels === 1) return audio.getChannelData(0).slice()
    const mono = new Float32Array(audio.length)
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const canal = audio.getChannelData(c)
      for (let i = 0; i < mono.length; i++) mono[i] += canal[i] / audio.numberOfChannels
    }
    return mono
  } finally {
    void contexto.close()
  }
}

function hayVoz(audio: Float32Array): boolean {
  let suma = 0
  for (const v of audio) suma += v * v
  return audio.length > MUESTREO * 0.3 && Math.sqrt(suma / audio.length) > 0.003
}

async function alTerminar(g: Grabacion): Promise<void> {
  soltarMicrofono(g)
  if (grabacion === g) grabacion = null
  if (g.cancelada) {
    cambiar({ fase: 'libre', dueno: null, nivel: 0 })
    return
  }
  cambiar({ fase: 'transcribiendo', nivel: 0 })
  try {
    const ajustes = estado.ajustes
    if (!ajustes) throw new Error('No hay ajustes de dictado.')
    const audio = await aMono16k(new Blob(g.trozos, { type: g.grabador.mimeType }))
    if (!hayVoz(audio)) {
      avisar('No se oyó nada. Revisa el micrófono y vuelve a intentarlo.', 'error')
      return
    }
    await prepararModelo(ajustes.modelo)
    const texto = await transcribir(audio, IDIOMA_WHISPER[ajustes.idioma])
    if (texto) g.alTexto(texto)
    else avisar('No entendí nada. Habla un poco más cerca del micrófono.', 'error')
  } catch (err) {
    avisar(`No se pudo transcribir: ${explicarError(err)}`, 'error')
  } finally {
    cambiar({ fase: 'libre', dueno: null, nivel: 0 })
  }
}

/** Los errores de transformers.js, en cristiano. */
export function explicarError(err: unknown): string {
  const m = (err as Error)?.message ?? String(err)
  if (/Service unavailable|Failed to fetch|NetworkError|ERR_INTERNET|ERR_NAME|ERR_CONNECTION|\b503\b/i.test(m)) {
    return 'no hay conexión con Hugging Face. Revisa internet y vuelve a intentarlo.'
  }
  if (/Forbidden|Unauthorized|\b40[13]\b/i.test(m)) return 'Hugging Face rechazó la descarga. Vuelve a intentarlo más tarde.'
  if (/memory|Out of memory|RangeError: Array buffer allocation/i.test(m)) return 'no hay memoria suficiente. Prueba con Whisper base.'
  return m
}

/** Junta lo dictado con lo que ya había escrito. */
export function juntarTexto(actual: string, dictado: string): string {
  if (!actual.trim()) return dictado
  return /\s$/.test(actual) ? `${actual}${dictado}` : `${actual} ${dictado}`
}
