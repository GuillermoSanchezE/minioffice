import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { AgentDefinition, AgentStatus, HiveMessage } from '../../shared/types'
import type { HiveStore } from '../hive/hiveStore'
import type { MailboxRouter } from '../hive/mailboxRouter'
import type { PtyManager } from '../pty/ptyManager'
import { esClaude, instruccionesPara } from '../agents/instrucciones'
import { ID_MICHAEL } from '../config'

interface Dependencias {
  agentes: AgentDefinition[]
  hive: HiveStore
  router: MailboxRouter
  ptyManager: PtyManager
}

// Tiempo para que una CLI que no es Claude arranque antes de teclearle el prompt.
const MS_ARRANQUE_OTRAS_CLI = 1500

function difundir(canal: string, payload: unknown): void {
  for (const ventana of BrowserWindow.getAllWindows()) ventana.webContents.send(canal, payload)
}

export function registrarIpc({ agentes, hive, router, ptyManager }: Dependencias): void {
  const buscar = (id: string): AgentDefinition | undefined => agentes.find((a) => a.id === id)

  function argsDeArranque(agente: AgentDefinition, promptInicial?: string): string[] {
    if (!esClaude(agente)) return []
    const args = [
      '--append-system-prompt',
      instruccionesPara(agente, agentes, hive.raiz),
      '--add-dir',
      hive.raiz,
      '--name',
      `minioffice-${agente.id}`
    ]
    if (promptInicial) args.push(promptInicial)
    return args
  }

  function iniciar(agente: AgentDefinition, promptInicial?: string): void {
    ptyManager.iniciar(agente, argsDeArranque(agente, promptInicial))
    if (promptInicial && !esClaude(agente)) {
      setTimeout(() => ptyManager.escribirPrompt(agente.id, promptInicial), MS_ARRANQUE_OTRAS_CLI)
    }
  }

  ptyManager.on('salida', (agentId: string, data: string) => {
    difundir(IPC.agentOutput, { agentId, data })
  })

  ptyManager.on('estado', (agentId: string, estado: AgentStatus) => {
    difundir(IPC.agentStatus, { agentId, estado })
  })

  router.on('mensaje', (msg: HiveMessage) => {
    difundir(IPC.hiveMessage, msg)

    const destino = buscar(msg.para)
    if (!destino) return
    const remitente = buscar(msg.de)?.nombre ?? msg.de
    hive.agregarMemoria(destino.id, `Mensaje de ${remitente}: ${msg.cuerpo}`)

    // Michael no tiene terminal: sus mensajes solo se muestran en el chat.
    if (destino.esCoordinador) return
    const prompt = `Mensaje de ${remitente}: ${msg.cuerpo}`
    if (ptyManager.estaActivo(destino.id)) {
      ptyManager.escribirPrompt(destino.id, prompt)
    } else {
      iniciar(destino, prompt)
    }
  })

  ipcMain.handle(IPC.agentsList, () =>
    agentes.map((a) => ({
      ...a,
      estado: a.esCoordinador ? ('inactivo' satisfies AgentStatus) : ptyManager.estadoDe(a.id)
    }))
  )

  ipcMain.handle(IPC.agentStart, (_evt, agentId: string) => {
    const agente = buscar(agentId)
    if (agente) iniciar(agente)
  })

  ipcMain.handle(IPC.agentStop, (_evt, agentId: string) => {
    ptyManager.detener(agentId)
  })

  ipcMain.on(IPC.agentInput, (_evt, agentId: string, data: string) => {
    ptyManager.enviarEntrada(agentId, data)
  })

  ipcMain.on(IPC.agentResize, (_evt, agentId: string, cols: number, rows: number) => {
    ptyManager.redimensionar(agentId, cols, rows)
  })

  ipcMain.handle(IPC.hiveHistory, () => hive.historialCompleto())

  ipcMain.handle(IPC.michaelAssign, (_evt, paraAgentId: string, texto: string) => {
    const destino = buscar(paraAgentId)
    const cuerpo = typeof texto === 'string' ? texto.trim() : ''
    if (!destino || destino.esCoordinador || !cuerpo) {
      throw new Error('Destino o mensaje invalido')
    }
    return hive.depositarSaliente({ de: ID_MICHAEL, para: destino.id, cuerpo })
  })
}
