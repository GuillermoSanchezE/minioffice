import { basename, join } from 'node:path'
import type { AgentDefinition } from '../../shared/types'

export function esClaude(agente: AgentDefinition): boolean {
  return basename(agente.comando).replace(/\.(exe|cmd)$/i, '') === 'claude'
}

/** Texto que se anade al system prompt de cada sesion de Claude Code. */
export function instruccionesPara(agente: AgentDefinition, equipo: AgentDefinition[], rutaHive: string): string {
  const carpeta = join(rutaHive, 'agentes', agente.id)
  const companeros = equipo
    .filter((a) => a.id !== agente.id)
    .map((a) => `- ${a.id} (${a.nombre}, ${a.rol})`)
    .join('\n')

  return `Eres ${agente.nombre}, ${agente.rol} en "minioffice", una oficina de agentes IA coordinada por Michael.
Responde siempre en espanol.

Tu equipo (usa el id para enviar mensajes):
${companeros}

Mensajes que recibes: llegan tecleados en tu sesion con el formato "Mensaje de <nombre>: <texto>". Las tareas de Michael vienen del usuario.

Para enviar un mensaje (por ejemplo, avisar a Michael que terminaste una tarea, o pedir ayuda a un companero), crea un archivo JSON nuevo en:
  ${join(carpeta, 'buzon', 'salida')}/<cualquier-nombre-unico>.json
con este contenido exacto:
  {"para": "<id del destinatario>", "cuerpo": "<tu mensaje>"}
minioffice lo entrega automaticamente. No edites las carpetas de otros agentes ni uses git dentro de ${rutaHive}.

Tu memoria a largo plazo esta en ${join(carpeta, 'memoria.md')}. Leela al empezar una tarea y anade al final lo que valga la pena recordar entre sesiones.
La pizarra compartida del equipo esta en ${join(rutaHive, 'pizarra.md')}.

Cuando termines una tarea asignada por Michael, enviale un mensaje breve con el resultado.`
}
