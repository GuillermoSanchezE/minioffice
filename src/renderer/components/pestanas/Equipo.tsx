import { useState } from 'react'
import type { Agente } from '../../../shared/types'
import { MODELOS_CLAUDE, proveedorDe } from '../../../shared/motores'
import { accion, intentar, useAgentes, useOficina } from '../../tienda'
import { cambiarUi, seleccionar } from '../../ui'
import { dinero, tokens } from '../../formato'
import { Barra, ChipEstado, Icono, Modal, Retrato } from '../basicos'
import { ChipsSkills } from '../SelectorSkills'

export function nombreModelo(a: Agente): string {
  if (a.proveedor !== 'claude') return a.modelo ? `${proveedorDe(a.proveedor).nombre} · ${a.modelo}` : proveedorDe(a.proveedor).nombre
  const real = a.rt.modeloReal ?? a.modelo
  return MODELOS_CLAUDE.find((m) => m.id === real || m.id === a.modelo)?.nombre ?? (real || 'Predeterminado')
}

export function PestanaEquipo(): JSX.Element {
  const agentes = useAgentes()
  const tareas = useOficina((e) => e.tareas) ?? []
  const preguntas = useOficina((e) => e.preguntas) ?? []
  const temporales = useOficina((e) => e.temporales) ?? []
  const [busqueda, setBusqueda] = useState('')
  const [texto, setTexto] = useState('')
  const [prompt, setPrompt] = useState<Agente | null>(null)

  const michael = agentes.find((a) => a.esCoordinador)
  const resto = agentes.filter((a) => !a.esCoordinador && `${a.nombre} ${a.rol}`.toLowerCase().includes(busqueda.toLowerCase()))
  const costo = agentes.reduce((s, a) => s + a.rt.costo, 0)
  const enCurso = tareas.filter((t) => !t.archivada && t.estado === 'en_curso').length
  const bloqueadas = tareas.filter((t) => !t.archivada && t.estado === 'bloqueada').length
  const esperando = preguntas.filter((p) => !p.respuesta).length
  const frenados = agentes.filter((a) => a.rt.limiteAlcanzado || a.rt.estado === 'error')

  async function enviarAMichael(): Promise<void> {
    if (!michael || !texto.trim()) return
    if (await intentar({ tipo: 'agente:enviar', id: michael.id, texto, modo: 'cola' })) setTexto('')
  }

  return (
    <div className="pestana-contenido equipo">
      <div className="barra-herramientas">
        <strong className="pixel">Agentes</strong>
        <span className="suave pequeno">
          {agentes.length} agentes · {temporales.filter((t) => t.estado === 'corriendo').length} temporales
        </span>
        <span className="espaciador" />
        <div className="buscador">
          <Icono nombre="buscar" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar agentes" />
        </div>
        <button className="boton" onClick={() => cambiarUi({ pestana: 'capacidades' })}>
          Capacidades
        </button>
        <button className="boton boton-mostaza" onClick={() => cambiarUi({ asistente: 'nuevo' })}>
          <Icono nombre="mas" /> Agregar agente
        </button>
      </div>

      {michael && (
        <section className="tarjeta-jefe">
          <div className="fila">
            <Retrato personaje={michael.personaje} tamano={30} />
            <strong>{michael.nombre}</strong>
            <span className="insignia-jefe">jefe</span>
            <span className="suave pequeno">{nombreModelo(michael)}</span>
            <span className="espaciador" />
            <ChipEstado estado={michael.rt.estado} />
          </div>
          <p className="suave">{michael.rol} — reparte el trabajo, sigue el tablero y solo te escala lo que de verdad necesita de ti.</p>
          <div className="resumen-jefe">
            <div className="dato">
              <span className="pixel etiqueta-seccion">Gasto de hoy</span>
              <span>
                <strong className="grande">{dinero(costo)}</strong> <span className="suave pequeno">estimado a precio de API</span>
              </span>
            </div>
            <div className="dato">
              <span className="pixel etiqueta-seccion">Frenos</span>
              <span>
                <strong className="grande">{frenados.length === 0 ? '—' : frenados.length}</strong>{' '}
                <span className="suave pequeno">{frenados.length === 0 ? 'nadie frenado' : frenados.map((a) => a.nombre.split(' ')[0]).join(', ')}</span>
              </span>
            </div>
            <div className="dato">
              <span className="pixel etiqueta-seccion">Tareas</span>
              <span>
                <strong className="grande">{enCurso}</strong> <span className="suave pequeno">en curso · {bloqueadas} bloqueadas</span>
              </span>
            </div>
            <button className="dato dato-boton" onClick={() => cambiarUi({ pestana: 'preguntas' })}>
              <span className="pixel etiqueta-seccion">Esperándote</span>
              <span>
                <strong className="grande">{esperando}</strong> <span className="suave pequeno">preguntas</span>
              </span>
            </button>
          </div>
          <div className="entrada-envio">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void enviarAMichael()}
              placeholder="Pídele algo a Michael…"
            />
            <button className="boton boton-mostaza" disabled={!texto.trim()} onClick={() => void enviarAMichael()}>
              <Icono nombre="enviar" /> Enviar
            </button>
          </div>
        </section>
      )}

      <div className="rejilla-agentes">
        {resto.map((a) => (
          <TarjetaAgente key={a.id} agente={a} tarea={tareas.find((t) => t.dueno === a.id && t.estado === 'en_curso' && !t.archivada)?.titulo} onPrompt={() => setPrompt(a)} />
        ))}
      </div>

      {prompt && <DialogoPrompt agente={prompt} onCerrar={() => setPrompt(null)} />}
    </div>
  )
}

function TarjetaAgente({ agente: a, tarea, onPrompt }: { agente: Agente; tarea?: string; onPrompt: () => void }): JSX.Element {
  const rt = a.rt
  const pct = Math.round((rt.contexto / Math.max(1, rt.ventana)) * 100)
  const ultimo = rt.herramienta ? `${rt.herramienta}${rt.detalleHerramienta ? ` ${rt.detalleHerramienta}` : ''}` : rt.ultimoTexto
  return (
    <article className="tarjeta-agente-equipo">
      <div className="fila">
        <button className="enlace-agente" onClick={() => seleccionar(a.id)}>
          <Retrato personaje={a.personaje} tamano={40} />
        </button>
        <div className="crece">
          <strong>{a.nombre.split(' ')[0]}</strong>
          <div className="suave pequeno recorte">{nombreModelo(a)} · {a.rol}</div>
        </div>
        <ChipEstado estado={rt.estado} />
      </div>
      <button className="enlace-skills" onClick={() => cambiarUi({ seleccionado: null, pestana: 'capacidades', skillsDe: a.id })} title="Elegir skills">
        {a.skills?.length ? <ChipsSkills skills={a.skills} max={3} /> : <span className="suave pequeno">+ skills</span>}
      </button>
      <div className="tarea-actual mono pequeno recorte">{tarea ?? (rt.pendientes > 0 ? `${rt.pendientes} mensajes en cola` : 'sin tarea asignada')}</div>
      <span className="pixel etiqueta-seccion">Terminal</span>
      <pre className="terminal-mini">{rt.estado === 'detenido' ? 'zZz… (sin sesión)' : (ultimo ?? '…').slice(-240)}</pre>
      <div className="fila">
        <span className="suave pequeno">Contexto</span>
        <Barra valor={rt.contexto} max={rt.ventana} />
        <span className="mono pequeno">{pct}%</span>
      </div>
      <div className="fila">
        <span className="mono pequeno ficha">{tokens(rt.tokens)} tok</span>
        <span className="espaciador" />
        {rt.estado === 'detenido' ? (
          <button className="boton" onClick={() => void accion({ tipo: 'agente:iniciar', id: a.id })}>
            <Icono nombre="play" /> Iniciar
          </button>
        ) : null}
        <button className="boton" onClick={onPrompt}>
          Prompt
        </button>
      </div>
    </article>
  )
}

function DialogoPrompt({ agente, onCerrar }: { agente: Agente; onCerrar: () => void }): JSX.Element {
  const [texto, setTexto] = useState('')
  const [modo, setModo] = useState<'cola' | 'guiar'>('cola')
  async function enviar(): Promise<void> {
    if (await intentar({ tipo: 'agente:enviar', id: agente.id, texto, modo })) onCerrar()
  }
  return (
    <Modal
      titulo={`Prompt para ${agente.nombre}`}
      onCerrar={onCerrar}
      ancho={560}
      pie={
        <>
          <div className="segmentado">
            <button className={modo === 'cola' ? 'activo' : ''} onClick={() => setModo('cola')}>
              en cola
            </button>
            <button className={modo === 'guiar' ? 'activo' : ''} onClick={() => setModo('guiar')}>
              guiar
            </button>
          </div>
          <span className="espaciador" />
          <button className="boton" onClick={onCerrar}>
            cancelar
          </button>
          <button className="boton boton-mostaza" disabled={!texto.trim()} onClick={() => void enviar()}>
            <Icono nombre="enviar" /> Enviar
          </button>
        </>
      }
    >
      <textarea
        autoFocus
        rows={6}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void enviar()
        }}
        placeholder={agente.rt.estado === 'detenido' ? 'Se inicia su sesión con este mensaje.' : 'Se entrega cuando quede libre.'}
      />
    </Modal>
  )
}
