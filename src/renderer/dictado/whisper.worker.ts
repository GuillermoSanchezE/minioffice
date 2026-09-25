/**
 * Whisper dentro de la app (transformers.js + onnxruntime-web en WebAssembly),
 * en un worker para que la oficina no se congele mientras transcribe.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline, type ProgressInfo } from '@huggingface/transformers'
import { ESQUEMA_MODELOS, HOST_HF } from '../../shared/dictado'

export type PedidoWhisper =
  | { tipo: 'cargar'; repo: string; ort: string }
  | { tipo: 'transcribir'; id: number; audio: Float32Array; idioma?: string }

export type RespuestaWhisper =
  | { tipo: 'progreso'; cargado: number; total: number }
  | { tipo: 'cargado'; repo: string }
  | { tipo: 'texto'; id: number; texto: string }
  | { tipo: 'error'; id?: number; mensaje: string }

const ctx = self as unknown as {
  postMessage(m: RespuestaWhisper): void
  onmessage: ((e: MessageEvent<PedidoWhisper>) => void) | null
}

// Nada de cachés del navegador ni CDNs: los archivos los sirve el proceso
// principal por modelos://, que los guarda en disco la primera vez.
env.allowLocalModels = false
env.allowRemoteModels = true
env.useBrowserCache = false
env.useWasmCache = false
const fetchNormal = globalThis.fetch.bind(globalThis)
env.fetch = ((url: RequestInfo | URL, init?: RequestInit) => {
  const texto = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
  const destino = texto.startsWith(HOST_HF) ? `${ESQUEMA_MODELOS}://hf/${texto.slice(HOST_HF.length)}` : url
  return fetchNormal(destino, init)
}) as typeof fetch

let repoCargado = ''
let asr: AutomaticSpeechRecognitionPipeline | null = null
let cargando: Promise<AutomaticSpeechRecognitionPipeline> | null = null

async function cargar(repo: string, ort: string): Promise<AutomaticSpeechRecognitionPipeline> {
  if (asr && repoCargado === repo) return asr
  if (cargando && repoCargado === repo) return cargando
  const anterior = asr
  asr = null
  repoCargado = repo
  void anterior?.dispose()

  const wasm = env.backends.onnx.wasm
  if (wasm) {
    wasm.wasmPaths = {
      mjs: `${ort}ort-wasm-simd-threaded.asyncify.mjs`,
      wasm: `${ort}ort-wasm-simd-threaded.asyncify.wasm`
    }
    // onnxruntime solo usa varios hilos si la página está "aislada"; la app
    // activa SharedArrayBuffer sin eso, así que se los pedimos a mano.
    if (typeof SharedArrayBuffer !== 'undefined') {
      wasm.numThreads = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) - 1))
    }
  }

  const archivos = new Map<string, { cargado: number; total: number }>()
  let ultimoAviso = 0
  const progreso = (p: ProgressInfo): void => {
    if (p.status !== 'progress') return
    archivos.set(p.file, { cargado: p.loaded, total: p.total })
    const ahora = Date.now()
    if (ahora - ultimoAviso < 120 && p.loaded < p.total) return
    ultimoAviso = ahora
    let cargado = 0
    let total = 0
    for (const a of archivos.values()) {
      cargado += a.cargado
      total += a.total
    }
    ctx.postMessage({ tipo: 'progreso', cargado, total })
  }

  cargando = pipeline('automatic-speech-recognition', repo, {
    device: 'wasm',
    dtype: 'q8',
    progress_callback: progreso
  }) as Promise<AutomaticSpeechRecognitionPipeline>
  try {
    const listo = await cargando
    if (repoCargado === repo) asr = listo
    return listo
  } finally {
    cargando = null
  }
}

// Frases que Whisper "oye" en el silencio (las aprendió de subtítulos de YouTube).
const ALUCINACIONES = [
  /^subt[ií]tulos (realizados )?por la comunidad de amara\.org\.?$/i,
  /^¡?suscr[ií]bete[^a-z]*$/i,
  /^gracias por ver( el v[ií]deo)?\.?$/i,
  /^thanks? (you )?for watching[.!]?$/i,
  /^\.+$/
]

function limpiar(texto: string): string {
  const t = texto.replace(/\s+/g, ' ').trim()
  return ALUCINACIONES.some((r) => r.test(t)) ? '' : t
}

ctx.onmessage = async (e) => {
  const m = e.data
  if (m.tipo === 'cargar') {
    try {
      await cargar(m.repo, m.ort)
      ctx.postMessage({ tipo: 'cargado', repo: m.repo })
    } catch (err) {
      repoCargado = ''
      ctx.postMessage({ tipo: 'error', mensaje: (err as Error).message || String(err) })
    }
    return
  }
  try {
    if (!asr) throw new Error('El modelo de dictado todavía no está cargado.')
    const salida = await asr(m.audio, {
      language: m.idioma,
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5
    })
    const texto = (Array.isArray(salida) ? salida.map((s) => s.text).join(' ') : salida.text) ?? ''
    ctx.postMessage({ tipo: 'texto', id: m.id, texto: limpiar(texto) })
  } catch (err) {
    ctx.postMessage({ tipo: 'error', id: m.id, mensaje: (err as Error).message || String(err) })
  }
}
