import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentDefinition } from '../shared/types'
import type { SkillOficina } from '../shared/acciones'
import { CATALOGO_SKILLS, FUENTES, NOMBRE_SKILL_VALIDO, PUESTOS, skillDelCatalogo, type FuenteSkill } from '../shared/skills'
import { leerFrontmatter } from './capacidades'
import { carpetaNeutra } from './entorno'
import { escribirJson } from './archivos'
import { gitDisponible } from './requisitos'

const TIEMPO_GIT_MS = 4 * 60_000

function ejecutar(binario: string, args: string[], cwd?: string, entrada?: string): Promise<string> {
  const archivo = process.platform === 'win32' && binario === 'claude' ? 'claude.cmd' : binario
  return new Promise((resolver, rechazar) => {
    // En Windows, claude.cmd solo se puede lanzar a traves de la shell (los argumentos son fijos).
    const shell = process.platform === 'win32' && binario === 'claude'
    const hijo = execFile(archivo, args, { cwd, shell, timeout: TIEMPO_GIT_MS, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) rechazar(new Error(`${stderr || stdout || err.message}`.trim().slice(-500)))
      else resolver(stdout.trim())
    })
    if (entrada !== undefined) hijo.stdin?.end(entrada)
  })
}

function leerJson<T>(ruta: string, porDefecto: T): T {
  try {
    return JSON.parse(readFileSync(ruta, 'utf8')) as T
  } catch {
    return porDefecto
  }
}

/**
 * La biblioteca de skills de minioffice (~/.minioffice/skills/<fuente>/<nombre>).
 * A diferencia de ~/.claude/skills, que ven todos, estas se asignan por agente:
 * al iniciar su sesion se le arma un plugin propio con solo las suyas y se le
 * pasa a Claude Code con --plugin-dir.
 */
export class Biblioteca {
  readonly raiz: string
  private instalando = new Map<string, Promise<void>>()

  constructor(
    private equipo: () => AgentDefinition[],
    private raizProyecto: string,
    private aviso: (texto: string) => void
  ) {
    this.raiz = join(process.env['MINIOFFICE_HOME'] ?? join(homedir(), '.minioffice'))
  }

  private get carpetaSkills(): string {
    return join(this.raiz, 'skills')
  }

  private get archivoResumenes(): string {
    return join(this.raiz, 'resumenes.json')
  }

  private carpetaGlobal(): string {
    return join(process.env['CLAUDE_CONFIG_DIR'] ?? join(homedir(), '.claude'), 'skills')
  }

  /** Skills instaladas en la biblioteca: nombre → carpeta y fuente. */
  instaladas(): Map<string, { ruta: string; fuente: string; descripcion: string }> {
    const mapa = new Map<string, { ruta: string; fuente: string; descripcion: string }>()
    if (!existsSync(this.carpetaSkills)) return mapa
    for (const fuente of readdirSync(this.carpetaSkills)) {
      const dir = join(this.carpetaSkills, fuente)
      let hijos: string[] = []
      try {
        hijos = readdirSync(dir)
      } catch {
        continue
      }
      for (const nombre of hijos) {
        const archivo = join(dir, nombre, 'SKILL.md')
        if (!existsSync(archivo) || mapa.has(nombre)) continue
        const fm = leerFrontmatter(readFileSync(archivo, 'utf8'))
        mapa.set(nombre, { ruta: join(dir, nombre), fuente, descripcion: fm.description ?? '' })
      }
    }
    return mapa
  }

  private globales(): Array<{ nombre: string; descripcion: string }> {
    const dir = this.carpetaGlobal()
    if (!existsSync(dir)) return []
    const lista: Array<{ nombre: string; descripcion: string }> = []
    for (const nombre of readdirSync(dir)) {
      const archivo = join(dir, nombre, 'SKILL.md')
      if (!existsSync(archivo)) continue
      try {
        const fm = leerFrontmatter(readFileSync(archivo, 'utf8'))
        lista.push({ nombre: fm.name ?? nombre, descripcion: fm.description ?? '' })
      } catch {
        // skill ilegible
      }
    }
    return lista
  }

  private resumenes(): Record<string, string> {
    return leerJson<Record<string, string>>(this.archivoResumenes, {})
  }

  listar(): SkillOficina[] {
    const agentes = this.equipo()
    const instaladas = this.instaladas()
    const resumenes = this.resumenes()
    const asignadaA = (nombre: string): string[] => agentes.filter((a) => a.skills?.includes(nombre)).map((a) => a.id)
    const sugeridaPara = (nombre: string): string[] => agentes.filter((a) => PUESTOS[a.personaje]?.skills.includes(nombre)).map((a) => a.id)
    const lista: SkillOficina[] = CATALOGO_SKILLS.map((c) => ({
      nombre: c.nombre,
      fuente: c.fuente,
      area: c.area,
      resumen: c.resumen,
      descripcion: instaladas.get(c.nombre)?.descripcion ?? '',
      requiere: c.requiere,
      instalada: instaladas.has(c.nombre),
      global: false,
      agentes: asignadaA(c.nombre),
      sugeridaPara: sugeridaPara(c.nombre)
    }))
    for (const [nombre, info] of instaladas) {
      if (skillDelCatalogo(nombre)) continue
      lista.push({
        nombre,
        fuente: 'propia',
        area: 'Documentación y equipo',
        resumen: resumenes[nombre] ?? '',
        descripcion: info.descripcion,
        instalada: true,
        global: false,
        agentes: asignadaA(nombre),
        sugeridaPara: []
      })
    }
    for (const g of this.globales()) {
      if (lista.some((x) => x.nombre === g.nombre && x.instalada)) continue
      const catalogo = skillDelCatalogo(g.nombre)
      lista.push({
        nombre: g.nombre,
        fuente: 'global',
        area: catalogo?.area ?? 'Documentación y equipo',
        resumen: catalogo?.resumen ?? resumenes[g.nombre] ?? '',
        descripcion: g.descripcion,
        instalada: true,
        global: true,
        agentes: agentes.filter((a) => a.proveedor === 'claude').map((a) => a.id),
        sugeridaPara: sugeridaPara(g.nombre)
      })
    }
    return lista
  }

  /** Instala del catalogo las que falten; agrupa por repositorio para clonar una sola vez. */
  async instalar(nombres: string[]): Promise<string> {
    const instaladas = this.instaladas()
    const porFuente = new Map<FuenteSkill, string[]>()
    const desconocidas: string[] = []
    for (const nombre of new Set(nombres)) {
      if (instaladas.has(nombre)) continue
      const c = skillDelCatalogo(nombre)
      if (!c) {
        desconocidas.push(nombre)
        continue
      }
      porFuente.set(c.fuente, [...(porFuente.get(c.fuente) ?? []), nombre])
    }
    const hechas: string[] = []
    for (const [fuente, lista] of porFuente) {
      const clave = `${fuente}:${lista.join(',')}`
      const tarea = this.instalando.get(clave) ?? this.clonarYCopiar(fuente, lista)
      this.instalando.set(clave, tarea)
      try {
        await tarea
        hechas.push(...lista)
      } finally {
        this.instalando.delete(clave)
      }
    }
    const partes = []
    if (hechas.length) partes.push(`Instaladas: ${hechas.join(', ')}.`)
    if (desconocidas.length) partes.push(`No están en el catálogo: ${desconocidas.join(', ')}.`)
    return partes.join(' ') || 'Ya estaban instaladas.'
  }

  private async clonarYCopiar(fuente: FuenteSkill, nombres: string[]): Promise<void> {
    const f = FUENTES[fuente]
    if (!gitDisponible()) throw new Error('Para descargar skills hace falta git: instala las herramientas de desarrollo de Apple («xcode-select --install»).')
    const temporal = mkdtempSync(join(tmpdir(), 'minioffice-skills-'))
    try {
      // Solo el commit fijado y solo las carpetas de esas skills.
      const repo = join(temporal, 'repo')
      await ejecutar('git', ['init', '-q', repo], temporal)
      await ejecutar('git', ['remote', 'add', 'origin', f.repo], repo)
      await ejecutar('git', ['sparse-checkout', 'set', ...nombres.map((n) => `${f.carpeta}/${n}`)], repo)
      await ejecutar('git', ['fetch', '--depth', '1', '--filter=blob:none', 'origin', f.commit], repo)
      await ejecutar('git', ['checkout', '-q', 'FETCH_HEAD'], repo)
      for (const nombre of nombres) {
        const origen = join(repo, f.carpeta, nombre)
        if (!existsSync(join(origen, 'SKILL.md'))) throw new Error(`${f.nombre} ya no tiene la skill ${nombre}.`)
        const destino = join(this.carpetaSkills, fuente, nombre)
        rmSync(destino, { recursive: true, force: true })
        mkdirSync(join(this.carpetaSkills, fuente), { recursive: true })
        cpSync(origen, destino, { recursive: true })
      }
    } catch (err) {
      throw new Error(`No se pudo descargar de ${f.nombre}: ${(err as Error).message}\nA mano: git clone ${f.repo}, git checkout ${f.commit} y copia ${f.carpeta}/<skill> a ${join(this.carpetaSkills, fuente)}/`)
    } finally {
      rmSync(temporal, { recursive: true, force: true })
    }
  }

  desinstalar(nombre: string): void {
    const info = this.instaladas().get(nombre)
    if (!info) throw new Error('Esa skill no está en la biblioteca de minioffice.')
    rmSync(info.ruta, { recursive: true, force: true })
  }

  /** Instala las asignadas que falten sin cortar el arranque si no hay red. */
  async asegurar(nombres: string[] | undefined): Promise<void> {
    if (!nombres?.length) return
    const instaladas = this.instaladas()
    const faltan = nombres.filter((n) => !instaladas.has(n) && skillDelCatalogo(n))
    if (!faltan.length) return
    try {
      this.aviso(`Instalando skills: ${faltan.join(', ')}`)
      await this.instalar(faltan)
    } catch (err) {
      this.aviso((err as Error).message.split('\n')[0])
    }
  }

  /**
   * Arma el plugin con las skills del agente y devuelve su carpeta. Se usa
   * .claude/skills/ dentro del plugin porque algunas skills (UI/UX Pro Max)
   * buscan sus scripts ahi a traves de ${CLAUDE_PLUGIN_ROOT}.
   */
  prepararPlugin(agente: AgentDefinition): { ruta: string; cargadas: string[]; faltan: string[] } | null {
    if (!agente.skills?.length) return null
    const proyecto = createHash('sha1').update(this.raizProyecto).digest('hex').slice(0, 8)
    const ruta = join(this.raiz, 'sesiones', `${proyecto}-${agente.id}`)
    rmSync(ruta, { recursive: true, force: true })
    mkdirSync(join(ruta, '.claude-plugin'), { recursive: true })
    writeFileSync(
      join(ruta, '.claude-plugin', 'plugin.json'),
      `${JSON.stringify(
        {
          name: 'oficina',
          version: '1.0.0',
          description: `Skills que minioffice le asignó a ${agente.nombre}`,
          author: { name: 'minioffice' },
          skills: './.claude/skills/'
        },
        null,
        2
      )}\n`
    )
    const instaladas = this.instaladas()
    const cargadas: string[] = []
    const faltan: string[] = []
    for (const nombre of agente.skills) {
      const info = instaladas.get(nombre)
      if (!info || !NOMBRE_SKILL_VALIDO.test(nombre)) {
        faltan.push(nombre)
        continue
      }
      cpSync(info.ruta, join(ruta, '.claude', 'skills', nombre), { recursive: true })
      cargadas.push(nombre)
    }
    return cargadas.length ? { ruta, cargadas, faltan } : { ruta: '', cargadas, faltan }
  }

  /** Resumen en espanol de una skill que no esta en el catalogo, hecho por Claude Code y guardado. */
  async explicar(nombre: string): Promise<string> {
    const resumenes = this.resumenes()
    if (resumenes[nombre]) return resumenes[nombre]
    const info = this.instaladas().get(nombre)
    const global = info ? undefined : this.globales().find((g) => g.nombre === nombre)
    const descripcion = info?.descripcion ?? global?.descripcion
    if (!descripcion) throw new Error('No encontré la descripción de esa skill.')
    const texto = await ejecutar(
      'claude',
      ['-p', '--model', 'claude-haiku-4-5', '--output-format', 'text'],
      carpetaNeutra(),
      `Explica en español, en una sola frase de máximo 30 palabras y sin comillas, para qué sirve esta skill de Claude Code y cuándo usarla. Nombre: ${nombre}. Descripción original: ${descripcion}`
    )
    const resumen = texto.replace(/\s+/g, ' ').trim().slice(0, 300)
    escribirJson(this.archivoResumenes, { ...resumenes, [nombre]: resumen })
    return resumen
  }
}
