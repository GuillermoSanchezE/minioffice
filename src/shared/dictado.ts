/** Dictado por voz: Whisper corre dentro de la app, sin enviar tu audio a ningún servicio. */

export type ModeloDictado = 'base' | 'small'
export type IdiomaDictado = 'es' | 'auto' | 'en'

export interface InfoModeloDictado {
  id: ModeloDictado
  nombre: string
  /** Repositorio en Hugging Face (formato ONNX para transformers.js). */
  repo: string
  /** Tamaño aproximado de la descarga, en MB. */
  megas: number
  descripcion: string
}

export const MODELOS_DICTADO: Record<ModeloDictado, InfoModeloDictado> = {
  small: {
    id: 'small',
    nombre: 'Whisper small',
    repo: 'onnx-community/whisper-small',
    megas: 250,
    descripcion: 'Recomendado: entiende bien el español y los términos técnicos. Tarda unos segundos por frase.'
  },
  base: {
    id: 'base',
    nombre: 'Whisper base',
    repo: 'onnx-community/whisper-base',
    megas: 80,
    descripcion: 'Más ligero y rápido, pero se equivoca más con nombres propios y jerga.'
  }
}

export const IDIOMAS_DICTADO: { id: IdiomaDictado; nombre: string }[] = [
  { id: 'es', nombre: 'Español' },
  { id: 'auto', nombre: 'Detectar solo' },
  { id: 'en', nombre: 'Inglés' }
]

/** Nombre del idioma tal como lo espera Whisper. */
export const IDIOMA_WHISPER: Record<IdiomaDictado, string | undefined> = {
  es: 'spanish',
  en: 'english',
  auto: undefined
}

export interface AjustesDictado {
  modelo: ModeloDictado
  idioma: IdiomaDictado
}

export interface EstadoDictado extends AjustesDictado {
  /** Bytes guardados de cada modelo (0 = sin descargar). */
  guardados: Record<ModeloDictado, number>
  /** Modelos que ya cargaron completos al menos una vez. */
  listos: ModeloDictado[]
  carpeta: string
}

export type PermisoMicrofono = 'concedido' | 'denegado' | 'restringido' | 'sin-preguntar'

/** Esquema propio con el que el renderer pide los modelos al proceso principal, que los guarda en disco. */
export const ESQUEMA_MODELOS = 'modelos'
export const HOST_HF = 'https://huggingface.co/'
