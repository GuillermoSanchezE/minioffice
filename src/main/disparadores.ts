import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { timingSafeEqual } from 'node:crypto'
import type { Ajustes, Horario } from '../shared/types'
import type { InfoWebhook } from '../shared/acciones'

const INTERVALO_HORARIOS_MS = 15_000
const MAX_CUERPO = 64 * 1024

export interface Receptor {
  ajustes(): Ajustes
  dispararHorario(horario: Horario): void
  /** Devuelve el id del mensaje creado o un error. */
  recibirExterno(para: string, texto: string, origen: string): { id?: string; error?: string }
  resumenEquipo(): Array<{ id: string; nombre: string; estado: string }>
}

function igualSeguro(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Todo lo que puede poner a trabajar a la oficina sin que escribas: horarios
 * y un webhook local (con clave) para que otro sistema, o la oficina de un
 * compañero, envíe mensajes.
 */
export class Disparadores {
  private temporizador: NodeJS.Timeout | null = null
  private servidor: Server | null = null
  private configActual = ''

  constructor(private receptor: Receptor) {}

  iniciar(): void {
    this.temporizador = setInterval(() => {
      try {
        this.revisarHorarios()
      } catch (err) {
        console.error('Fallo al revisar los horarios:', err)
      }
    }, INTERVALO_HORARIOS_MS)
    this.aplicar()
  }

  detener(): void {
    if (this.temporizador) clearInterval(this.temporizador)
    this.servidor?.close()
    this.servidor = null
  }

  private revisarHorarios(): void {
    const ahora = Date.now()
    for (const horario of this.receptor.ajustes().horarios) {
      if (!horario.activo || horario.cadaMinutos <= 0) continue
      if (ahora - (horario.ultimo ?? ahora) >= horario.cadaMinutos * 60_000) this.receptor.dispararHorario(horario)
    }
  }

  /** Arranca, reinicia o apaga el servidor segun los ajustes. */
  aplicar(): void {
    const a = this.receptor.ajustes()
    const config = a.webhooks ? `${a.webhookPuerto}|${a.webhookRed}` : 'apagado'
    if (config === this.configActual) return
    this.configActual = config
    this.servidor?.close()
    this.servidor = null
    if (!a.webhooks) return
    const servidor = createServer((req, res) => void this.atender(req, res))
    servidor.on('error', (err) => console.error('Webhook de minioffice:', err.message))
    servidor.listen(a.webhookPuerto, a.webhookRed ? '0.0.0.0' : '127.0.0.1')
    this.servidor = servidor
  }

  info(): InfoWebhook {
    const a = this.receptor.ajustes()
    const hosts = ['127.0.0.1']
    if (a.webhookRed) {
      for (const lista of Object.values(networkInterfaces())) {
        for (const i of lista ?? []) if (i.family === 'IPv4' && !i.internal) hosts.push(i.address)
      }
    }
    return {
      activo: a.webhooks,
      urls: hosts.map((h) => `http://${h}:${a.webhookPuerto}`),
      clave: a.webhookClave,
      puerto: a.webhookPuerto
    }
  }

  private responder(res: ServerResponse, codigo: number, cuerpo: unknown): void {
    res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(cuerpo))
  }

  private async atender(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const clave = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    if (!clave || !igualSeguro(clave, this.receptor.ajustes().webhookClave)) {
      this.responder(res, 401, { ok: false, error: 'Falta la clave o no es correcta (Authorization: Bearer <clave>).' })
      return
    }
    if (req.method === 'GET' && url.pathname === '/estado') {
      this.responder(res, 200, { ok: true, agentes: this.receptor.resumenEquipo() })
      return
    }
    if (req.method !== 'POST' || url.pathname !== '/mensaje') {
      this.responder(res, 404, { ok: false, error: 'Usa POST /mensaje o GET /estado.' })
      return
    }
    let cuerpo = ''
    for await (const trozo of req) {
      cuerpo += trozo
      if (cuerpo.length > MAX_CUERPO) {
        this.responder(res, 413, { ok: false, error: 'Mensaje demasiado largo.' })
        return
      }
    }
    let datos: { para?: unknown; texto?: unknown; de?: unknown }
    try {
      datos = JSON.parse(cuerpo)
    } catch {
      this.responder(res, 400, { ok: false, error: 'El cuerpo debe ser JSON: {"texto": "...", "para": "michael"}' })
      return
    }
    const texto = typeof datos.texto === 'string' ? datos.texto.trim() : ''
    if (!texto) {
      this.responder(res, 400, { ok: false, error: 'Falta "texto".' })
      return
    }
    const para = typeof datos.para === 'string' && datos.para ? datos.para.toLowerCase() : 'michael'
    const origen = typeof datos.de === 'string' && datos.de.trim() ? datos.de.trim().slice(0, 80) : 'webhook'
    const resultado = this.receptor.recibirExterno(para, texto, origen)
    if (resultado.error) this.responder(res, 400, { ok: false, error: resultado.error })
    else this.responder(res, 202, { ok: true, id: resultado.id })
  }
}
