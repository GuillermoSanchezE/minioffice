import { useMemo, useState } from 'react'
import type { TipoEvento } from '../../../shared/types'
import { useOficina } from '../../tienda'
import { fecha } from '../../formato'
import { Icono, Vacio } from '../basicos'

const TIPOS: Array<{ id: TipoEvento; nombre: string }> = [
  { id: 'mensaje', nombre: 'mensajes' },
  { id: 'sesion', nombre: 'sesiones' },
  { id: 'tarea', nombre: 'tareas' },
  { id: 'pregunta', nombre: 'preguntas' },
  { id: 'disparador', nombre: 'disparadores' },
  { id: 'contratacion', nombre: 'contrataciones' },
  { id: 'temporal', nombre: 'temporales' },
  { id: 'archivo', nombre: 'bajas' },
  { id: 'sistema', nombre: 'sistema' }
]

export function PestanaActividad(): JSX.Element {
  const actividad = useOficina((e) => e.actividad) ?? []
  const [tipos, setTipos] = useState<TipoEvento[]>([])
  const [busqueda, setBusqueda] = useState('')

  const visibles = useMemo(() => {
    const q = busqueda.toLowerCase()
    return actividad.filter((e) => (tipos.length === 0 || tipos.includes(e.tipo)) && (!q || e.texto.toLowerCase().includes(q)))
  }, [actividad, tipos, busqueda])

  return (
    <div className="pestana-contenido">
      <div className="barra-herramientas">
        <strong className="pixel">Actividad</strong>
        <span className="espaciador" />
        <div className="buscador">
          <Icono nombre="buscar" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Filtrar" />
        </div>
      </div>
      <div className="chips">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            className={`chip ${tipos.includes(t.id) ? 'activo' : ''}`}
            onClick={() => setTipos((x) => (x.includes(t.id) ? x.filter((y) => y !== t.id) : [...x, t.id]))}
          >
            {t.nombre}
          </button>
        ))}
      </div>
      {visibles.length === 0 ? (
        <Vacio>Sin actividad todavía.</Vacio>
      ) : (
        <div className="registro">
          {visibles.map((e, i) => (
            <div key={`${e.ts}-${i}`} className="evento">
              <span className={`tipo-evento tipo-${e.tipo}`}>{e.tipo}</span>
              <span>{e.texto}</span>
              <time className="suave mono pequeno">{fecha(e.ts)}</time>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
