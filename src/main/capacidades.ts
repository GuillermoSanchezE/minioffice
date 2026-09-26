import { execFile } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import type { AgentDefinition, ProveedorId } from '../shared/types'
import type { Capacidad, CatalogoItem } from '../shared/acciones'
import { PROVEEDORES } from '../shared/motores'

const TIEMPO_INSTALAR_MS = 5 * 60_000

interface Entrada {
  tipo: CatalogoItem['tipo']
  nombre: string
  descripcion: string
  autor: string
  categoria: string
  /** Argumentos para `claude mcp add` (solo MCP). */
  mcp?: string[]
  /** Paquete npm global (solo motores). */
  npm?: string
}

/**
 * Versiones fijadas de los MCP que se ejecutan con npx (antes @latest: una versión
 * nueva y maliciosa se habría instalado sola). Súbelas a mano tras revisarlas.
 *
 * Catalogo curado de MCP (se registran con `claude mcp add`) y motores (CLIs
 * de npm). Las skills tienen su propio catalogo en shared/skills.ts y se
 * asignan por agente desde la biblioteca de minioffice.
 */
const CATALOGO: Entrada[] = [
  { tipo: 'mcp', nombre: 'playwright', categoria: 'Navegador', autor: 'Microsoft', descripcion: 'Controla un navegador: navegar, hacer clic, capturar.', mcp: ['playwright', '--', 'npx', '-y', '@playwright/mcp@0.0.82'] },
  { tipo: 'mcp', nombre: 'chrome-devtools', categoria: 'Navegador', autor: 'Google', descripcion: 'DevTools de Chrome: consola, red y rendimiento.', mcp: ['chrome-devtools', '--', 'npx', '-y', 'chrome-devtools-mcp@1.10.1'] },
  { tipo: 'mcp', nombre: 'context7', categoria: 'Documentación', autor: 'Upstash', descripcion: 'Documentación al día de miles de librerías.', mcp: ['--transport', 'http', 'context7', 'https://mcp.context7.com/mcp'] },
  { tipo: 'mcp', nombre: 'memory', categoria: 'Memoria', autor: 'Model Context Protocol', descripcion: 'Grafo de conocimiento persistente entre sesiones.', mcp: ['memory', '--', 'npx', '-y', '@modelcontextprotocol/server-memory@2026.8.31'] },
  { tipo: 'mcp', nombre: 'sequential-thinking', categoria: 'Razonamiento', autor: 'Model Context Protocol', descripcion: 'Piensa problemas largos paso a paso.', mcp: ['sequential-thinking', '--', 'npx', '-y', '@modelcontextprotocol/server-sequential-thinking@2026.8.31'] },
  { tipo: 'mcp', nombre: 'notion', categoria: 'Conexiones', autor: 'Notion', descripcion: 'Lee y escribe páginas de Notion (te pide iniciar sesión).', mcp: ['--transport', 'http', 'notion', 'https://mcp.notion.com/mcp'] },
  { tipo: 'mcp', nombre: 'sentry', categoria: 'Conexiones', autor: 'Sentry', descripcion: 'Errores y trazas de Sentry (te pide iniciar sesión).', mcp: ['--transport', 'http', 'sentry', 'https://mcp.sentry.dev/mcp'] },
  ...PROVEEDORES.filter((p) => p.instalar).map(
    (p): Entrada => ({
      tipo: 'motor',
      nombre: p.binario,
      categoria: 'Motores',
      autor: p.nombre,
      descripcion: `${p.nombre} como motor de agentes.`,
      npm: p.instalar
    })
  )
]

function comandoDe(e: Entrada): string {
  if (e.tipo === 'mcp') return `claude mcp add --scope user ${(e.mcp ?? []).join(' ')}`
  return `npm install -g ${e.npm}`
}

/** Lee `name` y `description` del frontmatter de un SKILL.md (acepta bloques > y |). */
export function leerFrontmatter(texto: string): { name?: string; description?: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto)
  if (!m) return {}
  const lineas = m[1].split(/\r?\n/)
  const datos: Record<string, string> = {}
  for (let i = 0; i < lineas.length; i++) {
    const campo = /^([a-zA-Z_-]+):\s*(.*)$/.exec(lineas[i])
    if (!campo) continue
    let valor = campo[2].trim()
    if (/^[>|][+-]?$/.test(valor)) {
      const partes: string[] = []
      while (i + 1 < lineas.length && /^\s+\S/.test(lineas[i + 1])) partes.push(lineas[++i].trim())
      valor = partes.join(' ')
    }
    datos[campo[1]] = valor.replace(/^["']|["']$/g, '')
  }
  return { name: datos['name'], description: datos['description'] }
}

function leerJson(ruta: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function skillsEn(carpeta: string): Array<{ nombre: string; descripcion: string }> {
  if (!existsSync(carpeta)) return []
  const lista: Array<{ nombre: string; descripcion: string }> = []
  for (const dir of readdirSync(carpeta)) {
    const archivo = join(carpeta, dir, 'SKILL.md')
    if (!existsSync(archivo)) continue
    try {
      const fm = leerFrontmatter(readFileSync(archivo, 'utf8'))
      lista.push({ nombre: fm.name ?? dir, descripcion: fm.description ?? '' })
    } catch {
      // skill ilegible: se ignora
    }
  }
  return lista
}

/** Qué motores tienen su CLI instalada en esta máquina. */
export function motoresInstalados(): ProveedorId[] {
  return PROVEEDORES.filter((p) => p.binario && enPath(p.binario)).map((p) => p.id)
}

function enPath(binario: string): boolean {
  const extensiones = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', ''] : ['']
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    for (const ext of extensiones) {
      const ruta = join(dir, binario + ext)
      try {
        if (existsSync(ruta) && statSync(ruta).isFile()) return true
      } catch {
        // carpeta del PATH inaccesible
      }
    }
  }
  return false
}

function ejecutar(binario: string, args: string[], cwd?: string): Promise<string> {
  const archivo = process.platform === 'win32' && (binario === 'npm' || binario === 'claude') ? `${binario}.cmd` : binario
  return new Promise((resolver, rechazar) => {
    execFile(archivo, args, { cwd, timeout: TIEMPO_INSTALAR_MS, maxBuffer: 4 * 1024 * 1024, shell: process.platform === 'win32' }, (err, stdout, stderr) => {
      if (err) rechazar(new Error(`${stderr || stdout || err.message}`.trim().slice(-600)))
      else resolver(`${stdout}${stderr}`.trim())
    })
  })
}

/** Lo que cada agente puede usar: skills, servidores MCP y motores instalados. */
export class Capacidades {
  constructor(private equipo: () => AgentDefinition[]) {}

  private carpetaSkills(): string {
    return join(process.env['CLAUDE_CONFIG_DIR'] ?? join(homedir(), '.claude'), 'skills')
  }

  listar(): Capacidad[] {
    const agentes = this.equipo()
    const conClaude = agentes.filter((a) => a.proveedor === 'claude').map((a) => a.id)
    const lista: Capacidad[] = []
    const agregar = (c: Omit<Capacidad, 'instalada'>): void => {
      const previa = lista.find((x) => x.tipo === c.tipo && x.nombre === c.nombre)
      if (previa) previa.agentes = [...new Set([...previa.agentes, ...c.agentes])]
      else lista.push({ ...c, instalada: true })
    }

    for (const s of skillsEn(this.carpetaSkills())) {
      agregar({ tipo: 'skill', nombre: s.nombre, descripcion: s.descripcion, origen: 'tuyas (~/.claude/skills)', agentes: conClaude })
    }
    const carpetas = [...new Set(agentes.map((a) => a.cwd))]
    for (const cwd of carpetas) {
      const deAqui = agentes.filter((a) => a.cwd === cwd && a.proveedor === 'claude').map((a) => a.id)
      for (const s of skillsEn(join(cwd, '.claude', 'skills'))) {
        agregar({ tipo: 'skill', nombre: s.nombre, descripcion: s.descripcion, origen: `proyecto (${cwd})`, agentes: deAqui })
      }
      const mcpProyecto = leerJson(join(cwd, '.mcp.json'))?.['mcpServers']
      if (mcpProyecto && typeof mcpProyecto === 'object') {
        for (const nombre of Object.keys(mcpProyecto)) {
          agregar({ tipo: 'mcp', nombre, descripcion: 'Servidor MCP del proyecto', origen: `.mcp.json (${cwd})`, agentes: deAqui })
        }
      }
    }

    const config = leerJson(join(homedir(), '.claude.json'))
    const mcpUsuario = config?.['mcpServers']
    if (mcpUsuario && typeof mcpUsuario === 'object') {
      for (const nombre of Object.keys(mcpUsuario)) {
        agregar({ tipo: 'mcp', nombre, descripcion: 'Servidor MCP de tu usuario', origen: '~/.claude.json', agentes: conClaude })
      }
    }
    const proyectos = config?.['projects']
    if (proyectos && typeof proyectos === 'object') {
      for (const cwd of carpetas) {
        const mcpLocal = (proyectos as Record<string, { mcpServers?: Record<string, unknown> }>)[cwd]?.mcpServers
        if (!mcpLocal) continue
        const deAqui = agentes.filter((a) => a.cwd === cwd && a.proveedor === 'claude').map((a) => a.id)
        for (const nombre of Object.keys(mcpLocal)) {
          agregar({ tipo: 'mcp', nombre, descripcion: 'Servidor MCP local del proyecto', origen: `local (${cwd})`, agentes: deAqui })
        }
      }
    }

    for (const p of PROVEEDORES) {
      if (p.id === 'personalizado' || !enPath(p.binario)) continue
      agregar({
        tipo: 'motor',
        nombre: p.binario,
        descripcion: p.nombre,
        origen: 'PATH',
        agentes: agentes.filter((a) => a.proveedor === p.id).map((a) => a.id)
      })
    }
    return lista
  }

  catalogo(): CatalogoItem[] {
    const instaladas = this.listar()
    return CATALOGO.map((e) => ({
      tipo: e.tipo,
      nombre: e.nombre,
      descripcion: e.descripcion,
      autor: e.autor,
      categoria: e.categoria,
      instalada: instaladas.some((c) => c.tipo === e.tipo && c.nombre === e.nombre),
      comando: comandoDe(e)
    }))
  }

  /** Instala algo del catalogo (nunca un comando arbitrario). Si falla, el error trae el comando para hacerlo a mano. */
  async instalar(nombre: string, tipo: CatalogoItem['tipo']): Promise<string> {
    const e = CATALOGO.find((x) => x.nombre === nombre && x.tipo === tipo)
    if (!e) throw new Error('Eso no está en el catálogo.')
    try {
      if (e.tipo === 'mcp') return await ejecutar('claude', ['mcp', 'add', '--scope', 'user', ...(e.mcp ?? [])])
      return await ejecutar('npm', ['install', '-g', e.npm ?? e.nombre])
    } catch (err) {
      throw new Error(`No se pudo instalar ${e.nombre}: ${(err as Error).message}\nHazlo a mano con:\n${comandoDe(e)}`)
    }
  }
}
