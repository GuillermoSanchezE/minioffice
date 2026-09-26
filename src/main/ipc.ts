import { BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { esUrlPropia } from './seguridad'
import { IPC } from '../shared/ipc-channels'
import type { Accion } from '../shared/acciones'
import type { Parche, PtyOutputPayload } from '../shared/types'
import type { Oficina } from './oficina'

function difundir(canal: string, args: unknown[], filtro?: (v: BrowserWindow) => boolean): void {
  for (const ventana of BrowserWindow.getAllWindows()) {
    if (!ventana.isDestroyed() && (!filtro || filtro(ventana))) ventana.webContents.send(canal, ...args)
  }
}

/** `soloOficina` deja fuera ventanas ligeras (la grapadora) del trafico pesado de terminales. */
export function registrarIpc(oficina: Oficina, soloOficina: (v: BrowserWindow) => boolean): void {
  oficina.on('parche', (parche: Parche) => difundir(IPC.parche, [parche]))
  oficina.on('salida', (payload: PtyOutputPayload) => difundir(IPC.ptySalida, [payload], soloOficina))
  oficina.on('sobre', (de: string, para: string) => difundir(IPC.sobre, [de, para], soloOficina))

  // Solo las páginas de minioffice le dan órdenes a la oficina.
  const propio = (evt: IpcMainEvent | IpcMainInvokeEvent): boolean => esUrlPropia(evt.senderFrame?.url)
  const rechazar = (): never => {
    throw new Error('Remitente no permitido.')
  }
  ipcMain.handle(IPC.estado, (evt) => (propio(evt) ? oficina.instantanea() : rechazar()))
  ipcMain.handle(IPC.accion, (evt, accion: Accion) => (propio(evt) ? oficina.ejecutar(accion) : rechazar()))
  ipcMain.on(IPC.ptyEntrada, (evt, agentId: string, data: string) => {
    if (propio(evt)) oficina.escribirTerminal(agentId, data)
  })
  ipcMain.on(IPC.ptyTamano, (evt, agentId: string, cols: number, rows: number) => {
    if (propio(evt)) oficina.redimensionarTerminal(agentId, cols, rows)
  })
}
