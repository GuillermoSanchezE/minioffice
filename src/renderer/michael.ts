import type { AgentDefinition } from '../shared/types'

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Michael decide a quien va una tarea: si el texto empieza con "@nombre"
 * (o "@id") va a ese agente; si no, al elegido en el selector.
 */
export function resolverDestino(
  texto: string,
  trabajadores: AgentDefinition[],
  destinoPorDefecto: string
): { para: string; cuerpo: string } {
  const mencion = texto.match(/^@([^\s,:]+)[\s,:]*/)
  if (mencion) {
    const buscado = normalizar(mencion[1])
    const agente = trabajadores.find((a) => normalizar(a.id) === buscado || normalizar(a.nombre) === buscado)
    if (agente) return { para: agente.id, cuerpo: texto.slice(mencion[0].length).trim() }
  }
  return { para: destinoPorDefecto, cuerpo: texto }
}
