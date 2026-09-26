import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { escribirAtomico } from './archivos'
import { join } from 'node:path'
import type { EstadoPlan, HoraConsumo, LimitePlan } from '../shared/types'
import type { UsoMensaje } from './transcripcion'

const HORA_MS = 3_600_000
const DIAS_GUARDADOS = 120

interface Archivo {
  v: 1
  /** Consumo por hora (clave: inicio de la hora en ms). */
  horas: Record<string, { agentes: Record<string, { tokens: number; costo: number }>; modelos: Record<string, number> }>
  /** Por sesión, hasta qué momento ya se contó (para no contar dos veces al retomar). */
  marcas: Record<string, number>
  plan?: EstadoPlan
}

function citarShell(ruta: string): string {
  return `'${ruta.replace(/'/g, `'\\''`)}'`
}

function limite(crudo: unknown): LimitePlan | undefined {
  if (!crudo || typeof crudo !== 'object') return undefined
  const o = crudo as { used_percentage?: unknown; resets_at?: unknown }
  const porcentaje = Number(o.used_percentage)
  const reinicio = Number(o.resets_at)
  if (!Number.isFinite(porcentaje)) return undefined
  return {
    porcentaje: Math.max(0, Math.min(100, porcentaje)),
    // Claude Code lo da en segundos desde 1970.
    reinicia: Number.isFinite(reinicio) && reinicio > 0 ? (reinicio < 1e12 ? reinicio * 1000 : reinicio) : 0
  }
}

/**
 * Lo que la oficina gasta: tokens y costo por hora, agente y modelo (leídos de
 * las transcripciones, con la hora real de cada mensaje) y el porcentaje usado
 * de tu plan de Claude, que Claude Code le pasa a su barra de estado.
 */
export class Consumo {
  readonly dir: string
  private archivo: string
  private datos: Archivo
  private contados = new Map<string, number>()
  private sucio = false

  constructor(hiveRaiz: string) {
    this.dir = join(hiveRaiz, 'uso')
    this.archivo = join(this.dir, 'consumo.json')
    mkdirSync(this.dir, { recursive: true })
    // Estado de tu máquina: fuera del historial git del hive.
    const ignorar = join(this.dir, '.gitignore')
    if (!existsSync(ignorar)) writeFileSync(ignorar, '*\n')
    this.datos = this.leer()
  }

  private leer(): Archivo {
    try {
      const d = JSON.parse(readFileSync(this.archivo, 'utf8')) as Archivo
      if (d.v === 1 && d.horas && d.marcas) return d
    } catch {
      // primera vez o archivo dañado
    }
    return { v: 1, horas: {}, marcas: {} }
  }

  /** Settings para la sesión: su barra de estado deja el JSON de Claude Code en uso/estado-<id>.json. */
  settings(agenteId: string): string {
    const destino = join(this.dir, `estado-${agenteId}.json`)
    const comando = `cat > ${citarShell(`${destino}.tmp`)} && mv -f ${citarShell(`${destino}.tmp`)} ${citarShell(destino)}`
    return JSON.stringify({ statusLine: { type: 'command', command: comando, padding: 0 } })
  }

  registrar(agenteId: string, sesionId: string, usos: UsoMensaje[]): void {
    if (!usos.length) return
    const marca = this.datos.marcas[sesionId] ?? 0
    let maximo = marca
    for (const u of usos) {
      if (u.ts <= marca) continue
      const clave = `${sesionId}:${u.id}`
      const previo = this.contados.get(clave) ?? 0
      const tokens = u.tokens - previo
      if (tokens <= 0) continue
      const costo = previo > 0 && u.tokens > 0 ? u.costo * (tokens / u.tokens) : u.costo
      this.contados.set(clave, u.tokens)
      const hora = String(Math.floor(u.ts / HORA_MS) * HORA_MS)
      const h = (this.datos.horas[hora] ??= { agentes: {}, modelos: {} })
      const a = (h.agentes[agenteId] ??= { tokens: 0, costo: 0 })
      a.tokens += tokens
      a.costo += costo
      const modelo = u.modelo ?? 'desconocido'
      h.modelos[modelo] = (h.modelos[modelo] ?? 0) + tokens
      maximo = Math.max(maximo, u.ts)
      this.sucio = true
    }
    if (maximo > marca) this.datos.marcas[sesionId] = maximo
  }

  /** El dato más reciente del plan que haya dejado cualquier sesión. */
  leerPlan(): EstadoPlan | null {
    let mejor: EstadoPlan | null = this.datos.plan ?? null
    let archivos: string[] = []
    try {
      archivos = readdirSync(this.dir).filter((f) => /^estado-.+\.json$/.test(f))
    } catch {
      return mejor
    }
    for (const f of archivos) {
      const ruta = join(this.dir, f)
      try {
        const actualizado = statSync(ruta).mtimeMs
        if (mejor && actualizado <= mejor.actualizado) continue
        const o = JSON.parse(readFileSync(ruta, 'utf8')) as { rate_limits?: Record<string, unknown> }
        const cincoHoras = limite(o.rate_limits?.['five_hour'])
        const semana = limite(o.rate_limits?.['seven_day'])
        if (!cincoHoras && !semana) continue
        mejor = { cincoHoras, semana, actualizado, agente: f.slice('estado-'.length, -'.json'.length) }
      } catch {
        // se está escribiendo justo ahora
      }
    }
    if (mejor && mejor !== this.datos.plan) {
      this.datos.plan = mejor
      this.sucio = true
    }
    return mejor
  }

  historial(desde: number): HoraConsumo[] {
    const lista: HoraConsumo[] = []
    for (const [clave, h] of Object.entries(this.datos.horas)) {
      const hora = Number(clave)
      if (hora < desde) continue
      const agentes: Record<string, number> = {}
      let tokens = 0
      let costo = 0
      for (const [id, v] of Object.entries(h.agentes)) {
        agentes[id] = v.tokens
        tokens += v.tokens
        costo += v.costo
      }
      lista.push({ hora, tokens, costo, agentes, modelos: { ...h.modelos } })
    }
    return lista.sort((a, b) => a.hora - b.hora)
  }

  guardar(): void {
    if (!this.sucio) return
    const limite = Date.now() - DIAS_GUARDADOS * 24 * HORA_MS
    for (const clave of Object.keys(this.datos.horas)) if (Number(clave) < limite) delete this.datos.horas[clave]
    for (const [sesion, ts] of Object.entries(this.datos.marcas)) if (ts < limite) delete this.datos.marcas[sesion]
    try {
      escribirAtomico(this.archivo, JSON.stringify(this.datos))
      this.sucio = false
    } catch (err) {
      // disco lleno: se reintenta en la próxima vuelta
      console.error('No se pudo guardar el consumo:', (err as Error).message)
    }
  }
}
