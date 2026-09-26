import { useEffect, useState } from 'react'
import type { Ajustes, Companero, Horario } from '../../../shared/types'
import type { InfoWebhook } from '../../../shared/acciones'
import { accion, avisar, intentar, useAgentes, useOficina } from '../../tienda'
import { dentroDe, hace } from '../../formato'
import { Icono, Vacio } from '../basicos'

function nuevoId(prefijo: string): string {
  return `${prefijo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function PestanaDisparadores(): JSX.Element {
  const ajustes = useOficina((e) => e.ajustes)
  if (!ajustes) return <Vacio>Cargando…</Vacio>
  return (
    <div className="pestana-contenido">
      <Horarios ajustes={ajustes} />
      <Contexto ajustes={ajustes} />
      <Webhooks ajustes={ajustes} />
      <Companeros ajustes={ajustes} />
    </div>
  )
}

function guardar(ajustes: Partial<Ajustes>): Promise<boolean> {
  return intentar({ tipo: 'ajustes:guardar', ajustes })
}

// ---------------------------------------------------------------- horarios

function Horarios({ ajustes }: { ajustes: Ajustes }): JSX.Element {
  const agentes = useAgentes()
  const [editando, setEditando] = useState<string | null>(null)

  const destino = (para: string): string =>
    para === 'todos' ? 'todos' : para === 'temporal' ? 'un temporal' : (agentes.find((a) => a.id === para)?.nombre ?? para)

  const cambiar = (id: string, cambios: Partial<Horario>): void => {
    void guardar({ horarios: ajustes.horarios.map((h) => (h.id === id ? { ...h, ...cambios } : h)) })
  }

  const agregar = (): void => {
    const h: Horario = { id: nuevoId('horario'), nombre: 'Nuevo horario', cadaMinutos: 60, para: 'michael', prompt: '', activo: false }
    void guardar({ horarios: [...ajustes.horarios, h] }).then(() => setEditando(h.id))
  }

  return (
    <section className="seccion">
      <div className="fila">
        <h3 className="pixel">Horarios</h3>
        <span className="suave pequeno">mensajes que se mandan solos cada cierto tiempo</span>
        <span className="espaciador" />
        <button className="boton" onClick={agregar}>
          <Icono nombre="mas" /> horario
        </button>
      </div>
      {ajustes.horarios.length === 0 && <p className="suave">Sin horarios.</p>}
      {ajustes.horarios.map((h) => {
        const siguiente = h.activo && h.ultimo ? h.ultimo + h.cadaMinutos * 60_000 : null
        return (
          <article key={h.id} className={`tarjeta-horario ${h.activo ? 'activo' : ''}`}>
            <div className="fila">
              <label className="interruptor" title={h.activo ? 'Apagar' : 'Encender'}>
                <input type="checkbox" checked={h.activo} onChange={(e) => cambiar(h.id, { activo: e.target.checked })} />
                <span />
              </label>
              {editando === h.id ? (
                <input className="crece" value={h.nombre} onChange={(e) => cambiar(h.id, { nombre: e.target.value })} aria-label="Nombre" />
              ) : (
                <strong className="crece recorte">{h.nombre}</strong>
              )}
              <button className="boton-mini" onClick={() => void accion({ tipo: 'horario:disparar', id: h.id })}>
                disparar ahora
              </button>
              <button className="boton-mini" onClick={() => setEditando(editando === h.id ? null : h.id)}>
                {editando === h.id ? 'listo' : 'editar'}
              </button>
            </div>
            <p className="suave pequeno">
              cada {h.cadaMinutos} min → {destino(h.para)} ·{' '}
              {h.activo ? (siguiente ? `próximo ${dentroDe(siguiente)}` : 'esperando el primer intervalo') : 'apagado'} · último {hace(h.ultimo)}
            </p>
            {editando === h.id && (
              <div className="formulario">
                <div className="formulario-fila">
                  <label>
                    Cada (minutos)
                    <input
                      type="number"
                      min={1}
                      value={h.cadaMinutos}
                      onChange={(e) => cambiar(h.id, { cadaMinutos: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </label>
                  <label>
                    Para
                    <select value={h.para} onChange={(e) => cambiar(h.id, { para: e.target.value })}>
                      <option value="todos">Todos los que estén activos</option>
                      <option value="temporal">Un temporal nuevo (claude -p)</option>
                      {agentes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Mensaje
                  <TextoDiferido valor={h.prompt} filas={3} alGuardar={(prompt) => cambiar(h.id, { prompt })} />
                </label>
                <div className="fila">
                  <span className="espaciador" />
                  <button
                    className="boton boton-peligro"
                    onClick={() => void guardar({ horarios: ajustes.horarios.filter((x) => x.id !== h.id) })}
                  >
                    <Icono nombre="papelera" /> eliminar
                  </button>
                </div>
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}

/** Textarea que guarda al salir del campo, para no escribir el hive en cada tecla. */
function TextoDiferido({ valor, filas, alGuardar }: { valor: string; filas: number; alGuardar: (v: string) => void }): JSX.Element {
  const [texto, setTexto] = useState(valor)
  useEffect(() => setTexto(valor), [valor])
  return <textarea rows={filas} value={texto} onChange={(e) => setTexto(e.target.value)} onBlur={() => texto !== valor && alGuardar(texto)} />
}

// ---------------------------------------------------------------- contexto

function Contexto({ ajustes }: { ajustes: Ajustes }): JSX.Element {
  return (
    <section className="seccion">
      <h3 className="pixel">Contexto</h3>
      <div className="fila">
        <label className="interruptor">
          <input type="checkbox" checked={ajustes.compactarAuto} onChange={(e) => void guardar({ compactarAuto: e.target.checked })} />
          <span />
        </label>
        <span>Compactar solo cuando el contexto pase del</span>
        <input
          className="entrada-corta"
          type="number"
          min={50}
          max={95}
          value={ajustes.compactarUmbral}
          onChange={(e) => void guardar({ compactarUmbral: Math.min(95, Math.max(50, Number(e.target.value) || 80)) })}
          aria-label="Umbral"
        />
        <span>%</span>
      </div>
      <p className="suave pequeno">Cuando el agente queda libre, minioffice le escribe /compact para que siga trabajando sin llenar su ventana.</p>
    </section>
  )
}

// ---------------------------------------------------------------- webhooks

function Webhooks({ ajustes }: { ajustes: Ajustes }): JSX.Element {
  const [info, setInfo] = useState<InfoWebhook | null>(null)
  const [verClave, setVerClave] = useState(false)

  useEffect(() => {
    let vivo = true
    const leer = (): void => {
      void accion({ tipo: 'webhook:info' }).then((i) => vivo && i && setInfo(i))
    }
    leer()
    const t = setInterval(leer, 2000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [ajustes.webhooks, ajustes.webhookPuerto, ajustes.webhookRed])

  const url = info?.urls[0] ?? `http://127.0.0.1:${ajustes.webhookPuerto}`
  const ejemplo = `curl -X POST ${url}/mensaje \\\n  -H "Authorization: Bearer ${verClave ? ajustes.webhookClave : '<clave>'}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"texto": "Revisa el despliegue", "para": "michael"}'`

  const copiar = (texto: string): void => {
    void navigator.clipboard.writeText(texto).then(() => avisar('Copiado'))
  }

  return (
    <section className="seccion">
      <div className="fila">
        <h3 className="pixel">Webhooks</h3>
        <span className="suave pequeno">otro programa le escribe a la oficina por HTTP</span>
        <span className="espaciador" />
        <span className={`chip-estado ${info?.activo ? 'chip-trabajando' : 'chip-detenido'}`}>
          <span className="chip-cuadro" />
          {info?.activo ? 'escuchando' : 'apagado'}
        </span>
      </div>
      <div className="fila">
        <label className="interruptor">
          <input type="checkbox" checked={ajustes.webhooks} onChange={(e) => void guardar({ webhooks: e.target.checked })} />
          <span />
        </label>
        <span>Activar</span>
        <span className="suave">puerto</span>
        <input
          className="entrada-corta"
          type="number"
          min={1024}
          max={65535}
          value={ajustes.webhookPuerto}
          onChange={(e) => void guardar({ webhookPuerto: Number(e.target.value) || 4717 })}
          aria-label="Puerto"
        />
        <label className="casilla">
          <input type="checkbox" checked={ajustes.webhookRed} onChange={(e) => void guardar({ webhookRed: e.target.checked })} />
          aceptar desde mi red local
        </label>
      </div>
      {ajustes.webhookRed && (
        <p className="alerta pequeno">
          Cualquiera en tu red que tenga la clave podrá mandar mensajes a tus agentes, y la conexión no va cifrada: actívalo solo en redes de
          confianza (tu casa u oficina), nunca en una Wi-Fi pública.
        </p>
      )}
      <div className="fila">
        <span className="suave">clave</span>
        <code className="mono recorte crece">{verClave ? ajustes.webhookClave : '•'.repeat(24)}</code>
        <button className="boton-mini" onClick={() => setVerClave((v) => !v)}>
          {verClave ? 'ocultar' : 'ver'}
        </button>
        <button className="boton-mini" onClick={() => copiar(ajustes.webhookClave)}>
          <Icono nombre="copiar" tamano={12} /> copiar
        </button>
        <button
          className="boton-mini"
          onClick={() => {
            const bytes = crypto.getRandomValues(new Uint8Array(24))
            void guardar({ webhookClave: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') })
          }}
        >
          nueva clave
        </button>
      </div>
      {info && info.urls.length > 0 && (
        <ul className="lista-simple mono pequeno">
          {info.urls.map((u) => (
            <li key={u}>
              POST {u}/mensaje · GET {u}/estado
            </li>
          ))}
        </ul>
      )}
      <pre className="codigo">{ejemplo}</pre>
      <p className="suave pequeno">
        Sin <code>para</code>, el mensaje va a Michael. Con <code>de</code> puedes decir quién lo manda.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------- compañeros

function Companeros({ ajustes }: { ajustes: Ajustes }): JSX.Element {
  const [nuevo, setNuevo] = useState<Companero>({ id: '', nombre: '', url: '', clave: '' })

  const agregar = (): void => {
    const id = nuevo.id.trim() || nuevo.nombre.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    if (!id || !nuevo.url.trim()) return
    void guardar({ companeros: [...ajustes.companeros.filter((c) => c.id !== id), { ...nuevo, id, url: nuevo.url.trim().replace(/\/$/, '') }] }).then(
      (ok) => ok && setNuevo({ id: '', nombre: '', url: '', clave: '' })
    )
  }

  return (
    <section className="seccion">
      <h3 className="pixel">Otras oficinas</h3>
      <p className="suave pequeno">
        Si alguien más usa minioffice con webhooks, tus agentes pueden escribirle con <code>"para": "fuera:&lt;id&gt;"</code>.
      </p>
      {ajustes.companeros.map((c) => (
        <div key={c.id} className="fila">
          <strong>{c.nombre || c.id}</strong>
          <code className="mono pequeno">fuera:{c.id}</code>
          <span className="suave pequeno recorte crece">{c.url}</span>
          <button className="boton-mini" onClick={() => void guardar({ companeros: ajustes.companeros.filter((x) => x.id !== c.id) })}>
            quitar
          </button>
        </div>
      ))}
      <div className="formulario-fila">
        <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre (Sucursal Nashua)" />
        <input value={nuevo.url} onChange={(e) => setNuevo({ ...nuevo, url: e.target.value })} placeholder="http://192.168.1.20:4717" />
        <input value={nuevo.clave} onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })} placeholder="Su clave" type="password" />
        <button className="boton" disabled={!nuevo.url.trim() || !(nuevo.nombre.trim() || nuevo.id.trim())} onClick={agregar}>
          agregar
        </button>
      </div>
    </section>
  )
}
