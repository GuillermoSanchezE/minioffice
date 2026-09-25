import { aCss, colorDeAgente, colorTextoSobre, iniciales } from '../colores'

interface Props {
  id: string
  nombre: string
  className: string
}

export function AvatarAgente({ id, nombre, className }: Props): JSX.Element {
  const color = colorDeAgente(id)
  return (
    <span className={className} style={{ background: aCss(color), color: colorTextoSobre(color) }}>
      {iniciales(nombre)}
    </span>
  )
}
