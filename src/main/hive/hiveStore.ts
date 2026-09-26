import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import simpleGit, { type SimpleGit } from 'simple-git'
import type { Ajustes, EventoActividad, HiveMessage, Pregunta, Tarea } from '../../shared/types'
import type { ResultadoMemoria } from '../../shared/acciones'
import { escribirAtomico } from '../archivos'
import { gitDisponible } from '../requisitos'
import type { AlmacenSecretos, ClavesProyecto } from '../secretos'

// Un archivo que aun no es JSON valido puede estar a medio escribir; solo se
// descarta si sigue roto despues de este tiempo.
const MS_GRACIA_ARCHIVO_ROTO = 5000
const MAX_ACTIVIDAD = 400
/** actividad.jsonl se recorta a sus últimas líneas cuando pasa de este tamaño. */
const MAX_BYTES_ACTIVIDAD = 1_000_000
const LINEAS_ACTIVIDAD_CONSERVADAS = 2000

export const USUARIO = 'usuario'

export interface PendienteDeEnvio {
  archivo: string
  mensaje: HiveMessage
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  modoPermisos: 'auto',
  comandos: [
    {
      id: 'estado',
      nombre: 'Pedir estado a todos',
      para: 'todos',
      texto: '¿En qué estás ahora? Responde a Michael en una o dos líneas: trabajo actual, siguiente paso o si estás bloqueado.'
    },
    { id: 'compactar', nombre: 'Compactar contexto', para: 'todos', texto: '/compact' },
    {
      id: 'memoria',
      nombre: 'Guardar aprendizajes',
      para: 'todos',
      texto: 'Antes de seguir, anota en tu memoria.md lo más importante que aprendiste hoy (decisiones, rutas, comandos útiles).'
    }
  ],
  michaelAlIniciar: true,
  verNombres: true,
  paseos: true,
  horarios: [
    {
      id: 'reunion-hora',
      nombre: 'Reunión de estado cada hora',
      cadaMinutos: 60,
      para: 'michael',
      prompt:
        'Reunión de estado: revisa a cada agente (quién hace qué y si alguno está atascado o inactivo) y el tablero de tareas. Reasigna lo bloqueado y resume en una línea por agente.',
      activo: false
    },
    {
      id: 'latido',
      nombre: 'Latido de la oficina',
      cadaMinutos: 30,
      para: 'michael',
      prompt:
        'Latido: el equipo lleva un rato en silencio. Revisa tu bandeja, vuelve a poner en marcha a quien esté bloqueado y mantén el tablero al día; si el trabajo está hecho, descansa.',
      activo: false
    }
  ],
  compactarAuto: false,
  compactarUmbral: 80,
  webhooks: false,
  webhookPuerto: 4717,
  webhookClave: '',
  webhookRed: false,
  companeros: [],
  maxTemporales: 4,
  enfoque: 'Esta oficina desarrolla software y páginas web.',
  motores: []
}

function leerJson<T>(ruta: string): T | null {
  try {
    return JSON.parse(readFileSync(ruta, 'utf-8')) as T
  } catch {
    return null
  }
}

/** Clave nueva para el webhook (144 bits). */
export function nuevaClaveWebhook(): string {
  return randomBytes(18).toString('base64url')
}

/** Sin almacén de claves (pruebas): quedan en memoria mientras dura el proceso. */
class ClavesEnMemoria implements AlmacenSecretos {
  private claves: ClavesProyecto = { companeros: {} }
  leer(): ClavesProyecto {
    return { webhookClave: this.claves.webhookClave, companeros: { ...this.claves.companeros } }
  }
  guardar(claves: ClavesProyecto): void {
    this.claves = { webhookClave: claves.webhookClave, companeros: { ...claves.companeros } }
  }
}

/** Lo leído de un archivo del hive, para no volver a leerlo si no cambió. */
interface EnCache<T> {
  mtime: number
  tamano: number
  dato: T | null
}

/**
 * El "hive" es un directorio local respaldado por git con la memoria, los
 * buzones, las tareas y las preguntas del equipo. Solo minioffice hace commits
 * (single committer), asi el historial nunca queda a medias aunque varios
 * agentes escriban a la vez.
 */
export class HiveStore {
  readonly raiz: string
  private git: SimpleGit
  private idsValidos = new Set<string>()
  private commitProgramado: NodeJS.Timeout | null = null
  private mensajesPendientesDeCommit: string[] = []
  private cache = new Map<string, EnCache<unknown>>()

  /**
   * El hive guarda la clave del webhook, capturas y memorias: que no termine en
   * un commit del proyecto. Se usa .git/info/exclude (local) para no tocar su .gitignore.
   */
  private excluirDelGitDelProyecto(): void {
    const info = join(dirname(this.raiz), '.git', 'info')
    try {
      if (!statSync(join(dirname(this.raiz), '.git')).isDirectory()) return
      mkdirSync(info, { recursive: true })
      const ruta = join(info, 'exclude')
      const actual = existsSync(ruta) ? readFileSync(ruta, 'utf-8') : ''
      if (/^\/?\.hive\/?\s*$/m.test(actual)) return
      appendFileSync(ruta, `${actual && !actual.endsWith('\n') ? '\n' : ''}# minioffice: memoria de la oficina\n/.hive/\n`, 'utf-8')
    } catch {
      // no es un repositorio git (o es un worktree): nada que hacer
    }
  }

  constructor(
    raizProyecto: string,
    /** Dónde van las claves (fuera del proyecto). */
    private secretos: AlmacenSecretos = new ClavesEnMemoria()
  ) {
    this.raiz = join(raizProyecto, '.hive')
    // Un repositorio podría traer .hive como enlace a otra carpeta: minioffice escribiría ahí.
    try {
      if (lstatSync(this.raiz).isSymbolicLink()) {
        throw new Error('La carpeta .hive del proyecto es un enlace simbólico; por seguridad minioffice no la usa. Bórrala o cámbiala por una carpeta normal.')
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
    mkdirSync(this.raiz, { recursive: true })
    this.git = simpleGit(this.raiz)
  }

  /** Lee un JSON del hive; si no cambió desde la última vez, devuelve lo ya leído. */
  private leerConCache<T>(ruta: string): T | null {
    let st
    try {
      st = statSync(ruta)
    } catch {
      this.cache.delete(ruta)
      return null
    }
    const previo = this.cache.get(ruta)
    if (previo && previo.mtime === st.mtimeMs && previo.tamano === st.size) return previo.dato as T | null
    const dato = leerJson<T>(ruta)
    this.cache.set(ruta, { mtime: st.mtimeMs, tamano: st.size, dato })
    return dato
  }

  rutaAgente(agentId: string): string {
    return join(this.raiz, 'agentes', agentId)
  }

  rutaSalida(agentId: string): string {
    return join(this.rutaAgente(agentId), 'buzon', 'salida')
  }

  private rutaEntrada(agentId: string): string {
    return join(this.rutaAgente(agentId), 'buzon', 'entrada')
  }

  private rutaEnviados(agentId: string): string {
    return join(this.rutaAgente(agentId), 'buzon', 'enviados')
  }

  private rutaRechazados(agentId: string): string {
    return join(this.rutaAgente(agentId), 'buzon', 'rechazados')
  }

  get rutaTareas(): string {
    return join(this.raiz, 'tareas')
  }

  get rutaPreguntas(): string {
    return join(this.raiz, 'preguntas')
  }

  get rutaPizarra(): string {
    return join(this.raiz, 'pizarra.md')
  }

  rutaMemoria(agentId: string): string {
    return join(this.rutaAgente(agentId), 'memoria.md')
  }

  async inicializar(agentes: Array<{ id: string; nombre: string }>): Promise<void> {
    this.registrar(agentes)
    this.excluirDelGitDelProyecto()
    mkdirSync(this.rutaTareas, { recursive: true })
    mkdirSync(this.rutaPreguntas, { recursive: true })
    if (!existsSync(this.rutaPizarra)) {
      escribirAtomico(this.rutaPizarra, '# Pizarra compartida\n\nNotas visibles para todo el equipo.\n')
    }
    this.recortarActividad()
    // Sin git (Mac sin herramientas de desarrollo) la oficina funciona igual, sin historial del hive.
    if (!gitDisponible()) return
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

  /** Crea las carpetas de los agentes nuevos y actualiza quien puede recibir mensajes. */
  registrar(agentes: Array<{ id: string; nombre: string }>): void {
    this.idsValidos = new Set(agentes.map((a) => a.id))
    for (const agente of agentes) {
      mkdirSync(this.rutaEntrada(agente.id), { recursive: true })
      mkdirSync(this.rutaSalida(agente.id), { recursive: true })
      if (!existsSync(this.rutaMemoria(agente.id))) {
        escribirAtomico(this.rutaMemoria(agente.id), `# Memoria de ${agente.nombre}\n\n`)
      }
    }
  }

  async commit(mensaje: string): Promise<void> {
    if (!gitDisponible()) return
    try {
      await this.git.add('.')
      const estado = await this.git.status()
      if (estado.staged.length > 0) await this.git.commit(mensaje)
    } catch (err) {
      console.error('No se pudo hacer commit en el hive:', err)
    }
  }

  /** Agrupa cambios frecuentes (tareas, preguntas) en un solo commit. */
  commitDiferido(mensaje: string): void {
    this.mensajesPendientesDeCommit.push(mensaje)
    if (this.commitProgramado) return
    this.commitProgramado = setTimeout(() => {
      const mensajes = [...new Set(this.mensajesPendientesDeCommit)]
      this.mensajesPendientesDeCommit = []
      this.commitProgramado = null
      void this.commit(mensajes.slice(0, 3).join('; ') + (mensajes.length > 3 ? '…' : ''))
    }, 1500)
  }

  // ------------------------------------------------------------- mensajes

  nuevoMensaje(de: string, para: string, cuerpo: string): HiveMessage {
    return { id: randomUUID(), de, para, cuerpo, creadoEn: Date.now() }
  }

  /** Deja un mensaje en la bandeja de salida del remitente; el router lo entrega. */
  depositarSaliente(msg: Omit<HiveMessage, 'id' | 'creadoEn'>): HiveMessage {
    const completo = this.nuevoMensaje(msg.de, msg.para, msg.cuerpo)
    const dir = this.rutaSalida(msg.de)
    mkdirSync(dir, { recursive: true })
    escribirAtomico(join(dir, `${completo.id}.json`), JSON.stringify(completo, null, 2))
    return completo
  }

  /**
   * Lee la bandeja de salida de un agente. Los archivos los escriben los propios
   * agentes, asi que se validan aqui: el remitente siempre es el dueno de la carpeta.
   */
  listarPendientesDeEnvio(agentId: string, destinoValido: (para: string) => boolean): PendienteDeEnvio[] {
    const dir = this.rutaSalida(agentId)
    if (!existsSync(dir)) return []

    const pendientes: PendienteDeEnvio[] = []
    for (const archivo of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const ruta = join(dir, archivo)
      let crudo: Partial<HiveMessage>
      try {
        crudo = JSON.parse(readFileSync(ruta, 'utf-8'))
      } catch {
        try {
          if (Date.now() - statSync(ruta).mtimeMs > MS_GRACIA_ARCHIVO_ROTO) this.rechazar(agentId, archivo)
        } catch {
          // ya no existe
        }
        continue
      }
      const para = typeof crudo.para === 'string' ? crudo.para.trim().toLowerCase() : ''
      const cuerpo = typeof crudo.cuerpo === 'string' ? crudo.cuerpo.trim() : ''
      const valido = para !== agentId && (this.idsValidos.has(para) || destinoValido(para))
      if (!valido || !cuerpo) {
        this.rechazar(agentId, archivo)
        continue
      }
      // El id se usa como nombre de archivo: nunca se toma del agente.
      pendientes.push({ archivo, mensaje: this.nuevoMensaje(agentId, para, cuerpo) })
    }
    return pendientes
  }

  /** Mueve el mensaje de la salida del remitente a enviados y lo guarda en la entrada del destinatario. */
  entregar(pendiente: PendienteDeEnvio, guardarEnEntrada = true): void {
    const { mensaje } = pendiente
    if (guardarEnEntrada) this.guardarEnEntrada(mensaje)
    const origen = join(this.rutaSalida(mensaje.de), pendiente.archivo)
    if (existsSync(origen)) {
      mkdirSync(this.rutaEnviados(mensaje.de), { recursive: true })
      renameSync(origen, join(this.rutaEnviados(mensaje.de), `${mensaje.id}.json`))
    }
  }

  guardarEnEntrada(mensaje: HiveMessage): void {
    mkdirSync(this.rutaEntrada(mensaje.para), { recursive: true })
    escribirAtomico(join(this.rutaEntrada(mensaje.para), `${mensaje.id}.json`), JSON.stringify(mensaje, null, 2))
  }

  private rechazar(agentId: string, archivo: string): void {
    mkdirSync(this.rutaRechazados(agentId), { recursive: true })
    try {
      renameSync(join(this.rutaSalida(agentId), archivo), join(this.rutaRechazados(agentId), archivo))
      console.warn(`Mensaje invalido de ${agentId} movido a rechazados: ${archivo}`)
    } catch {
      // otro proceso ya lo movio
    }
  }

  private leerMensajes(dir: string): HiveMessage[] {
    if (!existsSync(dir)) return []
    const salida: HiveMessage[] = []
    for (const archivo of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const m = leerJson<HiveMessage>(join(dir, archivo))
      if (m && typeof m.cuerpo === 'string') salida.push(m)
    }
    return salida
  }

  /**
   * Los mensajes entregados de todos los buzones, en orden cronológico. Con
   * `limite`, solo se leen los más recientes (por fecha del archivo): con meses
   * de uso hay miles y leerlos todos retrasaba la apertura.
   */
  historialCompleto(limite?: number): HiveMessage[] {
    const carpeta = join(this.raiz, 'agentes')
    if (!existsSync(carpeta)) return []
    const archivos: Array<{ ruta: string; mtime: number }> = []
    for (const id of readdirSync(carpeta)) {
      const dir = this.rutaEntrada(id)
      if (!existsSync(dir)) continue
      for (const archivo of readdirSync(dir)) {
        if (!archivo.endsWith('.json')) continue
        const ruta = join(dir, archivo)
        try {
          archivos.push({ ruta, mtime: statSync(ruta).mtimeMs })
        } catch {
          // se movió mientras tanto
        }
      }
    }
    const elegidos = limite ? archivos.sort((a, b) => b.mtime - a.mtime).slice(0, limite) : archivos
    const todos: HiveMessage[] = []
    for (const { ruta } of elegidos) {
      const m = leerJson<HiveMessage>(ruta)
      if (m && typeof m.cuerpo === 'string') todos.push(m)
    }
    return todos.sort((a, b) => a.creadoEn - b.creadoEn)
  }

  mensajesDe(agentId: string): HiveMessage[] {
    const recibidos = this.leerMensajes(this.rutaEntrada(agentId))
    const enviados = this.leerMensajes(this.rutaEnviados(agentId))
    const porId = new Map([...recibidos, ...enviados].map((m) => [m.id, m]))
    return [...porId.values()].sort((a, b) => a.creadoEn - b.creadoEn)
  }

  agregarMemoria(agentId: string, texto: string): void {
    const ruta = this.rutaMemoria(agentId)
    if (!existsSync(ruta)) return
    appendFileSync(ruta, `- ${new Date().toISOString()}: ${texto.replace(/\n+/g, ' ')}\n`, 'utf-8')
  }

  // --------------------------------------------------------------- tareas

  listarTareas(): Tarea[] {
    if (!existsSync(this.rutaTareas)) return []
    const tareas: Tarea[] = []
    for (const archivo of readdirSync(this.rutaTareas).filter((f) => f.endsWith('.json'))) {
      const t = this.leerConCache<Partial<Tarea>>(join(this.rutaTareas, archivo))
      if (!t || typeof t.titulo !== 'string') continue
      const id = archivo.replace(/\.json$/, '')
      tareas.push({
        id,
        titulo: t.titulo,
        descripcion: typeof t.descripcion === 'string' ? t.descripcion : '',
        estado: ['pendiente', 'en_curso', 'bloqueada', 'hecha'].includes(t.estado as string) ? (t.estado as Tarea['estado']) : 'pendiente',
        dueno: typeof t.dueno === 'string' && t.dueno ? t.dueno : undefined,
        creadaPor: typeof t.creadaPor === 'string' ? t.creadaPor : 'desconocido',
        prioridad: t.prioridad === 1 || t.prioridad === 3 ? t.prioridad : 2,
        creada: typeof t.creada === 'number' ? t.creada : Date.now(),
        actualizada: typeof t.actualizada === 'number' ? t.actualizada : Date.now(),
        archivada: !!t.archivada
      })
    }
    return tareas.sort((a, b) => b.actualizada - a.actualizada)
  }

  guardarTarea(tarea: Tarea): void {
    mkdirSync(this.rutaTareas, { recursive: true })
    const { id, ...resto } = tarea
    escribirAtomico(join(this.rutaTareas, `${id}.json`), JSON.stringify(resto, null, 2))
  }

  eliminarTarea(id: string): void {
    const ruta = join(this.rutaTareas, `${id}.json`)
    if (/^[\w-]+$/.test(id) && existsSync(ruta)) rmSync(ruta)
  }

  // ------------------------------------------------------------ preguntas

  crearPregunta(de: string, texto: string): Pregunta {
    const opciones = [...texto.matchAll(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/gm)].map((m) => m[1].trim()).slice(0, 6)
    const pregunta: Pregunta = {
      id: randomUUID(),
      de,
      pregunta: texto,
      opciones: opciones.length >= 2 ? opciones : undefined,
      creada: Date.now()
    }
    escribirAtomico(join(this.rutaPreguntas, `${pregunta.id}.json`), JSON.stringify(pregunta, null, 2))
    return pregunta
  }

  listarPreguntas(): Pregunta[] {
    if (!existsSync(this.rutaPreguntas)) return []
    return readdirSync(this.rutaPreguntas)
      .filter((f) => f.endsWith('.json'))
      .map((f) => this.leerConCache<Pregunta>(join(this.rutaPreguntas, f)))
      .filter((p): p is Pregunta => !!p && typeof p.pregunta === 'string')
      .sort((a, b) => b.creada - a.creada)
  }

  responderPregunta(id: string, respuesta: string): Pregunta | null {
    const ruta = join(this.rutaPreguntas, `${id}.json`)
    const p = /^[\w-]+$/.test(id) ? leerJson<Pregunta>(ruta) : null
    if (!p) return null
    p.respuesta = respuesta
    p.respondida = Date.now()
    escribirAtomico(ruta, JSON.stringify(p, null, 2))
    return p
  }

  eliminarPregunta(id: string): void {
    const ruta = join(this.rutaPreguntas, `${id}.json`)
    if (/^[\w-]+$/.test(id) && existsSync(ruta)) rmSync(ruta)
  }

  // ------------------------------------------------------------ actividad

  registrarEvento(evento: EventoActividad): void {
    try {
      appendFileSync(join(this.raiz, 'actividad.jsonl'), `${JSON.stringify(evento)}\n`, 'utf-8')
    } catch (err) {
      // disco lleno o sin permiso: la actividad sigue en memoria
      console.error('No se pudo anotar la actividad:', (err as Error).message)
    }
  }

  /** actividad.jsonl crecía para siempre: al abrir se queda con sus últimas líneas. */
  private recortarActividad(): void {
    const ruta = join(this.raiz, 'actividad.jsonl')
    try {
      if (statSync(ruta).size <= MAX_BYTES_ACTIVIDAD) return
      const lineas = readFileSync(ruta, 'utf-8').trimEnd().split('\n').slice(-LINEAS_ACTIVIDAD_CONSERVADAS)
      escribirAtomico(ruta, `${lineas.join('\n')}\n`)
    } catch {
      // aún no existe
    }
  }

  leerActividad(): EventoActividad[] {
    const ruta = join(this.raiz, 'actividad.jsonl')
    if (!existsSync(ruta)) return []
    const lineas = readFileSync(ruta, 'utf-8').trim().split('\n').slice(-MAX_ACTIVIDAD)
    const eventos: EventoActividad[] = []
    for (const linea of lineas) {
      try {
        eventos.push(JSON.parse(linea) as EventoActividad)
      } catch {
        // linea corrupta
      }
    }
    return eventos.reverse()
  }

  // -------------------------------------------------------------- ajustes

  /**
   * Los ajustes del proyecto. Las claves (webhook y otras oficinas) no están en
   * el archivo: vienen del almacén de secretos. Las versiones anteriores las
   * guardaban aquí; al leerlas se mudan.
   */
  leerAjustes(): Ajustes {
    const ruta = join(this.raiz, 'ajustes.json')
    let guardados: Partial<Ajustes> = {}
    if (existsSync(ruta)) {
      const leidos = leerJson<Partial<Ajustes>>(ruta)
      if (leidos && typeof leidos === 'object' && !Array.isArray(leidos)) guardados = leidos
      else {
        // Dañado: se aparta una copia en vez de pisarlo con los valores por defecto.
        const copia = `${ruta}.danado-${Date.now()}`
        try {
          renameSync(ruta, copia)
        } catch {
          // no se pudo mover
        }
        console.error(`ajustes.json estaba dañado; copia en ${copia}`)
      }
    }
    const claves = this.secretos.leer()
    const ajustes: Ajustes = { ...AJUSTES_POR_DEFECTO, ...guardados }
    ajustes.companeros = (Array.isArray(ajustes.companeros) ? ajustes.companeros : []).map((c) => ({
      ...c,
      clave: claves.companeros[c.id] ?? (typeof c.clave === 'string' ? c.clave : '')
    }))
    ajustes.webhookClave = claves.webhookClave || guardados.webhookClave || nuevaClaveWebhook()
    const mudar = !!guardados.webhookClave || (Array.isArray(guardados.companeros) && guardados.companeros.some((c) => !!(c as { clave?: string }).clave))
    if (mudar || !claves.webhookClave) this.guardarAjustes(ajustes)
    return ajustes
  }

  guardarAjustes(ajustes: Ajustes): void {
    this.secretos.guardar({
      webhookClave: ajustes.webhookClave,
      companeros: Object.fromEntries(ajustes.companeros.map((c) => [c.id, c.clave]))
    })
    const { webhookClave: _clave, ...resto } = ajustes
    const sinClaves = { ...resto, companeros: ajustes.companeros.map(({ clave: _c, ...c }) => c) }
    escribirAtomico(join(this.raiz, 'ajustes.json'), JSON.stringify(sinClaves, null, 2))
  }

  leerArchivoLibre<T>(nombre: string): T | null {
    return leerJson<T>(join(this.raiz, nombre))
  }

  guardarArchivoLibre(nombre: string, datos: unknown): void {
    escribirAtomico(join(this.raiz, nombre), JSON.stringify(datos, null, 2))
  }

  // -------------------------------------------------------------- memoria

  leerTexto(ruta: string): string {
    try {
      return readFileSync(ruta, 'utf-8')
    } catch {
      return ''
    }
  }

  guardarPizarra(texto: string): void {
    escribirAtomico(this.rutaPizarra, texto)
  }

  /**
   * Busqueda por palabras en memorias, pizarra, mensajes y tareas. Puntua por
   * coincidencias de cada termino, con mas peso a las frases completas.
   */
  buscar(consulta: string, filtroAgentes: string[], filtroTipos: string[], agentes: Array<{ id: string; nombre: string }>): ResultadoMemoria[] {
    const normal = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const terminos = normal(consulta).split(/\s+/).filter((t) => t.length > 1)
    const quiere = (tipo: string): boolean => filtroTipos.length === 0 || filtroTipos.includes(tipo)
    const deAgente = (id?: string): boolean => filtroAgentes.length === 0 || (!!id && filtroAgentes.includes(id))
    const resultados: ResultadoMemoria[] = []

    const puntuar = (texto: string): number => {
      if (terminos.length === 0) return 1
      const t = normal(texto)
      let puntaje = 0
      for (const termino of terminos) {
        let desde = 0
        let veces = 0
        while ((desde = t.indexOf(termino, desde)) !== -1 && veces < 20) {
          veces++
          desde += termino.length
        }
        if (veces === 0) return 0
        puntaje += 1 + Math.log(veces)
      }
      if (t.includes(normal(consulta))) puntaje += 2
      return puntaje
    }
    const fragmento = (texto: string): string => {
      if (terminos.length === 0) return texto.slice(0, 220)
      const i = normal(texto).indexOf(terminos[0])
      const inicio = Math.max(0, i - 80)
      return (inicio > 0 ? '…' : '') + texto.slice(inicio, inicio + 240) + (inicio + 240 < texto.length ? '…' : '')
    }

    if (quiere('memoria')) {
      for (const a of agentes) {
        if (!deAgente(a.id)) continue
        const bloques = this.leerTexto(this.rutaMemoria(a.id)).split(/\n(?=- |#)/)
        for (const bloque of bloques) {
          const puntaje = puntuar(bloque)
          if (puntaje > 0 && bloque.trim() && !bloque.startsWith('# Memoria de')) {
            resultados.push({ tipo: 'memoria', agente: a.id, titulo: `Memoria de ${a.nombre}`, fragmento: fragmento(bloque.trim()), puntaje })
          }
        }
      }
    }
    if (quiere('pizarra') && filtroAgentes.length === 0) {
      for (const bloque of this.leerTexto(this.rutaPizarra).split(/\n\n+/)) {
        const puntaje = puntuar(bloque)
        if (puntaje > 0 && bloque.trim()) resultados.push({ tipo: 'pizarra', titulo: 'Pizarra', fragmento: fragmento(bloque.trim()), puntaje })
      }
    }
    if (quiere('mensaje')) {
      for (const m of this.historialCompleto()) {
        if (!deAgente(m.de) && !deAgente(m.para)) continue
        const puntaje = puntuar(m.cuerpo)
        if (puntaje > 0) {
          resultados.push({ tipo: 'mensaje', agente: m.de, titulo: `${m.de} → ${m.para}`, fragmento: fragmento(m.cuerpo), puntaje, ts: m.creadoEn })
        }
      }
    }
    if (quiere('tarea')) {
      for (const t of this.listarTareas()) {
        if (!deAgente(t.dueno)) continue
        const puntaje = puntuar(`${t.titulo}\n${t.descripcion}`)
        if (puntaje > 0) {
          resultados.push({ tipo: 'tarea', agente: t.dueno, titulo: t.titulo, fragmento: fragmento(t.descripcion || t.titulo), puntaje, ts: t.actualizada })
        }
      }
    }
    return resultados.sort((a, b) => b.puntaje - a.puntaje || (b.ts ?? 0) - (a.ts ?? 0)).slice(0, 80)
  }
}
