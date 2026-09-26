import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import type { ModoPermisos, Temporal } from '../shared/types'
import { proveedorDe } from '../shared/motores'

const MAX_SALIDA = 200_000
const MAX_LISTA = 40

/**
 * Trabajadores temporales: una ejecucion de `claude -p` que corre hasta
 * terminar, deja su respuesta y desaparece. No ocupan escritorio.
 * Evento: 'cambio' (Temporal[]).
 */
export class Temporales extends EventEmitter {
  private lista: Temporal[] = []
  private procesos = new Map<string, ChildProcess>()
  private avisoPendiente: NodeJS.Timeout | null = null

  constructor(
    private maximo: () => number,
    private modoPermisos: () => ModoPermisos,
    /** Lanza un error si en esa carpeta no se puede usar `claude -p`. */
    private comprobarCarpeta: (cwd: string) => void
  ) {
    super()
  }

  todos(): Temporal[] {
    return this.lista
  }

  corriendo(): number {
    return this.lista.filter((t) => t.estado === 'corriendo').length
  }

  crear(prompt: string, cwd: string, modelo: string, origen: string): Temporal {
    if (!prompt.trim()) throw new Error('El temporal necesita una instrucción.')
    if (!existsSync(cwd)) throw new Error(`La carpeta ${cwd} no existe.`)
    this.comprobarCarpeta(cwd)
    if (this.corriendo() >= this.maximo()) {
      throw new Error(`Ya hay ${this.corriendo()} temporales trabajando (máximo ${this.maximo()}).`)
    }
    const claude = proveedorDe('claude')
    const args = ['-p', prompt]
    if (modelo) args.push(...claude.argsModelo!(modelo))
    args.push(...(claude.argsPermisos?.[this.modoPermisos()] ?? []))

    const temporal: Temporal = {
      id: randomUUID(),
      prompt,
      cwd,
      modelo,
      estado: 'corriendo',
      salida: '',
      inicio: Date.now(),
      origen
    }
    const entorno = { ...process.env }
    delete entorno.CLAUDECODE
    const proceso = spawn('claude', args, { cwd, env: entorno, stdio: ['ignore', 'pipe', 'pipe'] })
    this.procesos.set(temporal.id, proceso)
    const agregar = (trozo: Buffer): void => {
      temporal.salida = (temporal.salida + trozo.toString('utf-8')).slice(-MAX_SALIDA)
      this.avisarPronto()
    }
    proceso.stdout?.on('data', agregar)
    proceso.stderr?.on('data', agregar)
    proceso.on('error', (err) => {
      temporal.estado = 'error'
      temporal.salida += `\n[minioffice] No se pudo ejecutar claude: ${err.message}`
      temporal.fin = Date.now()
      this.procesos.delete(temporal.id)
      this.avisar()
    })
    proceso.on('close', (codigo) => {
      if (temporal.estado === 'corriendo') temporal.estado = codigo === 0 ? 'hecho' : 'error'
      temporal.fin = Date.now()
      this.procesos.delete(temporal.id)
      this.avisar()
      this.emit('terminado', temporal)
    })

    this.lista = [temporal, ...this.lista].slice(0, MAX_LISTA)
    this.avisar()
    return temporal
  }

  cancelar(id: string): void {
    const t = this.lista.find((x) => x.id === id)
    const proceso = this.procesos.get(id)
    if (!t || !proceso) return
    t.estado = 'cancelado'
    proceso.kill()
  }

  limpiar(): void {
    this.lista = this.lista.filter((t) => t.estado === 'corriendo')
    this.avisar()
  }

  detenerTodo(): void {
    for (const p of this.procesos.values()) p.kill()
  }

  private avisar(): void {
    if (this.avisoPendiente) clearTimeout(this.avisoPendiente)
    this.avisoPendiente = null
    this.emit('cambio', [...this.lista])
  }

  /** La salida llega a trozos: se agrupa para no reenviar la lista entera en cada uno. */
  private avisarPronto(): void {
    if (this.avisoPendiente) return
    this.avisoPendiente = setTimeout(() => this.avisar(), 300)
  }
}
