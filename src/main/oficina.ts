import { EventEmitter } from 'node:events'
import { execFile, spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { userInfo } from 'node:os'
import { basename, delimiter, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { dialog, shell, type BrowserWindow } from 'electron'
import paquete from '../../package.json'
import type { Accion } from '../shared/acciones'
import type {
  Agente,
  AgentDefinition,
  AgentRuntime,
  EstadoPlan,
  AgentStatus,
  Ajustes,
  EventoActividad,
  HiveMessage,
  Horario,
  Instantanea,
  Parche,
  Pregunta,
  Tarea,
  TipoEvento
} from '../shared/types'
import { ID_MICHAEL, REPARTO } from '../shared/reparto'
import { comandoBase, proveedorDe, unirComando, ventanaDe } from '../shared/motores'
import { cargarEquipo, guardarEquipo, normalizar } from './equipo'
import { guardarPreferencias, leerPreferencias } from './preferencias'
import { HiveStore, USUARIO, type PendienteDeEnvio } from './hive/hiveStore'
import { MailboxRouter } from './hive/mailboxRouter'
import { Sesiones } from './pty/sesiones'
import { SeguidorTranscripcion } from './transcripcion'
import { instruccionesPara } from './agents/instrucciones'
import { estadoGit, worktreePara } from './git'
import { Temporales } from './temporales'
import { Disparadores } from './disparadores'
import { Biblioteca } from './skills'
import { Consumo } from './consumo'
import { NOMBRE_SKILL_VALIDO, sugeridasPara } from '../shared/skills'

const TICK_MS = 400
const REVISION_DISCO_MS = 2000
const MS_BLOQUEO_TRAS_ENTREGA = 5000
const MS_ESPERA_TRAS_ERROR = 30_000
const MAX_MENSAJES = 800
const MAX_ACTIVIDAD = 400

// Texto que muestran las CLIs cuando esperan una respuesta del usuario.
const PREGUNTA_EN_TERMINAL = /Do you want to|Do you trust|don't ask again|Allow (this|once|always)|\(y\/n\)|\[Y\/n\]|¿Quieres/i

function resumir(texto: string, largo = 80): string {
  const plano = texto.replace(/\s+/g, ' ').trim()
  return plano.length > largo ? `${plano.slice(0, largo - 1)}…` : plano
}

function slug(texto: string): string {
  const base = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${base || 'tarea'}-${randomUUID().slice(0, 4)}`
}

function enPath(binario: string): string | null {
  const extensiones = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : ['']
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    for (const ext of extensiones) {
      const ruta = join(dir, binario + ext)
      if (dir && existsSync(ruta)) return ruta
    }
  }
  return null
}

/**
 * El cerebro de minioffice: el equipo, sus sesiones, los mensajes, las tareas
 * y las preguntas. Emite 'parche' con cada cambio para la interfaz, 'salida'
 * con lo que escriben las terminales y 'sobre' cuando alguien envia un mensaje.
 */
export class Oficina extends EventEmitter {
  readonly hive: HiveStore
  readonly sesiones = new Sesiones()
  private defs: AgentDefinition[]
  private runtimes = new Map<string, AgentRuntime>()
  private colas = new Map<string, string[]>()
  private seguidores = new Map<string, SeguidorTranscripcion>()
  private bloqueoEntrega = new Map<string, number>()
  private errores = new Map<string, number>()
  private detencionesPedidas = new Set<string>()
  private arrancando = new Set<string>()
  private compactando = new Map<string, number>()
  private router: MailboxRouter
  readonly temporales: Temporales
  readonly disparadores: Disparadores
  readonly biblioteca: Biblioteca
  readonly consumo: Consumo
  private plan: EstadoPlan | null = null
  private ultimaLecturaPlan = 0
  private ultimoGuardadoConsumo = 0
  private ajustesActuales: Ajustes
  private mensajes: HiveMessage[] = []
  private tareas: Tarea[] = []
  private preguntas: Pregunta[] = []
  private actividad: EventoActividad[] = []
  private firmas = new Map<string, string>()
  private temporizadores: NodeJS.Timeout[] = []

  constructor(
    readonly raiz: string,
    private ventana: () => BrowserWindow | null
  ) {
    super()
    this.hive = new HiveStore(raiz)
    this.defs = cargarEquipo(raiz)
    this.ajustesActuales = this.hive.leerAjustes()
    // Las IA agregadas son de tu Mac, no del proyecto.
    this.ajustesActuales.motores = leerPreferencias().motores ?? this.ajustesActuales.motores ?? []
    this.consumo = new Consumo(this.hive.raiz)
    this.plan = this.consumo.leerPlan()
    this.biblioteca = new Biblioteca(
      () => this.defs,
      raiz,
      (texto) => this.evento('sistema', texto)
    )
    this.router = new MailboxRouter(
      this.hive,
      () => this.defs.map((d) => d.id),
      (para) => this.destinoEspecial(para),
      (p) => this.procesarPendiente(p)
    )
    this.temporales = new Temporales(
      () => this.ajustesActuales.maxTemporales,
      () => this.ajustesActuales.modoPermisos
    )
    this.temporales.on('cambio', () => this.emitir('temporales'))
    this.temporales.on('terminado', (t) =>
      this.evento('temporal', `Temporal ${t.estado === 'hecho' ? 'terminó' : 'falló'}: ${resumir(t.prompt, 60)}`)
    )
    this.disparadores = new Disparadores({
      ajustes: () => this.ajustesActuales,
      dispararHorario: (h) => this.dispararHorario(h),
      recibirExterno: (para, texto, origen) => this.recibirExterno(para, texto, origen),
      resumenEquipo: () => this.defs.map((d) => ({ id: d.id, nombre: d.nombre, estado: this.runtime(d.id).estado }))
    })
    this.sesiones.on('salida', (agentId: string, data: string) => this.emit('salida', { agentId, data }))
    this.sesiones.on('salio', (agentId: string, codigo: number) => this.alSalir(agentId, codigo))
  }

  async iniciar(): Promise<void> {
    await this.hive.inicializar(this.defs)
    this.mensajes = this.hive.historialCompleto().slice(-MAX_MENSAJES)
    this.tareas = this.hive.listarTareas()
    this.preguntas = this.hive.listarPreguntas()
    this.actividad = this.hive.leerActividad()
    this.router.iniciar()
    this.disparadores.iniciar()
    this.temporizadores.push(setInterval(() => this.tick(), TICK_MS))
    this.temporizadores.push(setInterval(() => this.revisarDisco(), REVISION_DISCO_MS))
    this.evento('sistema', `La oficina abrió con ${this.defs.length - 1} empleados`)
    if (this.ajustesActuales.michaelAlIniciar) {
      const michael = this.def(ID_MICHAEL)
      if (michael) void this.iniciarAgente(michael)
    }
  }

  apagar(): void {
    for (const t of this.temporizadores) clearInterval(t)
    this.router.detener()
    this.disparadores.detener()
    this.temporales.detenerTodo()
    for (const s of this.seguidores.values()) s.detener()
    this.sesiones.detenerTodo()
    this.consumo.guardar()
  }

  // ---------------------------------------------------------------- estado

  private def(id: string): AgentDefinition | undefined {
    return this.defs.find((d) => d.id === id)
  }

  private nombreDe(id: string): string {
    if (id === USUARIO) return 'Usuario'
    return this.def(id)?.nombre ?? id
  }

  private runtime(id: string): AgentRuntime {
    let rt = this.runtimes.get(id)
    if (!rt) {
      const def = this.def(id)
      rt = { estado: 'detenido', llamadas: 0, tokens: 0, contexto: 0, ventana: ventanaDe(def?.modelo), costo: 0, pendientes: 0 }
      this.runtimes.set(id, rt)
    }
    return rt
  }

  private cola(id: string): string[] {
    let c = this.colas.get(id)
    if (!c) {
      c = []
      this.colas.set(id, c)
    }
    return c
  }

  private agentes(): Agente[] {
    return this.defs.map((d) => ({ ...d, rt: { ...this.runtime(d.id), pendientes: this.cola(d.id).length } }))
  }

  instantanea(): Instantanea {
    return {
      version: paquete.version,
      raiz: this.raiz,
      agentes: this.agentes(),
      mensajes: this.mensajes,
      tareas: this.tareas,
      preguntas: this.preguntas,
      actividad: this.actividad,
      ajustes: this.ajustesActuales,
      temporales: this.temporales.todos(),
      plan: this.plan
    }
  }

  private emitir(dominio: Parche['dominio']): void {
    const datos = this.instantanea()[dominio]
    const firma = JSON.stringify(datos)
    if (this.firmas.get(dominio) === firma) return
    this.firmas.set(dominio, firma)
    this.emit('parche', { dominio, datos } as Parche)
  }

  private evento(tipo: TipoEvento, texto: string, agente?: string): void {
    const e: EventoActividad = { ts: Date.now(), tipo, texto, agente }
    this.hive.registrarEvento(e)
    this.actividad = [e, ...this.actividad].slice(0, MAX_ACTIVIDAD)
    this.emitir('actividad')
  }

  private agregarMensaje(m: HiveMessage): void {
    this.mensajes = [...this.mensajes, m].slice(-MAX_MENSAJES)
    this.emitir('mensajes')
  }

  // ----------------------------------------------------------------- ciclo

  private tick(): void {
    for (const def of this.defs) this.actualizarAgente(def)
    this.procesarColas()
    this.emitir('agentes')
    const ahora = Date.now()
    if (ahora - this.ultimaLecturaPlan > 5000) {
      this.ultimaLecturaPlan = ahora
      this.plan = this.consumo.leerPlan()
      this.emitir('plan')
    }
    if (ahora - this.ultimoGuardadoConsumo > 15_000) {
      this.ultimoGuardadoConsumo = ahora
      this.consumo.guardar()
    }
  }

  private revisarDisco(): void {
    this.tareas = this.hive.listarTareas()
    this.preguntas = this.hive.listarPreguntas()
    this.emitir('tareas')
    this.emitir('preguntas')
  }

  private actualizarAgente(def: AgentDefinition): void {
    const rt = this.runtime(def.id)
    const seguidor = this.seguidores.get(def.id)
    if (seguidor) {
      const r = seguidor.resumen()
      rt.herramienta = r.herramienta
      rt.detalleHerramienta = r.detalle
      rt.llamadas = r.llamadas
      rt.tokens = r.tokens
      rt.contexto = r.contexto
      rt.costo = r.costo
      rt.modeloReal = r.modelo
      rt.ultimoTexto = r.ultimoTexto
      rt.ventana = ventanaDe(def.modelo || r.modelo)
      if (rt.sesionId) this.consumo.registrar(def.id, rt.sesionId, seguidor.drenarUsos())
    } else if (!this.sesiones.activa(def.id)) {
      rt.herramienta = undefined
    }
    const anterior = rt.estado
    rt.estado = this.calcularEstado(def)
    if (rt.estado === 'trabajando' || rt.estado === 'esperando') rt.ultimaActividad = Date.now()
    if (anterior !== rt.estado && rt.estado === 'esperando') {
      this.evento('sesion', `${def.nombre} espera una respuesta en su terminal`, def.id)
    }

    // Cortacircuitos: al pasar el limite se interrumpe y no se le entrega nada mas.
    if (def.limiteTokens && rt.tokens >= def.limiteTokens && !rt.limiteAlcanzado) {
      rt.limiteAlcanzado = true
      this.sesiones.interrumpir(def.id)
      this.evento('sistema', `${def.nombre} llegó a su límite de ${Math.round(def.limiteTokens / 1000)}k tokens y se detuvo`, def.id)
    }

    // Compactar el contexto al llenarse (solo Claude Code y cuando esta libre).
    const a = this.ajustesActuales
    if (a.compactarAuto && seguidor && rt.estado === 'inactivo' && rt.ventana > 0) {
      const porcentaje = (rt.contexto / rt.ventana) * 100
      const reciente = (this.compactando.get(def.id) ?? 0) > Date.now() - 120_000
      if (porcentaje >= a.compactarUmbral && !reciente && this.cola(def.id).length === 0) {
        this.compactando.set(def.id, Date.now())
        this.sesiones.escribirPrompt(def.id, '/compact')
        this.bloqueoEntrega.set(def.id, Date.now() + MS_BLOQUEO_TRAS_ENTREGA)
        this.evento('sistema', `Compactando el contexto de ${def.nombre} (${Math.round(porcentaje)}%)`, def.id)
      }
    }
  }

  private calcularEstado(def: AgentDefinition): AgentStatus {
    const id = def.id
    if (!this.sesiones.activa(id)) return this.errores.has(id) ? 'error' : 'detenido'
    if (this.sesiones.pausada(id)) return 'pausado'
    const silencio = this.sesiones.silencio(id)
    const edad = this.sesiones.edad(id)
    const pregunta = silencio > 700 && PREGUNTA_EN_TERMINAL.test(this.sesiones.reciente(id).slice(-700))
    const entregando = (this.bloqueoEntrega.get(id) ?? 0) > Date.now()
    const seguidor = this.seguidores.get(id)
    if (seguidor) {
      const r = seguidor.resumen()
      if (pregunta && (r.turnoActivo || r.mensajesUsuario === 0)) return 'esperando'
      if (r.turnoActivo || entregando) return 'trabajando'
      if (edad < 5000 && r.mensajesUsuario === 0 && silencio < 1500) return 'iniciando'
      return 'inactivo'
    }
    if (pregunta) return 'esperando'
    if (edad < 3000) return 'iniciando'
    return silencio < 2500 || entregando ? 'trabajando' : 'inactivo'
  }

  private procesarColas(): void {
    for (const def of this.defs) {
      const cola = this.cola(def.id)
      if (cola.length === 0) continue
      const rt = this.runtime(def.id)
      if (!this.sesiones.activa(def.id)) {
        if (this.arrancando.has(def.id)) continue
        if ((this.errores.get(def.id) ?? 0) > Date.now() - MS_ESPERA_TRAS_ERROR) continue
        // Claude Code recibe el primer mensaje como prompt inicial; las demas lo reciben tecleado.
        const primero = def.proveedor === 'claude' ? cola.shift() : undefined
        void this.iniciarAgente(def, primero)
        continue
      }
      if (rt.limiteAlcanzado || rt.estado !== 'inactivo') continue
      if ((this.bloqueoEntrega.get(def.id) ?? 0) > Date.now()) continue
      const texto = cola.shift()!
      this.sesiones.escribirPrompt(def.id, texto)
      this.bloqueoEntrega.set(def.id, Date.now() + MS_BLOQUEO_TRAS_ENTREGA)
      rt.estado = 'trabajando'
    }
  }

  // --------------------------------------------------------------- sesiones

  private argumentos(
    def: AgentDefinition,
    prompt: string | undefined,
    sesionId: string | undefined,
    reanudar: boolean,
    plugin: string | undefined
  ): string[] {
    const [, ...args] = comandoBase(def, this.ajustesActuales.modoPermisos)
    if (def.proveedor === 'claude' && sesionId) {
      if (plugin) args.push('--plugin-dir', plugin)
      args.push('--settings', this.consumo.settings(def.id))
      args.push(
        '--append-system-prompt',
        instruccionesPara(def, this.defs, this.hive.raiz, this.ajustesActuales.enfoque),
        '--add-dir',
        this.hive.raiz,
        '--name',
        `minioffice-${def.id}`,
        ...(reanudar ? ['--resume', sesionId] : ['--session-id', sesionId])
      )
      if (prompt) args.push(prompt)
    }
    return args
  }

  async iniciarAgente(def: AgentDefinition, prompt?: string, continuar = false): Promise<void> {
    if (this.sesiones.activa(def.id) || this.arrancando.has(def.id)) return
    this.arrancando.add(def.id)
    const rt = this.runtime(def.id)
    try {
      let cwd = def.cwd
      if (def.aislamientoGit) {
        try {
          cwd = await worktreePara(def.cwd, def.id)
        } catch (err) {
          this.evento('sistema', `No se pudo crear el worktree de ${def.nombre}: ${(err as Error).message}`, def.id)
        }
      }
      const [comando] = comandoBase(def, this.ajustesActuales.modoPermisos)
      const fallo = (motivo: string): void => {
        this.errores.set(def.id, Date.now())
        rt.estado = 'error'
        this.evento('sesion', `${def.nombre} no pudo iniciar: ${motivo}`, def.id)
      }
      if (!existsSync(cwd)) return fallo(`la carpeta ${cwd} no existe`)
      if (!comando) return fallo('no tiene comando configurado')

      let sesionId: string | undefined
      const reanudarId = continuar ? rt.sesionId : def.reanudar
      if (def.proveedor === 'claude') sesionId = reanudarId || randomUUID()
      else if (!continuar) {
        this.cola(def.id).unshift(
          `${instruccionesPara(def, this.defs, this.hive.raiz, this.ajustesActuales.enfoque)}\n\n${prompt ?? 'Confirma en una línea que leíste esto y espera instrucciones.'}`
        )
      }
      let plugin: string | undefined
      if (def.proveedor === 'claude' && def.skills?.length) {
        await this.biblioteca.asegurar(def.skills)
        const armado = this.biblioteca.prepararPlugin(def)
        if (armado?.ruta) plugin = armado.ruta
        if (armado?.faltan.length) this.evento('sistema', `${def.nombre} arranca sin: ${armado.faltan.join(', ')} (no están instaladas)`, def.id)
      }
      const args = this.argumentos(def, prompt, sesionId, !!reanudarId, plugin)
      const error = this.sesiones.iniciar(def.id, { comando, args, cwd })
      if (error) return fallo(error)

      this.errores.delete(def.id)
      if (!continuar) Object.assign(rt, { llamadas: 0, tokens: 0, contexto: 0, costo: 0, herramienta: undefined })
      Object.assign(rt, { inicio: Date.now(), cwdReal: cwd, sesionId, limiteAlcanzado: false, estado: 'iniciando' })
      this.seguidores.get(def.id)?.detener()
      this.seguidores.delete(def.id)
      if (sesionId) this.seguidores.set(def.id, new SeguidorTranscripcion(cwd, sesionId))
      this.evento('sesion', `${def.nombre} ${continuar || reanudarId ? 'retomó' : 'inició'} su sesión`, def.id)
    } finally {
      this.arrancando.delete(def.id)
    }
  }

  detenerAgente(id: string): void {
    if (!this.sesiones.activa(id)) return
    this.detencionesPedidas.add(id)
    this.sesiones.detener(id)
  }

  private alSalir(id: string, codigo: number): void {
    const pedida = this.detencionesPedidas.delete(id)
    const def = this.def(id)
    this.seguidores.get(id)?.detener()
    this.seguidores.delete(id)
    this.bloqueoEntrega.delete(id)
    if (!pedida && codigo !== 0) this.errores.set(id, Date.now())
    this.emit('salida', { agentId: id, data: `\r\n\x1b[2m[minioffice] La sesión terminó (código ${codigo}).\x1b[0m\r\n` })
    this.evento('sesion', `${def?.nombre ?? id} ${pedida ? 'cerró su sesión' : `terminó su sesión (código ${codigo})`}`, id)
  }

  private async esperarSalida(id: string, maxMs = 6000): Promise<void> {
    const limite = Date.now() + maxMs
    while (this.sesiones.activa(id) && Date.now() < limite) await new Promise((r) => setTimeout(r, 100))
  }

  private async reiniciar(id: string, continuar: boolean): Promise<void> {
    const def = this.def(id)
    if (!def) return
    this.detenerAgente(id)
    await this.esperarSalida(id)
    await this.iniciarAgente(def, undefined, continuar && def.proveedor === 'claude')
  }

  // --------------------------------------------------------------- mensajes

  private encolar(id: string, texto: string): void {
    if (!this.def(id)) return
    this.cola(id).push(texto)
  }

  /** Mensaje del usuario a un agente: cola (se entrega cuando este libre) o guiar (se teclea ya). */
  private deUsuario(para: string, texto: string, modo: 'cola' | 'guiar'): void {
    const def = this.def(para)
    if (!def || !texto.trim()) throw new Error('Destino o mensaje inválido.')
    const msg = this.hive.nuevoMensaje(USUARIO, para, texto.trim())
    this.hive.guardarEnEntrada(msg)
    this.hive.commitDiferido('Mensaje del usuario')
    this.agregarMensaje(msg)
    const prompt = `Mensaje de Usuario: ${texto.trim()}`
    if (modo === 'guiar' && this.sesiones.activa(para)) {
      this.sesiones.escribirPrompt(para, prompt)
      this.bloqueoEntrega.set(para, Date.now() + MS_BLOQUEO_TRAS_ENTREGA)
    } else {
      this.encolar(para, prompt)
    }
    this.evento('mensaje', `Usuario → ${def.nombre}: ${resumir(texto, 70)}`, para)
  }

  private destinoEspecial(para: string): boolean {
    if (para === USUARIO) return true
    if (para.startsWith('fuera:')) return this.ajustesActuales.companeros.some((c) => `fuera:${c.id}` === para)
    return false
  }

  private procesarPendiente(p: PendienteDeEnvio): void {
    const m = p.mensaje
    const de = this.nombreDe(m.de)
    if (m.para === USUARIO) {
      this.hive.entregar(p)
      const pregunta = this.hive.crearPregunta(m.de, m.cuerpo)
      this.preguntas = [pregunta, ...this.preguntas]
      this.emitir('preguntas')
      this.agregarMensaje(m)
      this.evento('pregunta', `${de} pregunta: ${resumir(m.cuerpo, 70)}`, m.de)
      return
    }
    if (m.para.startsWith('fuera:')) {
      this.hive.entregar(p, false)
      this.agregarMensaje(m)
      void this.enviarAOtraOficina(m)
      return
    }
    this.hive.entregar(p)
    this.agregarMensaje(m)
    this.emit('sobre', m.de, m.para)
    this.encolar(m.para, `Mensaje de ${de}: ${m.cuerpo}`)
    this.evento('mensaje', `${de} → ${this.nombreDe(m.para)}: ${resumir(m.cuerpo, 70)}`, m.de)
  }

  private async enviarAOtraOficina(m: HiveMessage): Promise<void> {
    const companero = this.ajustesActuales.companeros.find((c) => `fuera:${c.id}` === m.para)
    if (!companero) return
    try {
      // En Ajustes se guarda la dirección base de su webhook (http://host:puerto).
      const destino = `${companero.url.replace(/\/+$/, '').replace(/\/mensaje$/, '')}/mensaje`
      const respuesta = await fetch(destino, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${companero.clave}` },
        body: JSON.stringify({ para: 'michael', texto: m.cuerpo, de: `${this.nombreDe(m.de)} (oficina de ${userInfo().username})` })
      })
      if (!respuesta.ok) throw new Error(`respondió ${respuesta.status}`)
      this.evento('mensaje', `${this.nombreDe(m.de)} → oficina de ${companero.nombre}: ${resumir(m.cuerpo, 60)}`, m.de)
    } catch (err) {
      this.evento('sistema', `No se pudo enviar a la oficina de ${companero.nombre}: ${(err as Error).message}`, m.de)
    }
  }

  private recibirExterno(para: string, texto: string, origen: string): { id?: string; error?: string } {
    const def = this.def(para)
    if (!def) return { error: `No hay ningún agente con id "${para}".` }
    const msg = this.hive.nuevoMensaje(origen, para, texto)
    this.hive.guardarEnEntrada(msg)
    this.hive.commitDiferido('Mensaje externo')
    this.agregarMensaje(msg)
    this.encolar(para, `Mensaje de ${origen} (externo): ${texto}`)
    this.evento('mensaje', `${origen} (externo) → ${def.nombre}: ${resumir(texto, 60)}`, para)
    return { id: msg.id }
  }

  private dispararHorario(h: Horario): void {
    const ajustes = this.ajustesActuales
    const horario = ajustes.horarios.find((x) => x.id === h.id)
    if (!horario) return
    horario.ultimo = Date.now()
    this.hive.guardarAjustes(ajustes)
    this.emitir('ajustes')
    this.evento('disparador', `Se disparó «${horario.nombre}»`, horario.para)
    if (horario.para === 'temporal') {
      try {
        this.temporales.crear(horario.prompt, this.raiz, '', `horario: ${horario.nombre}`)
      } catch (err) {
        this.evento('sistema', `«${horario.nombre}» no pudo crear un temporal: ${(err as Error).message}`)
      }
    } else if (horario.para === 'todos') {
      for (const d of this.defs) {
        if (this.sesiones.activa(d.id)) this.encolar(d.id, `Disparador «${horario.nombre}»: ${horario.prompt}`)
      }
    } else {
      this.encolar(horario.para, `Disparador «${horario.nombre}»: ${horario.prompt}`)
    }
  }

  // ----------------------------------------------------------------- equipo

  private guardarDefs(): void {
    guardarEquipo(this.raiz, this.defs)
    this.hive.registrar(this.defs)
    this.emitir('agentes')
  }

  private guardarAgente(agente: AgentDefinition, iniciar: boolean, anteriorId?: string): void {
    const limpio = normalizar({ ...agente }, this.raiz, agente.id === ID_MICHAEL)
    if (!limpio) throw new Error('El id debe tener solo minúsculas, números, - o _ (y no puede ser "michael").')
    const existente = this.defs.findIndex((d) => d.id === (anteriorId ?? limpio.id))
    if (anteriorId && anteriorId !== limpio.id) throw new Error('No se puede cambiar el id de un agente existente.')
    if (existente === -1 && this.def(limpio.id)) throw new Error(`Ya existe un agente con id "${limpio.id}".`)
    const otraConversacion = existente >= 0 && this.defs[existente].reanudar !== limpio.reanudar
    if (existente >= 0) {
      this.defs[existente] = limpio
      const rt = this.runtime(limpio.id)
      rt.ventana = ventanaDe(limpio.modelo)
      if (rt.limiteAlcanzado && (!limpio.limiteTokens || rt.tokens < limpio.limiteTokens)) rt.limiteAlcanzado = false
      this.evento('contratacion', `Se actualizó a ${limpio.nombre}`, limpio.id)
    } else {
      this.defs.push(limpio)
      this.evento('contratacion', `Se contrató a ${limpio.nombre} (${limpio.rol})`, limpio.id)
    }
    this.guardarDefs()
    if (!iniciar) {
      void this.biblioteca.asegurar(limpio.skills)
      return
    }
    // Si ya tenia sesion, se reinicia retomando la conversacion para que tome los cambios
    // (o con la conversación que acabas de elegir).
    if (this.sesiones.activa(limpio.id)) void this.reiniciar(limpio.id, !otraConversacion)
    else void this.iniciarAgente(limpio)
  }

  private eliminarAgente(id: string): void {
    const def = this.def(id)
    if (!def || def.esCoordinador) throw new Error('A Michael no se le puede despedir.')
    this.detenerAgente(id)
    this.defs = this.defs.filter((d) => d.id !== id)
    this.colas.delete(id)
    this.runtimes.delete(id)
    this.guardarDefs()
    this.evento('archivo', `${def.nombre} dejó la oficina`, id)
  }

  // ----------------------------------------------------------------- skills

  private asignarSkills(id: string, skills: string[]): void {
    const i = this.defs.findIndex((d) => d.id === id)
    if (i === -1) throw new Error('Ese agente no existe.')
    const limpias = [...new Set(skills.filter((x) => NOMBRE_SKILL_VALIDO.test(x)))]
    const antes = this.defs[i].skills ?? []
    this.defs[i] = { ...this.defs[i], skills: limpias.length ? limpias : undefined }
    this.guardarDefs()
    const nuevas = limpias.filter((x) => !antes.includes(x))
    const quitadas = antes.filter((x) => !limpias.includes(x))
    const cambios = [nuevas.length ? `+ ${nuevas.join(', ')}` : '', quitadas.length ? `− ${quitadas.join(', ')}` : ''].filter(Boolean).join(' ')
    if (cambios) this.evento('contratacion', `Skills de ${this.defs[i].nombre}: ${cambios}`, id)
    void this.biblioteca.asegurar(nuevas)
  }

  /** Instala y asigna a cada agente las skills sugeridas para su puesto (sin quitarle las que ya tiene). */
  private async aplicarSugeridas(ids?: string[]): Promise<string> {
    const destino = this.defs.filter((d) => (!ids || ids.includes(d.id)) && d.proveedor === 'claude')
    const todas = [...new Set(destino.flatMap((d) => sugeridasPara(d.personaje)))]
    if (!todas.length) return 'Ninguno de esos agentes tiene skills sugeridas.'
    const instalado = await this.biblioteca.instalar(todas)
    for (const d of destino) {
      const sugeridas = sugeridasPara(d.personaje)
      if (sugeridas.length) this.asignarSkills(d.id, [...(d.skills ?? []), ...sugeridas])
    }
    return `${instalado} Asignadas a ${destino.length} agentes; se aplican cuando cada uno reinicie su sesión.`
  }

  // ---------------------------------------------------------------- tareas

  private guardarTarea(parcial: Partial<Tarea> & { titulo: string }): void {
    const titulo = parcial.titulo.trim()
    if (!titulo) throw new Error('La tarea necesita un título.')
    const previa = parcial.id ? this.tareas.find((t) => t.id === parcial.id) : undefined
    const ahora = Date.now()
    const tarea: Tarea = {
      id: previa?.id ?? slug(titulo),
      titulo,
      descripcion: parcial.descripcion ?? previa?.descripcion ?? '',
      estado: parcial.estado ?? previa?.estado ?? 'pendiente',
      dueno: parcial.dueno === undefined ? previa?.dueno : parcial.dueno || undefined,
      creadaPor: previa?.creadaPor ?? USUARIO,
      prioridad: parcial.prioridad ?? previa?.prioridad ?? 2,
      creada: previa?.creada ?? ahora,
      actualizada: ahora,
      archivada: parcial.archivada ?? previa?.archivada ?? false
    }
    this.hive.guardarTarea(tarea)
    this.hive.commitDiferido(`Tarea: ${tarea.titulo}`)
    this.tareas = this.hive.listarTareas()
    this.emitir('tareas')
    if (!previa) this.evento('tarea', `Nueva tarea: ${titulo}`, tarea.dueno)
    else if (previa.estado !== tarea.estado) this.evento('tarea', `«${titulo}» pasó a ${tarea.estado.replace('_', ' ')}`, tarea.dueno)
    // Si el usuario le asigna la tarea a alguien, se le avisa.
    if (tarea.dueno && tarea.dueno !== previa?.dueno && this.def(tarea.dueno)) {
      this.encolar(
        tarea.dueno,
        `Mensaje de Usuario: te asigné la tarea «${titulo}» (id ${tarea.id}). ${tarea.descripcion} Actualiza su estado en el tablero cuando avances.`
      )
    }
  }

  // ---------------------------------------------------------------- ajustes

  private guardarAjustes(cambios: Partial<Ajustes>): void {
    const siguiente: Ajustes = { ...this.ajustesActuales, ...cambios }
    // Un horario recien activado espera un intervalo completo antes de dispararse.
    siguiente.horarios = siguiente.horarios.map((h) => {
      const antes = this.ajustesActuales.horarios.find((x) => x.id === h.id)
      return h.activo && (!antes?.activo || !h.ultimo) ? { ...h, ultimo: Date.now() } : h
    })
    if (cambios.modoPermisos && cambios.modoPermisos !== this.ajustesActuales.modoPermisos) {
      this.evento('sistema', `Modo de permisos: ${cambios.modoPermisos} (se aplica a las sesiones nuevas)`)
    }
    if (cambios.motores) guardarPreferencias({ motores: siguiente.motores })
    this.ajustesActuales = siguiente
    this.hive.guardarAjustes(siguiente)
    this.disparadores.aplicar()
    this.emitir('ajustes')
  }

  // ------------------------------------------------------------- manifiestos

  private async generarManifiesto(descripcion: string): Promise<AgentDefinition> {
    const personajes = REPARTO.map((p) => p.id).join(', ')
    const prompt = `Diseña un agente para una oficina de agentes IA a partir de esta descripción: "${descripcion}".
Responde SOLO con un objeto JSON, sin texto alrededor, con estas claves:
{"id": "minusculas-sin-espacios", "nombre": "Nombre Apellido", "rol": "puesto corto", "personalidad": "una o dos frases", "descripcion": "de qué se encarga", "objetivo": "qué debe lograr", "personaje": "uno de: ${personajes}", "color": "#rrggbb"}
Todo en español.`
    const entorno = { ...process.env }
    delete entorno.CLAUDECODE
    const salida = await new Promise<string>((resolve, reject) => {
      execFile('claude', ['-p', prompt], { cwd: this.raiz, env: entorno, timeout: 180_000, maxBuffer: 1024 * 1024 }, (err, stdout) =>
        err ? reject(new Error(`claude -p falló: ${err.message}`)) : resolve(stdout)
      )
    })
    const json = salida.match(/\{[\s\S]*\}/)?.[0]
    if (!json) throw new Error('La respuesta no traía un JSON de agente.')
    const crudo = JSON.parse(json) as Partial<AgentDefinition>
    let id = (crudo.id ?? crudo.nombre ?? 'agente').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_-]+/g, '-').slice(0, 30) || 'agente'
    while (this.def(id) || id === ID_MICHAEL) id = `${id}-${randomUUID().slice(0, 3)}`
    const def = normalizar({ ...crudo, id }, this.raiz)
    if (!def) throw new Error('El agente generado no es válido.')
    return def
  }

  private async importarManifiesto(): Promise<AgentDefinition | null> {
    const ventana = this.ventana()
    const opciones = { title: 'Importar agente', filters: [{ name: 'Manifiesto de agente', extensions: ['json'] }], properties: ['openFile' as const] }
    const r = ventana ? await dialog.showOpenDialog(ventana, opciones) : await dialog.showOpenDialog(opciones)
    if (r.canceled || !r.filePaths[0]) return null
    const crudo = JSON.parse(readFileSync(r.filePaths[0], 'utf-8')) as Partial<AgentDefinition>
    return normalizar({ ...crudo, id: crudo.id ?? basename(r.filePaths[0], '.json') }, this.raiz)
  }

  private async exportarManifiesto(agente: AgentDefinition): Promise<string | null> {
    const ventana = this.ventana()
    const opciones = { title: 'Exportar agente', defaultPath: `${agente.id}.json`, filters: [{ name: 'Manifiesto de agente', extensions: ['json'] }] }
    const r = ventana ? await dialog.showSaveDialog(ventana, opciones) : await dialog.showSaveDialog(opciones)
    if (r.canceled || !r.filePath) return null
    const { esCoordinador: _c, reanudar: _r, ...exportable } = agente
    writeFileSync(r.filePath, JSON.stringify(exportable, null, 2))
    return r.filePath
  }

  private async abrirEnIde(cwd: string): Promise<void> {
    const editor = ['code', 'cursor', 'codium'].find((e) => enPath(e))
    if (editor) {
      spawn(editor, [cwd], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' }).unref()
      return
    }
    await shell.openPath(cwd)
  }

  // ------------------------------------------------------------ acciones

  async ejecutar(a: Accion): Promise<unknown> {
    switch (a.tipo) {
      case 'agente:iniciar': {
        const def = this.def(a.id)
        if (def) {
          this.errores.delete(def.id)
          await this.iniciarAgente(def)
        }
        return
      }
      case 'agente:detener':
        this.colas.set(a.id, [])
        return this.detenerAgente(a.id)
      case 'agente:reiniciar':
        return this.reiniciar(a.id, a.continuar)
      case 'agente:pausar':
        if (this.sesiones.pausar(a.id)) this.evento('sesion', `${this.nombreDe(a.id)} quedó en pausa`, a.id)
        return
      case 'agente:reanudar':
        if (this.sesiones.reanudar(a.id)) this.evento('sesion', `${this.nombreDe(a.id)} siguió trabajando`, a.id)
        return
      case 'agente:interrumpir':
        this.sesiones.interrumpir(a.id)
        return
      case 'agente:enviar':
        return this.deUsuario(a.id, a.texto, a.modo)
      case 'agente:guardar':
        return this.guardarAgente(a.agente, a.iniciar, a.anteriorId)
      case 'agente:eliminar':
        return this.eliminarAgente(a.id)
      case 'agente:nota': {
        const def = this.def(a.id)
        if (def) {
          def.nota = a.nota.trim() || undefined
          this.guardarDefs()
        }
        return
      }
      case 'agente:limite': {
        const def = this.def(a.id)
        if (def) {
          def.limiteTokens = a.limite && a.limite > 0 ? a.limite : undefined
          const rt = this.runtime(def.id)
          if (!def.limiteTokens || rt.tokens < def.limiteTokens) rt.limiteAlcanzado = false
          this.guardarDefs()
        }
        return
      }
      case 'agente:motor': {
        const def = this.def(a.id)
        if (!def) return
        def.proveedor = a.proveedor
        def.modelo = a.modelo
        this.runtime(def.id).ventana = ventanaDe(a.modelo)
        this.guardarDefs()
        this.evento('sistema', `${def.nombre} ahora usa ${proveedorDe(a.proveedor).nombre}${a.modelo ? ` · ${a.modelo}` : ''}`, def.id)
        if (a.reiniciar && this.sesiones.activa(def.id)) await this.reiniciar(def.id, true)
        return
      }
      case 'agente:ide':
      case 'agente:abrir': {
        const def = this.def(a.id)
        if (!def) return
        const cwd = this.runtime(def.id).cwdReal ?? def.cwd
        if (a.tipo === 'agente:ide') await this.abrirEnIde(cwd)
        else await shell.openPath(cwd)
        return
      }
      case 'agente:git': {
        const def = this.def(a.id)
        return estadoGit(def ? (this.runtime(def.id).cwdReal ?? def.cwd) : this.raiz)
      }
      case 'agente:trazas':
        return this.seguidores.get(a.id)?.listaTrazas() ?? []
      case 'agente:mensajes':
        return this.hive.mensajesDe(a.id)
      case 'agente:comando': {
        const def = this.def(a.id)
        if (!def) return ''
        const rt = this.runtime(def.id)
        const plugin = def.skills?.length ? '<plugin con sus skills>' : undefined
        const args = this.argumentos(def, undefined, rt.sesionId ?? '<id de sesión>', false, plugin).map((x) =>
          x.length > 120 ? '<instrucciones de minioffice>' : x
        )
        return unirComando([comandoBase(def, this.ajustesActuales.modoPermisos)[0], ...args])
      }
      case 'terminal:historial':
        return this.sesiones.historial(a.id)
      case 'equipo:iniciarTodos':
        for (const def of this.defs) await this.iniciarAgente(def)
        return
      case 'equipo:detenerTodos':
        for (const def of this.defs) if (!def.esCoordinador) this.detenerAgente(def.id)
        return
      case 'equipo:difundir':
        for (const def of this.defs) if (!def.esCoordinador) this.deUsuario(def.id, a.texto, a.modo)
        return
      case 'michael:despachar': {
        const dueno = a.dueno ? this.def(a.dueno) : undefined
        const texto = `Tarea nueva: ${a.texto.trim()}\n${dueno ? `Dueño sugerido: ${dueno.nombre} (${dueno.id}).` : 'Decide tú quién la hace.'} Divídela, escribe la tarjeta en el tablero y asígnala.`
        return this.deUsuario(ID_MICHAEL, texto, 'cola')
      }
      case 'ajustes:guardar':
        return this.guardarAjustes(a.ajustes)
      case 'tarea:guardar':
        return this.guardarTarea(a.tarea)
      case 'tarea:eliminar':
        this.hive.eliminarTarea(a.id)
        this.hive.commitDiferido('Eliminar tarea')
        this.tareas = this.hive.listarTareas()
        this.emitir('tareas')
        return
      case 'pregunta:responder': {
        const p = this.hive.responderPregunta(a.id, a.respuesta.trim())
        if (!p) throw new Error('La pregunta ya no existe.')
        this.preguntas = this.hive.listarPreguntas()
        this.emitir('preguntas')
        this.evento('pregunta', `Respondiste a ${this.nombreDe(p.de)}: ${resumir(a.respuesta, 60)}`, p.de)
        if (this.def(p.de)) this.deUsuario(p.de, `Respuesta a tu pregunta «${resumir(p.pregunta, 90)}»: ${a.respuesta.trim()}`, 'cola')
        return
      }
      case 'pregunta:descartar':
        this.hive.eliminarPregunta(a.id)
        this.preguntas = this.hive.listarPreguntas()
        this.emitir('preguntas')
        return
      case 'horario:disparar': {
        const h = this.ajustesActuales.horarios.find((x) => x.id === a.id)
        if (h) this.dispararHorario(h)
        return
      }
      case 'memoria:buscar':
        return this.hive.buscar(a.consulta, a.agentes, a.tipos, this.defs)
      case 'pizarra:leer':
        return this.hive.leerTexto(this.hive.rutaPizarra)
      case 'pizarra:guardar':
        this.hive.guardarPizarra(a.texto)
        this.hive.commitDiferido('Editar pizarra')
        this.evento('sistema', 'Se editó la pizarra')
        return
      case 'memoria:leer':
        return this.hive.leerTexto(this.hive.rutaMemoria(a.id))
      case 'temporal:crear': {
        const t = this.temporales.crear(a.prompt, a.cwd || this.raiz, a.modelo, USUARIO)
        this.evento('temporal', `Nuevo temporal: ${resumir(a.prompt, 60)}`)
        return t
      }
      case 'temporal:cancelar':
        return this.temporales.cancelar(a.id)
      case 'temporal:limpiar':
        return this.temporales.limpiar()
      case 'dialogo:carpeta': {
        const ventana = this.ventana()
        const opciones = { title: 'Elegir carpeta de trabajo', defaultPath: a.inicial, properties: ['openDirectory' as const, 'createDirectory' as const] }
        const r = ventana ? await dialog.showOpenDialog(ventana, opciones) : await dialog.showOpenDialog(opciones)
        return r.canceled ? null : (r.filePaths[0] ?? null)
      }
      case 'dialogo:archivos': {
        const ventana = this.ventana()
        const opciones = { title: 'Adjuntar archivos', properties: ['openFile' as const, 'multiSelections' as const] }
        const r = ventana ? await dialog.showOpenDialog(ventana, opciones) : await dialog.showOpenDialog(opciones)
        return r.canceled ? [] : r.filePaths
      }
      case 'manifiesto:importar':
        return this.importarManifiesto()
      case 'manifiesto:exportar':
        return this.exportarManifiesto(a.agente)
      case 'manifiesto:generar':
        return this.generarManifiesto(a.descripcion)
      case 'proyectos':
        return [...new Set([this.raiz, ...this.defs.map((d) => d.cwd)])]
      case 'webhook:info':
        return this.disparadores.info()
      case 'consumo:historial':
        return this.consumo.historial(a.desde)
      case 'skills:listar':
        return this.biblioteca.listar()
      case 'skills:instalar': {
        const r = await this.biblioteca.instalar(a.nombres)
        this.evento('sistema', r)
        return r
      }
      case 'skills:desinstalar':
        this.biblioteca.desinstalar(a.nombre)
        this.evento('sistema', `Se quitó la skill ${a.nombre} de la biblioteca`)
        return
      case 'skills:asignar':
        return this.asignarSkills(a.id, a.skills)
      case 'skills:sugeridas':
        return this.aplicarSugeridas(a.agentes)
      case 'skills:explicar':
        return this.biblioteca.explicar(a.nombre)
      default:
        return this.ejecutarExtra(a)
    }
  }

  /** Acciones de capacidades y grapadora; las registra index.ts. */
  ejecutarExtra: (a: Accion) => Promise<unknown> = async (a) => {
    throw new Error(`Acción no disponible: ${a.tipo}`)
  }

  // --------------------------------------------------------------- terminal

  escribirTerminal(id: string, data: string): void {
    this.sesiones.escribir(id, data)
  }

  redimensionarTerminal(id: string, cols: number, rows: number): void {
    this.sesiones.redimensionar(id, cols, rows)
  }

  equipo(): AgentDefinition[] {
    return this.defs
  }

  ajustes(): Ajustes {
    return this.ajustesActuales
  }

  /** Para la grapadora: deja un mensaje del usuario a un agente. */
  mensajeDeUsuario(para: string, texto: string): void {
    this.deUsuario(para, texto, 'cola')
  }

  registrarEvento(tipo: TipoEvento, texto: string, agente?: string): void {
    this.evento(tipo, texto, agente)
  }
}
