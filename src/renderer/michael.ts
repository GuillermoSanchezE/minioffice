import type { AgentDefinition } from '../shared/types'

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Michael decide a quién va una tarea: si el texto empieza con "@nombre"
 * (id, nombre de pila o nombre completo sin espacios) va a ese agente; si no,
 * al elegido en el selector.
 */
export function resolverDestino(
  texto: string,
  trabajadores: AgentDefinition[],
  destinoPorDefecto: string
): { para: string; cuerpo: string } {
  const mencion = texto.match(/^@([^\s,:]+)[\s,:]*/)
  if (mencion) {
    const buscado = normalizar(mencion[1])
    const agente = trabajadores.find((a) => {
      const nombre = normalizar(a.nombre)
      return (
        normalizar(a.id) === buscado || nombre.split(/\s+/)[0] === buscado || nombre.replace(/\s+/g, '') === buscado
      )
    })
    if (agente) return { para: agente.id, cuerpo: texto.slice(mencion[0].length).trim() }
  }
  return { para: destinoPorDefecto, cuerpo: texto }
}
