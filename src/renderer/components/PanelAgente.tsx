import { useCallback, useEffect, useState } from 'react'
import type { Agente, EstadoGit, HiveMessage, Traza } from '../../shared/types'
import { accion, intentar, useAgentes } from '../tienda'
import { cambiarUi, seleccionar } from '../ui'
import { carpeta, hace, hora, tokens } from '../formato'
import { Barra, ChipEstado, Icono, Retrato, Vacio } from './basicos'
import { VistaTerminal } from './VistaTerminal'
import { Cola } from './Cola'

type Vista = 'terminal' | 'git' | 'mensajes' | 'trazas'

export function PanelAgente({ agente }: { agente: Agente }): JSX.Element {
  const [vista, setVista] = useState<Vista>('terminal')
  const [guia, setGuia] = useState('')
  const rt = agente.rt
  const activa = rt.estado !== 'detenido' && rt.estado !== 'error'

  useEffect(() => setVista('terminal'), [agente.id])

  async function guiar(): Promise<void> {
    if (!guia.trim()) return
    if (await intentar({ tipo: 'agente:enviar', id: agente.id, texto: guia, modo: 'guiar' })) setGuia('')
  }

  return (
    <div className="panel-agente">
      <header className="panel-cabecera">
        <Retrato personaje={agente.personaje} tamano={40} />
        <div className="cabecera-datos">
          <h2 className="pixel">{agente.nombre}</h2>
          <div className="fila">
            <ChipEstado estado={rt.estado} />
            <span className="suave mono" title={rt.cwdReal ?? agente.cwd}>
              {carpeta(rt.cwdReal ?? agente.cwd)}
            </span>
            {agente.nota && <span className="nota">“{agente.nota}”</span>}
          </div>
        </div>
        <div className="cabecera-botones">
          <button className="boton" onClick={() => void accion({ tipo: 'agente:ide', id: agente.id })} title="Abrir la carpeta en tu editor">
            <Icono nombre="codigo" /> IDE
          </button>
          <button className="boton" onClick={() => void accion({ tipo: 'agente:abrir', id: agente.id })} title="Abrir la carpeta">
            <Icono nombre="carpeta" /> abrir
          </button>
          <button className="boton" onClick={() => cambiarUi({ asistente: agente })} title="Editar">
            <Icono nombre="lapiz" />
          </button>
          <button className="boton boton-cerrar" onClick={() => seleccionar(null)} aria-label="Volver al centro de mando">
            <Icono nombre="cerrar" />
          </button>
        </div>
      </header>

      <section className="control">
        <span className="pixel etiqueta-seccion">Control</span>
        {activa ? (
          <>
            {rt.estado === 'pausado' ? (
              <button className="boton" onClick={() => void accion({ tipo: 'agente:reanudar', id: agente.id })}>
                <Icono nombre="play" /> reanudar
              </button>
            ) : (
              <button className="boton" onClick={() => void accion({ tipo: 'agente:pausar', id: agente.id })} title="Congela el proceso">
                <Icono nombre="pausa" /> pausar
              </button>
            )}
            <button className="boton" onClick={() => void accion({ tipo: 'agente:interrumpir', id: agente.id })} title="Tecla Esc: corta el paso actual">
              <Icono nombre="escape" /> interrumpir
            </button>
            <button className="boton" onClick={() => void accion({ tipo: 'agente:reiniciar', id: agente.id, continuar: true })} title="Reinicia la sesión y continúa la conversación">
              <Icono nombre="recargar" /> reiniciar
            </button>
            <button className="boton boton-peligro" onClick={() => void accion({ tipo: 'agente:detener', id: agente.id })}>
              <Icono nombre="stop" /> detener
            </button>
          </>
        ) : (
          <button className="boton boton-oscuro" onClick={() => void accion({ tipo: 'agente:iniciar', id: agente.id })}>
            <Icono nombre="play" /> iniciar sesión
          </button>
        )}
        <span className="espaciador" />
        <span className="suave pequeno mono" title="Contexto usado">
          ctx {tokens(rt.contexto)}/{tokens(rt.ventana)}
        </span>
        <span className="mini-barra">
          <Barra valor={rt.contexto} max={rt.ventana} />
        </span>
      </section>

      <div className="guiar">
        <input
          value={guia}
          onChange={(e) => setGuia(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void guiar()}
          placeholder={`Guía a ${agente.nombre.split(' ')[0]}: se le envía ya, aunque esté trabajando…`}
        />
        <button className="boton boton-mostaza" onClick={() => void guiar()} disabled={!guia.trim()}>
          guiar
        </button>
      </div>

      <nav className="subpestanas">
        {(['terminal', 'git', 'mensajes', 'trazas'] as Vista[]).map((v) => (
          <button key={v} className={`subpestana ${vista === v ? 'activa' : ''}`} onClick={() => setVista(v)}>
            <Icono nombre={v === 'terminal' ? 'terminal' : v === 'git' ? 'codigo' : v === 'mensajes' ? 'bandeja' : 'actividad'} />
            {v}
          </button>
        ))}
      </nav>

      <div className="panel-contenido">
        {vista === 'terminal' && <VistaTerminal agente={agente} />}
        {vista === 'git' && <VistaGit agente={agente} />}
        {vista === 'mensajes' && <VistaMensajes agente={agente} />}
        {vista === 'trazas' && <VistaTrazas agente={agente} />}
      </div>

      <Cola agente={agente} />
    </div>
  )
}

function useRecargable<T>(cargar: () => Promise<T | undefined>, deps: unknown[], cadaMs = 0): [T | undefined, () => void] {
  const [datos, setDatos] = useState<T>()
  const recargar = useCallback(() => {
    void cargar().then((d) => d !== undefined && setDatos(d))
  }, deps)
  useEffect(() => {
    recargar()
    if (!cadaMs) return
    const t = setInterval(recargar, cadaMs)
    return () => clearInterval(t)
  }, [recargar, cadaMs])
  return [datos, recargar]
}

function VistaGit({ agente }: { agente: Agente }): JSX.Element {
  const [git, recargar] = useRecargable<EstadoGit>(() => accion({ tipo: 'agente:git', id: agente.id }), [agente.id], 5000)
  if (!git) return <Vacio>Leyendo git…</Vacio>
  if (!git.esRepo) return <Vacio>{git.error ?? 'La carpeta de este agente no es un repositorio git.'}</Vacio>
  return (
    <div className="vista-git">
      <div className="fila">
        <span className="pixel etiqueta-seccion">Rama</span>
        <span className="mono">{git.rama}</span>
        <span className="espaciador" />
        <button className="boton" onClick={recargar}>
          <Icono nombre="recargar" /> actualizar
        </button>
      </div>
      <h4 className="pixel">Cambios ({git.cambios.length})</h4>
      {git.cambios.length === 0 ? (
        <p className="suave">Sin cambios sin commitear.</p>
      ) : (
        <pre className="bloque-mono">{git.cambios.join('\n')}</pre>
      )}
      {git.diffstat && <pre className="bloque-mono">{git.diffstat}</pre>}
      <h4 className="pixel">Últimos commits</h4>
      <pre className="bloque-mono">{git.log.join('\n') || 'Sin commits.'}</pre>
    </div>
  )
}

function VistaMensajes({ agente }: { agente: Agente }): JSX.Element {
  const agentes = useAgentes()
  const [mensajes] = useRecargable<HiveMessage[]>(() => accion({ tipo: 'agente:mensajes', id: agente.id }), [agente.id], 3000)
  const nombre = (id: string): string => (id === 'usuario' ? 'Tú' : (agentes.find((a) => a.id === id)?.nombre.split(' ')[0] ?? id))
  if (!mensajes) return <Vacio>Cargando…</Vacio>
  if (mensajes.length === 0) return <Vacio>Todavía no hay mensajes para {agente.nombre.split(' ')[0]}.</Vacio>
  return (
    <div className="lista-mensajes">
      {[...mensajes].reverse().map((m) => (
        <article key={m.id} className={`mensaje ${m.de === agente.id ? 'mensaje-saliente' : ''}`}>
          <div className="mensaje-meta">
            <strong>{nombre(m.de)}</strong>
            <span className="suave">→ {nombre(m.para)}</span>
            <time className="suave">{hora(m.creadoEn)}</time>
          </div>
          <p>{m.cuerpo}</p>
        </article>
      ))}
    </div>
  )
}

function VistaTrazas({ agente }: { agente: Agente }): JSX.Element {
  const [trazas] = useRecargable<Traza[]>(() => accion({ tipo: 'agente:trazas', id: agente.id }), [agente.id], 2000)
  if (agente.proveedor !== 'claude') return <Vacio>Las trazas se leen de la transcripción de Claude Code; este agente usa otra CLI.</Vacio>
  if (!trazas) return <Vacio>Cargando…</Vacio>
  if (trazas.length === 0) return <Vacio>Todavía no usó herramientas en esta sesión.</Vacio>
  return (
    <div className="lista-trazas">
      <p className="suave pequeno">
        {agente.rt.llamadas} llamadas · {tokens(agente.rt.tokens)} tokens · última {hace(trazas[0]?.ts)}
      </p>
      {trazas.map((t) => (
        <div key={t.id} className={`traza traza-${t.estado}`}>
          <span className="traza-estado" />
          <span className="traza-herramienta mono">{t.herramienta}</span>
          <span className="traza-detalle mono" title={t.detalle}>
            {t.detalle}
          </span>
          <time className="suave mono">{hora(t.ts)}</time>
        </div>
      ))}
    </div>
  )
}
