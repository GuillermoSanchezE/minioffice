import type { HiveStore, PendienteDeEnvio } from './hiveStore'

const INTERVALO_MS = 500

/**
 * Revisa la bandeja de salida de cada agente y le pasa cada mensaje valido a
 * `procesar`, que decide que hacer con el (entregarlo, convertirlo en pregunta
 * para el usuario, reenviarlo a otra oficina). Es el unico que hace commit de
 * los envios, asi no hay carreras en el hive.
 */
export class MailboxRouter {
  private temporizador: NodeJS.Timeout | null = null
  private revisando = false

  constructor(
    private hive: HiveStore,
    private ids: () => string[],
    private destinoValido: (para: string) => boolean,
    private procesar: (pendiente: PendienteDeEnvio) => void
  ) {}

  iniciar(): void {
    if (this.temporizador) return
    this.temporizador = setInterval(() => void this.revisar(), INTERVALO_MS)
  }

  detener(): void {
    if (this.temporizador) clearInterval(this.temporizador)
    this.temporizador = null
  }

  private async revisar(): Promise<void> {
    // El commit es asincrono; sin este candado dos ciclos podrian solaparse.
    if (this.revisando) return
    this.revisando = true
    try {
      let procesados = 0
      for (const id of this.ids()) {
        for (const pendiente of this.hive.listarPendientesDeEnvio(id, this.destinoValido)) {
          this.procesar(pendiente)
          procesados++
        }
      }
      if (procesados > 0) await this.hive.commit(`Entregar ${procesados} mensaje(s)`)
    } catch (err) {
      console.error('Error en el router de buzones:', err)
    } finally {
      this.revisando = false
    }
  }
}
