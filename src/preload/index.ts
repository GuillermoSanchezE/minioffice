import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { MiniofficeApi } from '../shared/api'
import type { Parche, PtyOutputPayload } from '../shared/types'

function escuchar<T extends unknown[]>(canal: string, cb: (...args: T) => void): () => void {
  const listener = (_evt: unknown, ...args: unknown[]): void => cb(...(args as T))
  ipcRenderer.on(canal, listener)
  return () => ipcRenderer.removeListener(canal, listener)
}

const api: MiniofficeApi = {
  estadoInicial: () => ipcRenderer.invoke(IPC.estado),
  onParche: (cb) => escuchar<[Parche]>(IPC.parche, cb),
  accion: (accion) => ipcRenderer.invoke(IPC.accion, accion),
  enviarEntrada: (agentId, data) => ipcRenderer.send(IPC.ptyEntrada, agentId, data),
  redimensionar: (agentId, cols, rows) => ipcRenderer.send(IPC.ptyTamano, agentId, cols, rows),
  onSalida: (cb) => escuchar<[PtyOutputPayload]>(IPC.ptySalida, cb),
  onSobre: (cb) => escuchar<[string, string]>(IPC.sobre, cb),
  onNavegar: (cb) => escuchar<[string]>(IPC.navegar, cb)
}

contextBridge.exposeInMainWorld('minioffice', api)
