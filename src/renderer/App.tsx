import { useEffect, useMemo, useState } from 'react'
import type { AgenteConEstado } from '../shared/api'
import type { HiveMessage } from '../shared/types'
import { PisoOficina } from './components/PisoOficina'
import { ListaAgentes } from './components/ListaAgentes'
import { PanelTerminal } from './components/PanelTerminal'
import { ChatMichael } from './components/ChatMichael'

export function App(): JSX.Element {
  const [agentes, setAgentes] = useState<AgenteConEstado[]>([])
  const [mensajes, setMensajes] = useState<HiveMessage[]>([])
  const [seleccionado, setSeleccionado] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true

    Promise.all([window.minioffice.listarAgentes(), window.minioffice.historialHive()]).then(
      ([lista, historial]) => {
        if (!vigente) return
        setAgentes(lista)
        setMensajes((previos) => fusionar(historial, previos))
        setSeleccionado((actual) => actual ?? lista.find((a) => !a.esCoordinador)?.id ?? null)
      }
    )

    const dejarEstado = window.minioffice.onEstado((agentId, estado) => {
      setAgentes((previos) => previos.map((a) => (a.id === agentId ? { ...a, estado } : a)))
    })
    const dejarMensajes = window.minioffice.onMensajeHive((msg) => {
      setMensajes((previos) => fusionar(previos, [msg]))
    })

    return () => {
      vigente = false
      dejarEstado()
      dejarMensajes()
    }
  }, [])

  const agenteSeleccionado = agentes.find((a) => a.id === seleccionado)
  const trabajando = useMemo(() => agentes.filter((a) => a.estado === 'trabajando').length, [agentes])
  const conectados = useMemo(
    () => agentes.filter((a) => !a.esCoordinador && a.estado !== 'detenido').length,
    [agentes]
  )

  return (
    <div className="app">
      <header className="barra-superior">
        <div className="marca">
          <span className="marca-logo">mo</span>
          <div>
            <h1>minioffice</h1>
            <span className="texto-suave">Tu oficina de agentes</span>
          </div>
        </div>
        <div className="resumen texto-suave">
          {conectados} en su escritorio · {trabajando} trabajando · {mensajes.length} mensajes
        </div>
      </header>

      <main className="contenido">
        <div className="columna-izquierda">
          <section className="panel panel-oficina">
            <PisoOficina agentes={agentes} seleccionado={seleccionado} onSeleccionar={setSeleccionado} />
          </section>
          <ChatMichael agentes={agentes} mensajes={mensajes} />
        </div>

        <div className="columna-derecha">
          <section className="panel panel-equipo">
            <header className="panel-cabecera">
              <h2>Equipo</h2>
            </header>
            <ListaAgentes agentes={agentes} seleccionado={seleccionado} onSeleccionar={setSeleccionado} />
          </section>

          {agenteSeleccionado && !agenteSeleccionado.esCoordinador ? (
            <PanelTerminal agente={agenteSeleccionado} />
          ) : (
            <section className="panel panel-info">
              <h2>Michael, el coordinador</h2>
              <p>
                Michael no tiene terminal propia: recibe tus tareas en el chat y las deja en el buzón del agente
                indicado. Si el agente está en la sala de descanso, Michael le abre una sesión de Claude Code con la
                tarea ya escrita.
              </p>
              <p>
                Los agentes le contestan escribiendo en su buzón de salida dentro de <code>.hive/</code>. Todo queda
                versionado con git: memoria, pizarra y mensajes.
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

function fusionar(a: HiveMessage[], b: HiveMessage[]): HiveMessage[] {
  const porId = new Map<string, HiveMessage>()
  for (const msg of [...a, ...b]) porId.set(msg.id, msg)
  return [...porId.values()].sort((x, y) => x.creadoEn - y.creadoEn)
}
