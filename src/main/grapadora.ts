import { BrowserWindow, desktopCapturer, nativeImage, screen } from 'electron'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AjustesGrapadora, Captura } from '../shared/acciones'

export const AJUSTES_GRAPADORA: AjustesGrapadora = {
  visible: false,
  semilla: 'scranton',
  forma: 0,
  expresion: 0,
  tamano: 72,
  color: '#d9a441',
  opacidad: 100,
  acciones: ['captura', 'captura-michael', 'pedir', 'abrir', 'preguntas', 'ocultar']
}

const LADO_MENU = 280
const MARGEN = 12
const ARCHIVO = /^captura-[\w-]+\.png$/

export interface Anfitrion {
  hiveRaiz: string
  leer(): AjustesGrapadora | null
  guardar(a: AjustesGrapadora): void
  mensaje(para: string, texto: string): void
  evento(texto: string): void
  urlRenderer(pagina: string): { url?: string; archivo?: string }
  preload: string
}

/**
 * La grapadora: una criatura que flota sobre todas las apps. Un clic abre su
 * menu (capturas, pedirle algo a Michael, volver a la oficina).
 */
export class Grapadora {
  private ventana: BrowserWindow | null = null
  private ajustesActuales: AjustesGrapadora

  constructor(private anfitrion: Anfitrion) {
    this.ajustesActuales = { ...AJUSTES_GRAPADORA, ...(anfitrion.leer() ?? {}) }
  }

  get carpeta(): string {
    return join(this.anfitrion.hiveRaiz, 'capturas')
  }

  ajustes(): AjustesGrapadora {
    return this.ajustesActuales
  }

  iniciar(): void {
    if (this.ajustesActuales.visible) this.mostrar()
  }

  guardarAjustes(a: AjustesGrapadora): void {
    const antes = this.ajustesActuales
    this.ajustesActuales = { ...AJUSTES_GRAPADORA, ...a, tamano: Math.min(160, Math.max(40, Math.round(a.tamano))) }
    this.anfitrion.guardar(this.ajustesActuales)
    if (this.ajustesActuales.visible) {
      this.mostrar()
      if (antes.tamano !== this.ajustesActuales.tamano) this.menu(false)
    } else this.cerrar()
  }

  visible(v: boolean): void {
    this.guardarAjustes({ ...this.ajustesActuales, visible: v })
  }

  private ladoCerrado(): number {
    return this.ajustesActuales.tamano + MARGEN * 2
  }

  private mostrar(): void {
    if (this.ventana && !this.ventana.isDestroyed()) {
      this.ventana.showInactive()
      return
    }
    const area = screen.getPrimaryDisplay().workArea
    const lado = this.ladoCerrado()
    const v = new BrowserWindow({
      width: lado,
      height: lado,
      x: area.x + area.width - lado - 24,
      y: area.y + area.height - lado - 24,
      frame: false,
      transparent: true,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      focusable: true,
      show: false,
      title: 'Grapadora',
      webPreferences: { preload: this.anfitrion.preload, sandbox: true }
    })
    v.setAlwaysOnTop(true, 'floating')
    v.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    v.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    v.once('ready-to-show', () => v.showInactive())
    v.on('closed', () => {
      if (this.ventana === v) this.ventana = null
    })
    const destino = this.anfitrion.urlRenderer('grapadora.html')
    if (destino.url) void v.loadURL(destino.url)
    else if (destino.archivo) void v.loadFile(destino.archivo)
    this.ventana = v
  }

  cerrar(): void {
    if (this.ventana && !this.ventana.isDestroyed()) this.ventana.destroy()
    this.ventana = null
  }

  esVentana(v: BrowserWindow): boolean {
    return v === this.ventana
  }

  mover(dx: number, dy: number): void {
    const v = this.ventana
    if (!v || v.isDestroyed()) return
    const [x, y] = v.getPosition()
    v.setPosition(Math.round(x + dx), Math.round(y + dy))
  }

  /** Agranda la ventana alrededor de la criatura para que quepa el menu, sin moverla. */
  menu(abierto: boolean): void {
    const v = this.ventana
    if (!v || v.isDestroyed()) return
    const b = v.getBounds()
    const centroX = b.x + b.width / 2
    const centroY = b.y + b.height / 2
    const lado = abierto ? Math.max(LADO_MENU, this.ladoCerrado() + 160) : this.ladoCerrado()
    const area = screen.getDisplayNearestPoint({ x: Math.round(centroX), y: Math.round(centroY) }).workArea
    const x = Math.min(Math.max(area.x, Math.round(centroX - lado / 2)), area.x + area.width - lado)
    const y = Math.min(Math.max(area.y, Math.round(centroY - lado / 2)), area.y + area.height - lado)
    v.setBounds({ x, y, width: lado, height: lado })
    if (abierto) v.focus()
  }

  async capturar(enviarA?: string): Promise<string | null> {
    const v = this.ventana && !this.ventana.isDestroyed() ? this.ventana : null
    const estabaVisible = !!v?.isVisible()
    if (v && estabaVisible) {
      this.menu(false)
      v.hide()
      await new Promise((r) => setTimeout(r, 220))
    }
    try {
      const pantalla = screen.getPrimaryDisplay()
      const fuentes = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.round(pantalla.size.width * pantalla.scaleFactor),
          height: Math.round(pantalla.size.height * pantalla.scaleFactor)
        }
      })
      const fuente = fuentes.find((f) => f.display_id === String(pantalla.id)) ?? fuentes[0]
      if (!fuente || fuente.thumbnail.isEmpty()) throw new Error('No se pudo capturar la pantalla (¿falta permiso de grabación?).')
      mkdirSync(this.carpeta, { recursive: true })
      const ignorar = join(this.carpeta, '.gitignore')
      if (!existsSync(ignorar)) writeFileSync(ignorar, '*\n')
      const sello = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
      const ruta = join(this.carpeta, `captura-${sello}.png`)
      writeFileSync(ruta, fuente.thumbnail.toPNG())
      this.anfitrion.evento(`Captura guardada: ${ruta}`)
      if (enviarA) {
        this.anfitrion.mensaje(enviarA, `Te dejo una captura de mi pantalla: ${ruta}\nÁbrela con tu herramienta para leer archivos (es una imagen PNG) y dime qué ves o qué hay que hacer.`)
      }
      return ruta
    } finally {
      if (v && estabaVisible && !v.isDestroyed()) v.showInactive()
    }
  }

  capturas(): Captura[] {
    if (!existsSync(this.carpeta)) return []
    return readdirSync(this.carpeta)
      .filter((f) => ARCHIVO.test(f))
      .map((archivo) => {
        const ruta = join(this.carpeta, archivo)
        return { archivo, ruta, creada: statSync(ruta).mtimeMs }
      })
      .sort((a, b) => b.creada - a.creada)
      .slice(0, 48)
      .map((c) => {
        const img = nativeImage.createFromPath(c.ruta)
        return { ...c, miniatura: img.isEmpty() ? '' : img.resize({ width: 320 }).toDataURL() }
      })
  }

  borrarCaptura(archivo: string): void {
    if (!ARCHIVO.test(archivo)) throw new Error('Nombre de captura inválido.')
    const ruta = join(this.carpeta, archivo)
    if (existsSync(ruta)) unlinkSync(ruta)
  }
}
