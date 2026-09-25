import { useState, type KeyboardEvent } from 'react'
import type { Agente } from '../../shared/types'
import { accion, avisar, intentar, useAgentes } from '../tienda'
import { Icono } from './basicos'
import { BotonDictado } from './BotonDictado'
import { juntarTexto } from '../dictado/voz'

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** "@Dwight haz esto" va directo a Dwight en lugar de a Michael. */
function destinoDeMencion(texto: string, agentes: Agente[]): { para: Agente; cuerpo: string } | null {
  const m = texto.match(/^@([^\s,:]+)[\s,:]*/)
  if (!m) return null
  const buscado = normalizar(m[1])
  const para = agentes.find((a) => {
    const nombre = normalizar(a.nombre)
    return normalizar(a.id) === buscado || nombre.split(/\s+/)[0] === buscado || nombre.replace(/\s+/g, '') === buscado
  })
  return para ? { para, cuerpo: texto.slice(m[0].length).trim() } : null
}

export function Cola({ agente, menciones = false }: { agente: Agente; menciones?: boolean }): JSX.Element {
  const agentes = useAgentes()
  const [texto, setTexto] = useState('')
  const [adjuntos, setAdjuntos] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const nombre = agente.nombre.split(' ')[0]
  const ocupado = agente.rt.estado === 'trabajando' || agente.rt.estado === 'esperando'

  async function enviar(modo: 'cola' | 'guiar'): Promise<void> {
    let cuerpo = texto.trim()
    if (!cuerpo && adjuntos.length === 0) return
    if (adjuntos.length) cuerpo += `\n\nArchivos adjuntos:\n${adjuntos.map((a) => `- ${a}`).join('\n')}`
    let destino = agente
    if (menciones) {
      const mencion = destinoDeMencion(cuerpo, agentes)
      if (mencion) {
        destino = mencion.para
        cuerpo = mencion.cuerpo
      }
    }
    setEnviando(true)
    const ok = await intentar({ tipo: 'agente:enviar', id: destino.id, texto: cuerpo, modo })
    setEnviando(false)
    if (!ok) return
    setTexto('')
    setAdjuntos([])
    if (destino.id !== agente.id) avisar(`Mensaje enviado directo a ${destino.nombre}`)
  }

  async function adjuntar(): Promise<void> {
    const rutas = await accion({ tipo: 'dialogo:archivos' })
    if (rutas?.length) setAdjuntos((a) => [...new Set([...a, ...rutas])])
  }

  function alTeclear(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void enviar(e.ctrlKey || e.metaKey ? 'guiar' : 'cola')
    }
  }

  const placeholder = ocupado
    ? `${nombre} está ocupado: tu mensaje espera en la cola (Ctrl+Enter para guiarlo ya)`
    : menciones
      ? `Mensaje para ${nombre}… (@Dwight para hablarle directo a alguien)`
      : `Mensaje para ${nombre}…`

  return (
    <section className="cola">
      <div className="cola-titulo">
        <h3 className="pixel">Cola</h3>
        {agente.rt.pendientes > 0 && (
          <span className="suave">
            {agente.rt.pendientes} en espera{agente.rt.limiteAlcanzado ? ' · detenido por límite de tokens' : ''}
          </span>
        )}
      </div>
      <textarea
        className="cola-texto"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={alTeclear}
        placeholder={placeholder}
        rows={3}
      />
      {adjuntos.length > 0 && (
        <div className="adjuntos">
          {adjuntos.map((a) => (
            <span key={a} className="adjunto mono" title={a}>
              {a.split(/[\\/]/).pop()}
              <button onClick={() => setAdjuntos((x) => x.filter((y) => y !== a))} aria-label="Quitar">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="cola-acciones">
        <span className="suave pequeno">Enter envía cuando esté libre · Ctrl+Enter guía ya · Shift+Enter salto de línea</span>
        <span className="espaciador" />
        <BotonDictado alTexto={(t) => setTexto((x) => juntarTexto(x, t))} />
        <button className="boton" onClick={() => void adjuntar()}>
          <Icono nombre="mas" /> archivos
        </button>
        <button className="boton" disabled={enviando || (!texto.trim() && !adjuntos.length)} onClick={() => void enviar('guiar')} title="Se teclea ahora mismo aunque esté trabajando">
          guiar
        </button>
        <button className="boton boton-primario" disabled={enviando || (!texto.trim() && !adjuntos.length)} onClick={() => void enviar('cola')}>
          enviar <Icono nombre="enviar" />
        </button>
      </div>
    </section>
  )
}
