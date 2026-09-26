import { execFile } from 'node:child_process'
import { app, BrowserWindow, dialog, screen, shell } from 'electron'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { IPC } from '../shared/ipc-channels'
import type { Accion } from '../shared/acciones'
import { ID_MICHAEL } from '../shared/reparto'
import { Oficina } from './oficina'
import { registrarIpc } from './ipc'
import { Capacidades, motoresInstalados } from './capacidades'
import { Grapadora } from './grapadora'
import { carpetaDelProyecto, heredarPathDeLaShell, pedirCarpeta, reabrirEn, recordarProyecto } from './entorno'
import { Dictado, registrarEsquemaModelos } from './dictado'
import { bloquearDepuracionExterna, endurecer, urlDesarrollo } from './seguridad'
import { listarConversaciones, listarProyectosClaude } from './claudeProyectos'
import { recordarConfianza, revisarConfianza, type Decision } from './confianza'
import { Actualizaciones, PAGINA_DESCARGAS } from './actualizaciones'
import { avisarErroresEn, iniciarRegistro } from './registro'

const GUIA_CLAUDE = 'https://code.claude.com/docs/en/setup'

bloquearDepuracionExterna()
iniciarRegistro()
// Dictado: los modelos de Whisper llegan por modelos:// y usan varios hilos (SharedArrayBuffer).
registrarEsquemaModelos()
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer')

// Una sola oficina a la vez: dos escribirían el mismo .hive y pelearían por el puerto del webhook.
const unica = app.requestSingleInstanceLock()
if (!unica) app.quit()

let ventanaPrincipal: BrowserWindow | null = null
let oficina: Oficina
let capacidades: Capacidades
let grapadora: Grapadora
let dictado: Dictado
const actualizaciones = new Actualizaciones((a) => oficina?.actualizarSistema({ actualizacion: a }))
const preload = join(__dirname, '../preload/index.js')

function urlRenderer(pagina: string): { url?: string; archivo?: string } {
  const dev = urlDesarrollo()
  return dev ? { url: `${dev}/${pagina}` } : { archivo: join(__dirname, '../renderer', pagina) }
}

function montar(raiz: string, modoSeguro: boolean): void {
  oficina = new Oficina(raiz, () => ventanaPrincipal, modoSeguro)
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
    case 'motores:instalados':
      return motoresInstalados()
    case 'dictado:estado':
      return dictado.estado()
    case 'dictado:ajustes':
      return dictado.guardarAjustes(a.ajustes)
    case 'dictado:borrar':
      return dictado.borrar(a.modelo)
    case 'dictado:preparado':
      return dictado.preparado(a.modelo)
    case 'dictado:permiso':
      return dictado.permiso()
    case 'dictado:privacidad':
      return dictado.abrirPrivacidad()
    case 'claude:proyectos':
      return listarProyectosClaude()
    case 'claude:conversaciones':
      return listarConversaciones(a.cwd)
    case 'proyecto:abrir': {
      if (!existsSync(a.ruta) || !statSync(a.ruta).isDirectory()) throw new Error('Esa carpeta ya no existe.')
      if (a.ruta !== oficina.raiz) reabrirEn(a.ruta)
      return
    }
    case 'proyecto:cambiar': {
      const ruta = await pedirCarpeta('Abrir otro proyecto', oficina.raiz)
      if (ruta && ruta !== oficina.raiz) reabrirEn(ruta)
      return
    }
    // Solo direcciones fijas: la interfaz no decide qué se abre en el navegador.
    case 'sistema:abrir':
      return shell.openExternal(a.destino === 'claude' ? GUIA_CLAUDE : (oficina.sistemaActual().actualizacion?.url ?? PAGINA_DESCARGAS))
    case 'sistema:instalarGit':
      // Abre el instalador de Apple de las herramientas de línea de comandos (trae git).
      execFile('/usr/bin/xcode-select', ['--install'], () => undefined)
      return
    default:
      throw new Error(`Acción no disponible: ${a.tipo}`)
  }
}

let recargas: number[] = []

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
  // Si la interfaz se cae (memoria, GPU…), se recarga en vez de quedar en blanco; no más de 3 veces por minuto.
  ventana.webContents.on('render-process-gone', (_e, detalles) => {
    console.error('La interfaz se cerró:', detalles.reason, detalles.exitCode)
    if (detalles.reason === 'clean-exit' || ventana.isDestroyed()) return
    recargas = recargas.filter((t) => Date.now() - t < 60_000)
    if (recargas.length >= 3) return
    recargas.push(Date.now())
    ventana.webContents.reload()
  })

  const destino = urlRenderer('index.html')
  if (destino.url) await ventana.loadURL(destino.url)
  else await ventana.loadFile(destino.archivo!)
}

async function noAbrio(raiz: string, motivo: string): Promise<string | null> {
  const r = await dialog.showMessageBox({
    type: 'error',
    message: 'minioffice no pudo abrir el proyecto',
    detail: `${raiz}\n\n${motivo}`,
    buttons: ['Elegir otra carpeta', 'Salir'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  })
  return r.response === 0 ? pedirCarpeta('Abrir otro proyecto') : null
}

app.whenReady().then(async () => {
  if (!unica) return
  endurecer()
  // El PATH de tu shell se lee mientras se abre el proyecto (hace falta para lanzar los agentes).
  const pathListo = app.isPackaged ? heredarPathDeLaShell() : Promise.resolve()
  dictado = new Dictado()
  dictado.iniciar()

  // Si el proyecto no abre (o cancelas el aviso de confianza), puedes elegir otro sin quedarte atascado.
  let raiz = await carpetaDelProyecto()
  let decision: Decision = 'normal'
  for (;;) {
    if (!raiz) {
      app.quit()
      return
    }
    decision = await revisarConfianza(raiz)
    if (decision === 'cancelar') {
      raiz = await pedirCarpeta('Abrir otro proyecto')
      continue
    }
    try {
      montar(raiz, decision === 'seguro')
      break
    } catch (err) {
      console.error('No se pudo abrir el proyecto', raiz, err)
      raiz = await noAbrio(raiz, (err as Error).message)
    }
  }
  // Lo que minioffice acaba de crear o completar en el proyecto es de confianza.
  if (decision === 'normal') recordarConfianza(raiz)
  recordarProyecto(raiz)

  avisarErroresEn((texto) => oficina.registrarEvento('sistema', texto))
  registrarIpc(oficina, (v) => !grapadora.esVentana(v))
  await pathListo
  await oficina.iniciar()
  await crearVentana()
  grapadora.iniciar()
  actualizaciones.iniciar()

  // macOS: la app sigue viva sin ventanas y se reabre desde el dock.
  app.on('activate', () => {
    if (!ventanaPrincipal) void crearVentana()
  })
})

app.on('second-instance', () => {
  if (oficina) enfocar()
})

app.on('child-process-gone', (_e, detalles) => {
  if (detalles.reason !== 'clean-exit') console.error('Proceso de Chromium caído:', detalles.type, detalles.reason)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  actualizaciones.detener()
  grapadora?.cerrar()
  oficina?.apagar()
})
