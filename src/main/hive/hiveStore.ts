import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import simpleGit, { type SimpleGit } from 'simple-git'
import type { Ajustes, EventoActividad, HiveMessage, Pregunta, Tarea } from '../../shared/types'
import type { ResultadoMemoria } from '../../shared/acciones'

// Un archivo que aun no es JSON valido puede estar a medio escribir; solo se
// descarta si sigue roto despues de este tiempo.
const MS_GRACIA_ARCHIVO_ROTO = 5000
const MAX_ACTIVIDAD = 400

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
  webhookClave: randomUUID().replace(/-/g, '').slice(0, 24),
  webhookRed: false,
  companeros: [],
  maxTemporales: 4
}

function leerJson<T>(ruta: string): T | null {
  try {
    return JSON.parse(readFileSync(ruta, 'utf-8')) as T
  } catch {
    return null
  }
}

function escribirAtomico(ruta: string, contenido: string): void {
  const temporal = `${ruta}.${randomUUID().slice(0, 8)}.tmp`
  writeFileSync(temporal, contenido)
  renameSync(temporal, ruta)
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

  constructor(raizProyecto: string) {
    this.raiz = join(raizProyecto, '.hive')
    mkdirSync(this.raiz, { recursive: true })
    this.git = simpleGit(this.raiz)
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
    mkdirSync(this.rutaTareas, { recursive: true })
    mkdirSync(this.rutaPreguntas, { recursive: true })
    if (!existsSync(this.rutaPizarra)) {
      writeFileSync(this.rutaPizarra, '# Pizarra compartida\n\nNotas visibles para todo el equipo.\n', 'utf-8')
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

  /** Crea las carpetas de los agentes nuevos y actualiza quien puede recibir mensajes. */
  registrar(agentes: Array<{ id: string; nombre: string }>): void {
    this.idsValidos = new Set(agentes.map((a) => a.id))
    for (const agente of agentes) {
      mkdirSync(this.rutaEntrada(agente.id), { recursive: true })
      mkdirSync(this.rutaSalida(agente.id), { recursive: true })
      if (!existsSync(this.rutaMemoria(agente.id))) {
        writeFileSync(this.rutaMemoria(agente.id), `# Memoria de ${agente.nombre}\n\n`, 'utf-8')
      }
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
    writeFileSync(join(this.rutaEntrada(mensaje.para), `${mensaje.id}.json`), JSON.stringify(mensaje, null, 2))
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

  /** Todos los mensajes entregados, de todos los buzones, en orden cronologico. */
  historialCompleto(): HiveMessage[] {
    const todos: HiveMessage[] = []
    const carpeta = join(this.raiz, 'agentes')
    if (!existsSync(carpeta)) return todos
    for (const id of readdirSync(carpeta)) todos.push(...this.leerMensajes(this.rutaEntrada(id)))
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
      const t = leerJson<Partial<Tarea>>(join(this.rutaTareas, archivo))
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
      .map((f) => leerJson<Pregunta>(join(this.rutaPreguntas, f)))
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
    appendFileSync(join(this.raiz, 'actividad.jsonl'), `${JSON.stringify(evento)}\n`, 'utf-8')
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

  leerAjustes(): Ajustes {
    const guardados = leerJson<Partial<Ajustes>>(join(this.raiz, 'ajustes.json')) ?? {}
    const ajustes = { ...AJUSTES_POR_DEFECTO, ...guardados }
    if (!guardados.webhookClave) this.guardarAjustes(ajustes)
    return ajustes
  }

  guardarAjustes(ajustes: Ajustes): void {
    escribirAtomico(join(this.raiz, 'ajustes.json'), JSON.stringify(ajustes, null, 2))
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
