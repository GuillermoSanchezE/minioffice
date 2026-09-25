import { useEffect, useMemo, useState } from 'react'
import type { AgentDefinition, ProveedorId } from '../../shared/types'
import { MODELOS_CLAUDE, PROVEEDORES, comandoBase, partirComando, proveedorDe, unirComando } from '../../shared/motores'
import { REPARTO, ID_MICHAEL } from '../../shared/reparto'
import { PUESTOS, puestoDe } from '../../shared/skills'
import { accion, avisar, intentar, useAgentes, useOficina } from '../tienda'
import { cambiarUi, seleccionar } from '../ui'
import { carpeta } from '../formato'
import { Icono, Modal, Retrato } from './basicos'
import { ChipsSkills, SelectorSkills } from './SelectorSkills'

const COLORES = ['#d9534f', '#4f9d69', '#3c8a99', '#d9a441', '#8a6fd1', '#d98a5c']
const PASOS = ['Identidad', 'Espacio', 'Motor', 'Skills', 'Encargo'] as const

function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

function nuevoAgente(raiz: string, ocupados: string[]): AgentDefinition {
  const libre = REPARTO.find((p) => p.id !== ID_MICHAEL && !ocupados.includes(p.id))
  return {
    id: libre?.id ?? '',
    nombre: libre?.nombre ?? '',
    rol: libre ? (puestoDe(libre.id, libre.rol) ?? '') : '',
    personalidad: libre?.personalidad ?? '',
    personaje: libre?.id ?? 'darryl',
    color: COLORES[ocupados.length % COLORES.length],
    proveedor: 'claude',
    modelo: '',
    args: [],
    cwd: raiz
  }
}

export function Asistente({ inicial }: { inicial: AgentDefinition | 'nuevo' }): JSX.Element {
  const agentes = useAgentes()
  const raiz = useOficina((e) => e.raiz) ?? ''
  const modo = useOficina((e) => e.ajustes.modoPermisos) ?? 'auto'
  const esNuevo = inicial === 'nuevo'
  const [a, setA] = useState<AgentDefinition>(() =>
    inicial === 'nuevo' ? nuevoAgente(raiz, agentes.map((x) => x.id)) : { ...inicial, args: [...inicial.args] }
  )
  const [idTocado, setIdTocado] = useState(!esNuevo)
  const [paso, setPaso] = useState(0)
  const [iniciar, setIniciar] = useState(esNuevo)
  const [proyectos, setProyectos] = useState<string[]>([])
  const [argsTexto, setArgsTexto] = useState(() => unirComando(a.args))
  const [generando, setGenerando] = useState(false)
  const [descripcionIa, setDescripcionIa] = useState('')
  const [verIa, setVerIa] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [intentado, setIntentado] = useState(false)

  useEffect(() => {
    void accion({ tipo: 'proyectos' }).then((p) => p && setProyectos(p))
  }, [])

  const cambiar = (c: Partial<AgentDefinition>): void => setA((x) => ({ ...x, ...c }))
  const cerrar = (): void => cambiarUi({ asistente: null })

  const idOcupado = esNuevo && agentes.some((x) => x.id === a.id)
  const idValido = /^[a-z0-9][a-z0-9_-]*$/.test(a.id) && (a.id !== ID_MICHAEL || !esNuevo)
  const errores = [
    !a.nombre.trim() && 'Falta el nombre.',
    (!idValido || idOcupado) && (idOcupado ? 'Ese id ya existe.' : 'El id: minúsculas, números, - o _.'),
    !a.cwd.trim() && 'Falta la carpeta de trabajo.',
    a.proveedor === 'personalizado' && !a.comando?.trim() && 'Falta el comando del motor personalizado.'
  ].filter(Boolean) as string[]

  const vistaComando = useMemo(() => {
    try {
      return unirComando(comandoBase({ ...a, args: partirComando(argsTexto) }, modo))
    } catch {
      return ''
    }
  }, [a, argsTexto, modo])

  async function guardar(): Promise<void> {
    if (errores.length) {
      setIntentado(true)
      avisar(errores[0], 'error')
      return
    }
    setGuardando(true)
    const def: AgentDefinition = { ...a, nombre: a.nombre.trim(), rol: a.rol.trim(), args: partirComando(argsTexto) }
    const ok = await intentar({ tipo: 'agente:guardar', agente: def, iniciar, anteriorId: esNuevo ? undefined : (inicial as AgentDefinition).id })
    setGuardando(false)
    if (!ok) return
    avisar(esNuevo ? `${def.nombre} ya trabaja en la oficina` : 'Cambios guardados')
    cerrar()
    if (esNuevo) seleccionar(def.id)
  }

  async function importar(): Promise<void> {
    const def = await accion({ tipo: 'manifiesto:importar' })
    if (!def) return
    setA({ ...def, id: esNuevo ? def.id : a.id })
    setArgsTexto(unirComando(def.args))
    setIdTocado(true)
    avisar('Manifiesto cargado: revisa y guarda')
  }

  async function generar(): Promise<void> {
    if (!descripcionIa.trim()) return
    setGenerando(true)
    const def = await accion({ tipo: 'manifiesto:generar', descripcion: descripcionIa })
    setGenerando(false)
    if (!def) return
    setA((x) => ({ ...x, ...def, id: esNuevo ? def.id || x.id : x.id, cwd: def.cwd || x.cwd }))
    setArgsTexto(unirComando(def.args ?? []))
    setIdTocado(true)
    setVerIa(false)
    setPaso(0)
    avisar('Borrador listo: revisa cada paso')
  }

  const personajeElegido = REPARTO.find((p) => p.id === a.personaje)

  return (
    <Modal
      titulo={esNuevo ? 'Contratar un agente' : `Editar a ${a.nombre.split(' ')[0] || 'agente'}`}
      onCerrar={cerrar}
      ancho={900}
      pie={
        <>
          <button className="boton" onClick={() => void importar()} title="Cargar un manifiesto .json">
            importar
          </button>
          <button className="boton" onClick={() => setVerIa((v) => !v)} title="Describe el puesto y Claude llena el formulario">
            <Icono nombre="chispa" /> generar con IA
          </button>
          <button className="boton" onClick={() => void accion({ tipo: 'manifiesto:exportar', agente: { ...a, args: partirComando(argsTexto) } })}>
            exportar
          </button>
          {!esNuevo && !a.esCoordinador && (
            <button
              className="boton boton-peligro"
              onClick={() => {
                if (confirm(`¿Despedir a ${a.nombre}? Se detiene su sesión y sale del equipo (su memoria queda en .hive).`)) {
                  void intentar({ tipo: 'agente:eliminar', id: a.id }).then((ok) => {
                    if (ok) {
                      seleccionar(null)
                      cerrar()
                    }
                  })
                }
              }}
            >
              despedir
            </button>
          )}
          <span className="espaciador" />
          <label className="casilla">
            <input type="checkbox" checked={iniciar} onChange={(e) => setIniciar(e.target.checked)} />
            {esNuevo ? 'iniciar al contratar' : 'reiniciar con los cambios'}
          </label>
          <button className="boton" onClick={cerrar}>
            cancelar
          </button>
          {paso < PASOS.length - 1 && (
            <button className="boton" onClick={() => setPaso((p) => p + 1)}>
              siguiente
            </button>
          )}
          <button className="boton boton-mostaza" disabled={guardando} onClick={() => void guardar()} title={errores.join(' ')}>
            {esNuevo ? 'contratar' : 'guardar'}
          </button>
        </>
      }
    >
      {verIa && (
        <div className="caja-ia">
          <textarea
            autoFocus
            rows={3}
            value={descripcionIa}
            onChange={(e) => setDescripcionIa(e.target.value)}
            placeholder="Ej.: alguien que revise los PR del frontend, estricto con los tests y que hable poco"
          />
          <div className="fila">
            <span className="suave pequeno">Usa Claude Code (claude -p) para proponer nombre, rol, personalidad y encargo.</span>
            <span className="espaciador" />
            <button className="boton boton-oscuro" disabled={generando || !descripcionIa.trim()} onClick={() => void generar()}>
              {generando ? 'pensando…' : 'generar'}
            </button>
          </div>
        </div>
      )}

      <div className="asistente">
        <nav className="pasos">
          {PASOS.map((p, i) => (
            <button key={p} className={`paso ${paso === i ? 'activo' : ''}`} onClick={() => setPaso(i)}>
              <span className="numero-paso">{i + 1}</span>
              {p}
            </button>
          ))}
          <div className="ficha-agente">
            <Retrato personaje={a.personaje} tamano={72} />
            <strong>{a.nombre || 'Sin nombre'}</strong>
            <span className="suave pequeno">{a.rol || 'sin rol'}</span>
            <span className="mono pequeno suave">{carpeta(a.cwd)}</span>
            <span className="pequeno">{proveedorDe(a.proveedor).nombre}</span>
            <ChipsSkills skills={a.skills} max={4} />
          </div>
        </nav>

        <div className="paso-contenido formulario">
          {paso === 0 && (
            <>
              <div className="formulario-fila">
                <label>
                  Nombre
                  <input
                    autoFocus
                    value={a.nombre}
                    onChange={(e) => cambiar({ nombre: e.target.value, ...(esNuevo && !idTocado ? { id: slug(e.target.value.split(' ')[0] ?? '') } : {}) })}
                    placeholder="Darryl Philbin"
                  />
                </label>
                <label>
                  Id
                  <input
                    className="mono"
                    value={a.id}
                    disabled={!esNuevo}
                    onChange={(e) => {
                      setIdTocado(true)
                      cambiar({ id: slug(e.target.value) })
                    }}
                  />
                </label>
              </div>
              <label>
                Rol
                <input value={a.rol} onChange={(e) => cambiar({ rol: e.target.value })} placeholder="Revisor de PRs, diseñador, QA…" />
              </label>
              <label>
                Personalidad
                <textarea rows={2} value={a.personalidad ?? ''} onChange={(e) => cambiar({ personalidad: e.target.value })} placeholder="Cómo habla y cómo trabaja" />
              </label>
              <span className="etiqueta-campo">Aspecto</span>
              <div className="rejilla-personajes">
                {REPARTO.filter((p) => p.id !== ID_MICHAEL || a.esCoordinador).map((p) => (
                  <button
                    key={p.id}
                    className={`opcion-personaje ${a.personaje === p.id ? 'activa' : ''}`}
                    title={`${p.nombre} · ${p.rol}`}
                    onClick={() =>
                      cambiar({
                        personaje: p.id,
                        ...(esNuevo && !a.nombre.trim() ? { nombre: p.nombre, rol: puestoDe(p.id, p.rol) ?? p.rol, personalidad: p.personalidad } : {})
                      })
                    }
                  >
                    <Retrato personaje={p.id} tamano={40} />
                    <span>{p.nombre.split(' ')[0]}</span>
                  </button>
                ))}
                <button
                  className={`opcion-personaje ${!personajeElegido ? 'activa' : ''}`}
                  title="Uno nuevo, dibujado a partir del id"
                  onClick={() => cambiar({ personaje: a.id || 'nuevo' })}
                >
                  <Retrato personaje={a.id || 'nuevo'} tamano={40} />
                  <span>Nuevo</span>
                </button>
              </div>
              {esNuevo && personajeElegido && a.nombre !== personajeElegido.nombre && (
                <button
                  className="boton-mini"
                  onClick={() =>
                    cambiar({ nombre: personajeElegido.nombre, rol: puestoDe(personajeElegido.id, personajeElegido.rol) ?? '', personalidad: personajeElegido.personalidad })
                  }
                >
                  usar nombre, rol y personalidad de {personajeElegido.nombre}
                </button>
              )}
              <span className="etiqueta-campo">Color</span>
              <div className="paleta">
                {COLORES.map((c) => (
                  <button key={c} className={`muestra-color ${a.color === c ? 'activa' : ''}`} style={{ background: c }} onClick={() => cambiar({ color: c })} aria-label={c} />
                ))}
              </div>
            </>
          )}

          {paso === 1 && (
            <>
              <span className="etiqueta-campo">Carpeta de trabajo</span>
              <div className="chips">
                {[...new Set([raiz, ...proyectos])].map((p) => (
                  <button key={p} className={`chip ${a.cwd === p ? 'activo' : ''}`} title={p} onClick={() => cambiar({ cwd: p })}>
                    <Icono nombre="carpeta" tamano={12} /> {carpeta(p)}
                  </button>
                ))}
              </div>
              <div className="fila">
                <input className="mono crece" value={a.cwd} onChange={(e) => cambiar({ cwd: e.target.value })} />
                <button className="boton" onClick={() => void accion({ tipo: 'dialogo:carpeta', inicial: a.cwd }).then((c) => c && cambiar({ cwd: c }))}>
                  <Icono nombre="carpeta" /> elegir
                </button>
              </div>
              <label className="casilla">
                <input type="checkbox" checked={!!a.aislamientoGit} onChange={(e) => cambiar({ aislamientoGit: e.target.checked })} />
                Trabajar en su propio worktree de git (rama <code>minioffice/{a.id || 'id'}</code>) para no pisar a los demás
              </label>
              <label>
                Retomar una sesión de Claude Code (opcional)
                <input className="mono" value={a.reanudar ?? ''} onChange={(e) => cambiar({ reanudar: e.target.value.trim() || undefined })} placeholder="id de sesión" />
              </label>
              <p className="suave pequeno">Varios agentes pueden compartir carpeta. Con worktree, cada uno trabaja en su rama y tú decides qué se une.</p>
            </>
          )}

          {paso === 2 && (
            <>
              <span className="etiqueta-campo">Motor</span>
              <div className="chips">
                {PROVEEDORES.map((p) => (
                  <button key={p.id} className={`chip ${a.proveedor === p.id ? 'activo' : ''}`} onClick={() => cambiar({ proveedor: p.id as ProveedorId, modelo: '' })}>
                    {p.nombre}
                  </button>
                ))}
              </div>
              {!proveedorDe(a.proveedor).integracionCompleta && (
                <p className="alerta pequeno">
                  Con este motor minioffice no puede leer su transcripción: verás su terminal y le llegarán mensajes, pero no sabrá sus tokens ni qué
                  herramienta usa.
                </p>
              )}
              {a.proveedor === 'claude' ? (
                <>
                  <span className="etiqueta-campo">Modelo</span>
                  <div className="chips">
                    {MODELOS_CLAUDE.map((m) => (
                      <button key={m.id} className={`chip ${a.modelo === m.id ? 'activo' : ''}`} onClick={() => cambiar({ modelo: m.id })}>
                        {m.nombre}
                      </button>
                    ))}
                  </div>
                </>
              ) : a.proveedor === 'personalizado' ? (
                <label>
                  Comando
                  <input className="mono" value={a.comando ?? ''} onChange={(e) => cambiar({ comando: e.target.value })} placeholder="mi-agente --modo chat" />
                </label>
              ) : (
                <label>
                  Modelo (opcional)
                  <input className="mono" value={a.modelo} onChange={(e) => cambiar({ modelo: e.target.value })} />
                </label>
              )}
              <label>
                Argumentos extra
                <input className="mono" value={argsTexto} onChange={(e) => setArgsTexto(e.target.value)} placeholder="--effort high" />
              </label>
              <span className="etiqueta-campo">Así se va a lanzar</span>
              <pre className="codigo">{vistaComando || '—'}</pre>
              {proveedorDe(a.proveedor).instalar && (
                <p className="suave pequeno">
                  ¿No lo tienes? <code>npm install -g {proveedorDe(a.proveedor).instalar}</code> o instálalo desde Capacidades.
                </p>
              )}
            </>
          )}

          {paso === 3 && (
            <>
              <p className="suave pequeno">
                Cada skill le enseña un oficio concreto. Lee para qué sirve y marca las que necesita
                {PUESTOS[a.personaje] ? ` como ${PUESTOS[a.personaje].puesto.toLowerCase()}` : ''}. Las que falten se descargan al guardar.
              </p>
              <SelectorSkills
                personaje={a.personaje}
                proveedor={a.proveedor}
                seleccion={a.skills ?? []}
                onCambiar={(skills) => cambiar({ skills: skills.length ? skills : undefined })}
              />
            </>
          )}

          {paso === 4 && (
            <>
              <label>
                Descripción del puesto
                <textarea rows={3} value={a.descripcion ?? ''} onChange={(e) => cambiar({ descripcion: e.target.value })} placeholder="De qué se encarga en este proyecto" />
              </label>
              <label>
                Objetivo
                <textarea rows={2} value={a.objetivo ?? ''} onChange={(e) => cambiar({ objetivo: e.target.value })} placeholder="Qué cuenta como trabajo terminado" />
              </label>
              <div className="formulario-fila">
                <label>
                  Límite de tokens (miles)
                  <input
                    type="number"
                    min={0}
                    value={a.limiteTokens ? Math.round(a.limiteTokens / 1000) : ''}
                    onChange={(e) => cambiar({ limiteTokens: Number(e.target.value) > 0 ? Number(e.target.value) * 1000 : undefined })}
                    placeholder="sin límite"
                  />
                </label>
                <label>
                  Nota (se ve en su tarjeta)
                  <input value={a.nota ?? ''} onChange={(e) => cambiar({ nota: e.target.value || undefined })} placeholder="Está en lo del cliente de Utica" />
                </label>
              </div>
              <p className="suave pequeno">
                Al llegar al límite deja de recibir mensajes hasta que lo subas (lo ves en Monitor). Todo esto va a sus instrucciones, junto con cómo
                hablar con el resto de la oficina.
              </p>
            </>
          )}
          {intentado && errores.length > 0 && <p className="alerta pequeno">{errores.join(' ')}</p>}
        </div>
      </div>
    </Modal>
  )
}
