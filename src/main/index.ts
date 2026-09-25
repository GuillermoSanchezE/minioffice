import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { cargarConfig } from './config'
import { HiveStore } from './hive/hiveStore'
import { MailboxRouter } from './hive/mailboxRouter'
import { PtyManager } from './pty/ptyManager'
import { registrarIpc } from './ipc/handlers'

const raizProyecto = process.cwd()
const { agentes } = cargarConfig(raizProyecto)
const hive = new HiveStore(raizProyecto)
const router = new MailboxRouter(hive, agentes)
const ptyManager = new PtyManager()

async function crearVentana(): Promise<void> {
  const ventana = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'minioffice',
    backgroundColor: '#0f1218',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  ventana.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (process.env['ELECTRON_RENDERER_URL']) {
    await ventana.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await ventana.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await hive.inicializar(agentes)
  router.iniciar()
  registrarIpc({ agentes, hive, router, ptyManager })
  await crearVentana()

  // macOS: la app sigue viva sin ventanas y se reabre desde el dock.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void crearVentana()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  router.detener()
  ptyManager.detenerTodo()
})
