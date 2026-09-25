import { app, BrowserWindow, dialog, screen } from 'electron'
import { join } from 'node:path'
import { IPC } from '../shared/ipc-channels'
import type { Accion } from '../shared/acciones'
import { ID_MICHAEL } from '../shared/reparto'
import { Oficina } from './oficina'
import { registrarIpc } from './ipc'
import { Capacidades } from './capacidades'
import { Grapadora } from './grapadora'
import { carpetaDelProyecto, heredarPathDeLaShell, pedirCarpeta, reabrirEn, recordarProyecto } from './entorno'

let ventanaPrincipal: BrowserWindow | null = null
let oficina: Oficina
let capacidades: Capacidades
let grapadora: Grapadora
const preload = join(__dirname, '../preload/index.js')

function urlRenderer(pagina: string): { url?: string; archivo?: string } {
  const dev = process.env['ELECTRON_RENDERER_URL']
  return dev ? { url: `${dev}/${pagina}` } : { archivo: join(__dirname, '../renderer', pagina) }
}

function montar(raiz: string): void {
  oficina = new Oficina(raiz, () => ventanaPrincipal)
  capacidades = new Capacidades(() => oficina.equipo())
  grapadora = new Grapadora({
    hiveRaiz: oficina.hive.raiz,
    leer: () => oficina.hive.leerArchivoLibre('grapadora.json'),
    guardar: (a) => oficina.hive.guardarArchivoLibre('grapadora.json', a),
    mensaje: (para, texto) => oficina.mensajeDeUsuario(para, texto),
    evento: (texto) => oficina.registrarEvento('sistema', texto),
    urlRenderer,
    preload
  })
  oficina.ejecutarExtra = ejecutarExtra
}

function enfocar(pestana?: string): void {
  if (!ventanaPrincipal) {
    void crearVentana().then(() => pestana && ventanaPrincipal?.webContents.send(IPC.navegar, pestana))
    return
  }
  if (ventanaPrincipal.isMinimized()) ventanaPrincipal.restore()
  ventanaPrincipal.show()
  ventanaPrincipal.focus()
  if (pestana) ventanaPrincipal.webContents.send(IPC.navegar, pestana)
}

async function ejecutarExtra(a: Accion): Promise<unknown> {
  switch (a.tipo) {
    case 'capacidades:listar':
      return capacidades.listar()
    case 'capacidades:catalogo':
      return capacidades.catalogo()
    case 'capacidades:instalar': {
      const r = await capacidades.instalar(a.nombre, a.tipoCapacidad)
      oficina.registrarEvento('sistema', `Instalado ${a.nombre} (${a.tipoCapacidad})`)
      return r
    }
    case 'grapadora:captura':
      return grapadora.capturar(a.enviarA === 'michael' ? ID_MICHAEL : a.enviarA)
    case 'grapadora:capturas':
      return grapadora.capturas()
    case 'grapadora:borrarCaptura':
      return grapadora.borrarCaptura(a.archivo)
    case 'grapadora:visible':
      return grapadora.visible(a.visible)
    case 'grapadora:ajustes':
      return grapadora.guardarAjustes(a.ajustes)
    case 'grapadora:leerAjustes':
      return grapadora.ajustes()
    case 'grapadora:mover':
      return grapadora.mover(a.dx, a.dy)
    case 'grapadora:menu':
      return grapadora.menu(a.abierto)
    case 'ventana:enfocar':
      return enfocar(a.pestana)
    case 'proyecto:cambiar': {
      const ruta = await pedirCarpeta('Abrir otro proyecto', oficina.raiz)
      if (ruta && ruta !== oficina.raiz) reabrirEn(ruta)
      return
    }
    default:
      throw new Error(`Acción no disponible: ${a.tipo}`)
  }
}

async function crearVentana(): Promise<void> {
  const pantalla = screen.getPrimaryDisplay().workAreaSize
  const ventana = new BrowserWindow({
    width: Math.min(1600, pantalla.width),
    height: Math.min(1000, pantalla.height),
    minWidth: 1024,
    minHeight: 640,
    title: 'minioffice',
    backgroundColor: '#f6ecd9',
    autoHideMenuBar: true,
    webPreferences: { preload, sandbox: true }
  })
  ventanaPrincipal = ventana
  ventana.on('closed', () => {
    if (ventanaPrincipal !== ventana) return
    ventanaPrincipal = null
    // Sin la oficina, la grapadora no tiene a quien hablarle (salvo en macOS, donde la app sigue viva).
    if (process.platform !== 'darwin') grapadora.cerrar()
  })
  ventana.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  const destino = urlRenderer('index.html')
  if (destino.url) await ventana.loadURL(destino.url)
  else await ventana.loadFile(destino.archivo!)
}

app.whenReady().then(async () => {
  if (app.isPackaged) heredarPathDeLaShell()
  const raiz = await carpetaDelProyecto()
  if (!raiz) {
    app.quit()
    return
  }
  try {
    montar(raiz)
    recordarProyecto(raiz)
  } catch (err) {
    dialog.showErrorBox('minioffice no pudo abrir el proyecto', `${raiz}\n\n${(err as Error).message}`)
    app.quit()
    return
  }
  registrarIpc(oficina, (v) => !grapadora.esVentana(v))
  await oficina.iniciar()
  await crearVentana()
  grapadora.iniciar()

  // macOS: la app sigue viva sin ventanas y se reabre desde el dock.
  app.on('activate', () => {
    if (!ventanaPrincipal) void crearVentana()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  grapadora?.cerrar()
  oficina?.apagar()
})
