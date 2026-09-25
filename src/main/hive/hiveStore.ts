import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  renameSync,
  statSync
} from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import simpleGit, { type SimpleGit } from 'simple-git'
import type { AgentDefinition, HiveMessage } from '../../shared/types'

// Un archivo que aun no es JSON valido puede estar a medio escribir; solo se
// descarta si sigue roto despues de este tiempo.
const MS_GRACIA_ARCHIVO_ROTO = 5000

export interface PendienteDeEnvio {
  archivo: string
  mensaje: HiveMessage
}

/**
 * El "hive" es un directorio local respaldado por git con la memoria y los
 * buzones de cada agente. Solo minioffice hace commits (single committer),
 * asi el historial nunca queda a medias aunque varios agentes escriban a la vez.
 */
export class HiveStore {
  readonly raiz: string
  private git: SimpleGit
  private idsValidos = new Set<string>()

  constructor(raizProyecto: string) {
    this.raiz = join(raizProyecto, '.hive')
    mkdirSync(this.raiz, { recursive: true })
    this.git = simpleGit(this.raiz)
  }

  private rutaAgente(agentId: string): string {
    return join(this.raiz, 'agentes', agentId)
  }

  private rutaEntrada(agentId: string): string {
    return join(this.rutaAgente(agentId), 'buzon', 'entrada')
  }

  private rutaSalida(agentId: string): string {
    return join(this.rutaAgente(agentId), 'buzon', 'salida')
  }

  private rutaRechazados(agentId: string): string {
    return join(this.rutaAgente(agentId), 'buzon', 'rechazados')
  }

  async inicializar(agentes: AgentDefinition[]): Promise<void> {
    this.idsValidos = new Set(agentes.map((a) => a.id))

    for (const agente of agentes) {
      mkdirSync(this.rutaEntrada(agente.id), { recursive: true })
      mkdirSync(this.rutaSalida(agente.id), { recursive: true })
      const memoria = join(this.rutaAgente(agente.id), 'memoria.md')
      if (!existsSync(memoria)) {
        writeFileSync(memoria, `# Memoria de ${agente.nombre}\n\n`, 'utf-8')
      }
    }

    const pizarra = join(this.raiz, 'pizarra.md')
    if (!existsSync(pizarra)) {
      writeFileSync(pizarra, '# Pizarra compartida\n\nNotas visibles para todo el equipo.\n', 'utf-8')
    }

    try {
      if (!existsSync(join(this.raiz, '.git'))) {
        await this.git.init()
        await this.git.addConfig('user.name', 'minioffice')
        await this.git.addConfig('user.email', 'minioffice@localhost')
      }
      await this.commit('Inicializar hive')
    } catch (err) {
      // Sin git la oficina funciona igual; solo se pierde el historial del hive.
      console.error('No se pudo inicializar git en el hive (esta instalado git?):', err)
    }
  }

  async commit(mensaje: string): Promise<void> {
    try {
      await this.git.add('.')
      const estado = await this.git.status()
      if (estado.staged.length > 0) await this.git.commit(mensaje)
    } catch (err) {
      console.error('No se pudo hacer commit en el hive:', err)
    }
  }

  /** Deja un mensaje en la bandeja de salida del remitente; el router lo entrega. */
  depositarSaliente(msg: Omit<HiveMessage, 'id' | 'creadoEn'>): HiveMessage {
    const completo: HiveMessage = { ...msg, id: randomUUID(), creadoEn: Date.now() }
    const dir = this.rutaSalida(msg.de)
    mkdirSync(dir, { recursive: true })
    // Escritura atomica: el router nunca ve un archivo a medias.
    const temporal = join(dir, `.${completo.id}.tmp`)
    writeFileSync(temporal, JSON.stringify(completo, null, 2))
    renameSync(temporal, join(dir, `${completo.id}.json`))
    return completo
  }

  /**
   * Lee la bandeja de salida de un agente. Los archivos los escriben los propios
   * agentes, asi que se validan aqui: el remitente siempre es el dueno de la carpeta.
   */
  listarPendientesDeEnvio(agentId: string): PendienteDeEnvio[] {
    const dir = this.rutaSalida(agentId)
    if (!existsSync(dir)) return []

    const pendientes: PendienteDeEnvio[] = []
    for (const archivo of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const ruta = join(dir, archivo)
      let crudo: Partial<HiveMessage>
      try {
        crudo = JSON.parse(readFileSync(ruta, 'utf-8'))
      } catch {
        if (Date.now() - statSync(ruta).mtimeMs > MS_GRACIA_ARCHIVO_ROTO) this.rechazar(agentId, archivo)
        continue
      }

      const para = typeof crudo.para === 'string' ? crudo.para.trim().toLowerCase() : ''
      const cuerpo = typeof crudo.cuerpo === 'string' ? crudo.cuerpo.trim() : ''
      if (!this.idsValidos.has(para) || para === agentId || !cuerpo) {
        this.rechazar(agentId, archivo)
        continue
      }

      // El id se usa como nombre de archivo: nunca se toma del agente.
      pendientes.push({
        archivo,
        mensaje: { id: randomUUID(), de: agentId, para, cuerpo, creadoEn: Date.now() }
      })
    }
    return pendientes
  }

  entregar(pendiente: PendienteDeEnvio): void {
    const { mensaje } = pendiente
    mkdirSync(this.rutaEntrada(mensaje.para), { recursive: true })
    writeFileSync(join(this.rutaEntrada(mensaje.para), `${mensaje.id}.json`), JSON.stringify(mensaje, null, 2))
    const origen = join(this.rutaSalida(mensaje.de), pendiente.archivo)
    if (existsSync(origen)) {
      // Se conserva una copia en "enviados" para que el remitente tenga historial.
      const enviados = join(this.rutaAgente(mensaje.de), 'buzon', 'enviados')
      mkdirSync(enviados, { recursive: true })
      renameSync(origen, join(enviados, `${mensaje.id}.json`))
    }
  }

  private rechazar(agentId: string, archivo: string): void {
    mkdirSync(this.rutaRechazados(agentId), { recursive: true })
    renameSync(join(this.rutaSalida(agentId), archivo), join(this.rutaRechazados(agentId), archivo))
    console.warn(`Mensaje invalido de ${agentId} movido a rechazados: ${archivo}`)
  }

  /** Todos los mensajes entregados, de todos los buzones, en orden cronologico. */
  historialCompleto(): HiveMessage[] {
    const todos: HiveMessage[] = []
    for (const id of this.idsValidos) {
      const dir = this.rutaEntrada(id)
      if (!existsSync(dir)) continue
      for (const archivo of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        try {
          todos.push(JSON.parse(readFileSync(join(dir, archivo), 'utf-8')) as HiveMessage)
        } catch {
          // Las entradas las escribe solo minioffice; si alguien las rompio a mano, se ignoran.
        }
      }
    }
    return todos.sort((a, b) => a.creadoEn - b.creadoEn)
  }

  agregarMemoria(agentId: string, texto: string): void {
    const ruta = join(this.rutaAgente(agentId), 'memoria.md')
    const previo = existsSync(ruta) ? readFileSync(ruta, 'utf-8') : ''
    writeFileSync(ruta, `${previo}- ${new Date().toISOString()}: ${texto}\n`, 'utf-8')
  }
}
