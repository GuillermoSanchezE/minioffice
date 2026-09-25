import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { MiniofficeApi } from '../shared/api'
import type { AgentStatus, HiveMessage, PtyOutputPayload } from '../shared/types'

const api: MiniofficeApi = {
  listarAgentes: () => ipcRenderer.invoke(IPC.agentsList),
  iniciarAgente: (agentId) => ipcRenderer.invoke(IPC.agentStart, agentId),
  detenerAgente: (agentId) => ipcRenderer.invoke(IPC.agentStop, agentId),
  enviarEntrada: (agentId, data) => ipcRenderer.send(IPC.agentInput, agentId, data),
  redimensionar: (agentId, cols, rows) => ipcRenderer.send(IPC.agentResize, agentId, cols, rows),
  onSalida: (cb) => {
    const listener = (_evt: unknown, payload: PtyOutputPayload): void => cb(payload)
    ipcRenderer.on(IPC.agentOutput, listener)
    return () => ipcRenderer.removeListener(IPC.agentOutput, listener)
  },
  onEstado: (cb) => {
    const listener = (_evt: unknown, payload: { agentId: string; estado: AgentStatus }): void =>
      cb(payload.agentId, payload.estado)
    ipcRenderer.on(IPC.agentStatus, listener)
    return () => ipcRenderer.removeListener(IPC.agentStatus, listener)
  },
  historialHive: () => ipcRenderer.invoke(IPC.hiveHistory),
  onMensajeHive: (cb) => {
    const listener = (_evt: unknown, msg: HiveMessage): void => cb(msg)
    ipcRenderer.on(IPC.hiveMessage, listener)
    return () => ipcRenderer.removeListener(IPC.hiveMessage, listener)
  },
  asignarMichael: (paraAgentId, texto) => ipcRenderer.invoke(IPC.michaelAssign, paraAgentId, texto)
}

contextBridge.exposeInMainWorld('minioffice', api)
