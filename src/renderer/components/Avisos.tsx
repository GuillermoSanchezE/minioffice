import { useAvisos } from '../tienda'

export function Avisos(): JSX.Element {
  const avisos = useAvisos()
  return (
    <div className="avisos" role="status" aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} className={`aviso aviso-${a.tipo}`}>
          {a.texto}
        </div>
      ))}
    </div>
  )
}
