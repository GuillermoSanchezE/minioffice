import { BrowserWindow, ipcMain } from 'electron'
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

  ipcMain.handle(IPC.estado, () => oficina.instantanea())
  ipcMain.handle(IPC.accion, (_evt, accion: Accion) => oficina.ejecutar(accion))
  ipcMain.on(IPC.ptyEntrada, (_evt, agentId: string, data: string) => oficina.escribirTerminal(agentId, data))
  ipcMain.on(IPC.ptyTamano, (_evt, agentId: string, cols: number, rows: number) =>
    oficina.redimensionarTerminal(agentId, cols, rows)
  )
}
