import { execFile } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import type { AgentDefinition } from '../shared/types'
import type { Capacidad, CatalogoItem } from '../shared/acciones'
import { PROVEEDORES } from '../shared/motores'

const REPO_SKILLS = 'https://github.com/anthropics/skills.git'
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
 * Catalogo curado. Las skills salen del repositorio publico de Anthropic; los
 * MCP se registran con `claude mcp add`; los motores son CLIs de npm.
 */
const CATALOGO: Entrada[] = [
  { tipo: 'skill', nombre: 'skill-creator', categoria: 'La oficina misma', autor: 'Anthropic', descripcion: 'Crea una skill nueva contigo, una pregunta a la vez.' },
  { tipo: 'skill', nombre: 'claude-api', categoria: 'Código e ingeniería', autor: 'Anthropic', descripcion: 'Guía oficial para programar con la API de Claude: modelos, herramientas, caché.' },
  { tipo: 'skill', nombre: 'mcp-builder', categoria: 'Código e ingeniería', autor: 'Anthropic', descripcion: 'Te acompaña a escribir tu propio servidor MCP.' },
  { tipo: 'skill', nombre: 'web-artifacts-builder', categoria: 'Código e ingeniería', autor: 'Anthropic', descripcion: 'Arma páginas HTML completas con React y Tailwind.' },
  { tipo: 'skill', nombre: 'webapp-testing', categoria: 'Código e ingeniería', autor: 'Anthropic', descripcion: 'Maneja un navegador real con Playwright para probar una web.' },
  { tipo: 'skill', nombre: 'frontend-design', categoria: 'Diseño', autor: 'Anthropic', descripcion: 'Diseño visual con intención: tipografía, dirección estética, nada genérico.' },
  { tipo: 'skill', nombre: 'canvas-design', categoria: 'Diseño', autor: 'Anthropic', descripcion: 'Pósters y piezas visuales en PNG o PDF.' },
  { tipo: 'skill', nombre: 'theme-factory', categoria: 'Diseño', autor: 'Anthropic', descripcion: 'Aplica temas de color y tipografía a documentos, slides o páginas.' },
  { tipo: 'skill', nombre: 'algorithmic-art', categoria: 'Diseño', autor: 'Anthropic', descripcion: 'Arte generativo con p5.js.' },
  { tipo: 'skill', nombre: 'slack-gif-creator', categoria: 'Diseño', autor: 'Anthropic', descripcion: 'GIFs animados listos para Slack.' },
  { tipo: 'skill', nombre: 'docx', categoria: 'Documentos y escritura', autor: 'Anthropic', descripcion: 'Crea, lee y edita documentos de Word.' },
  { tipo: 'skill', nombre: 'pdf', categoria: 'Documentos y escritura', autor: 'Anthropic', descripcion: 'Extrae, une, divide, rellena y crea PDFs.' },
  { tipo: 'skill', nombre: 'pptx', categoria: 'Documentos y escritura', autor: 'Anthropic', descripcion: 'Presentaciones de PowerPoint: crear, leer y editar.' },
  { tipo: 'skill', nombre: 'xlsx', categoria: 'Documentos y escritura', autor: 'Anthropic', descripcion: 'Hojas de cálculo con fórmulas, formato y gráficos.' },
  { tipo: 'skill', nombre: 'doc-coauthoring', categoria: 'Documentos y escritura', autor: 'Anthropic', descripcion: 'Escribe propuestas y especificaciones contigo, paso a paso.' },
  { tipo: 'skill', nombre: 'internal-comms', categoria: 'Documentos y escritura', autor: 'Anthropic', descripcion: 'Reportes de estado, actualizaciones y comunicados internos.' },
  { tipo: 'mcp', nombre: 'playwright', categoria: 'Navegador', autor: 'Microsoft', descripcion: 'Controla un navegador: navegar, hacer clic, capturar.', mcp: ['playwright', '--', 'npx', '-y', '@playwright/mcp@latest'] },
  { tipo: 'mcp', nombre: 'chrome-devtools', categoria: 'Navegador', autor: 'Google', descripcion: 'DevTools de Chrome: consola, red y rendimiento.', mcp: ['chrome-devtools', '--', 'npx', '-y', 'chrome-devtools-mcp@latest'] },
  { tipo: 'mcp', nombre: 'context7', categoria: 'Documentación', autor: 'Upstash', descripcion: 'Documentación al día de miles de librerías.', mcp: ['--transport', 'http', 'context7', 'https://mcp.context7.com/mcp'] },
  { tipo: 'mcp', nombre: 'memory', categoria: 'Memoria', autor: 'Model Context Protocol', descripcion: 'Grafo de conocimiento persistente entre sesiones.', mcp: ['memory', '--', 'npx', '-y', '@modelcontextprotocol/server-memory'] },
  { tipo: 'mcp', nombre: 'sequential-thinking', categoria: 'Razonamiento', autor: 'Model Context Protocol', descripcion: 'Piensa problemas largos paso a paso.', mcp: ['sequential-thinking', '--', 'npx', '-y', '@modelcontextprotocol/server-sequential-thinking'] },
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
  if (e.tipo === 'skill') return `git clone --depth 1 ${REPO_SKILLS} && cp -r skills/skills/${e.nombre} ~/.claude/skills/`
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
      if (e.tipo === 'skill') return await this.instalarSkill(e.nombre)
      if (e.tipo === 'mcp') return await ejecutar('claude', ['mcp', 'add', '--scope', 'user', ...(e.mcp ?? [])])
      return await ejecutar('npm', ['install', '-g', e.npm ?? e.nombre])
    } catch (err) {
      throw new Error(`No se pudo instalar ${e.nombre}: ${(err as Error).message}\nHazlo a mano con:\n${comandoDe(e)}`)
    }
  }

  private async instalarSkill(nombre: string): Promise<string> {
    const destino = join(this.carpetaSkills(), nombre)
    if (existsSync(destino)) return `${nombre} ya estaba en ${destino}`
    const temporal = mkdtempSync(join(tmpdir(), 'minioffice-skill-'))
    try {
      await ejecutar('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', REPO_SKILLS, 'repo'], temporal)
      const repo = join(temporal, 'repo')
      await ejecutar('git', ['sparse-checkout', 'set', `skills/${nombre}`], repo)
      const origen = join(repo, 'skills', nombre)
      if (!existsSync(join(origen, 'SKILL.md'))) throw new Error('El repositorio no tiene esa skill.')
      cpSync(origen, destino, { recursive: true })
      return `${nombre} instalada en ${destino}. Los agentes la ven al iniciar su próxima sesión.`
    } finally {
      rmSync(temporal, { recursive: true, force: true })
    }
  }
}
