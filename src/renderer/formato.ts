export function tokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`
  return String(Math.round(n))
}

export function dinero(usd: number): string {
  return usd < 0.01 && usd > 0 ? '<$0.01' : `$${usd.toFixed(2)}`
}

export function hace(ts: number | undefined, ahora = Date.now()): string {
  if (!ts) return 'nunca'
  const s = Math.round((ahora - ts) / 1000)
  if (s < 5) return 'ahora'
  if (s < 60) return `hace ${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}

export function dentroDe(ts: number, ahora = Date.now()): string {
  const m = Math.max(0, Math.round((ts - ahora) / 60000))
  if (m < 1) return 'en menos de un minuto'
  if (m < 60) return `en ${m} min`
  return `en ${Math.round(m / 60)} h`
}

const formatoHora = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })
const formatoFecha = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function hora(ts: number): string {
  return formatoHora.format(ts)
}

export function fecha(ts: number): string {
  return formatoFecha.format(ts)
}

export function carpeta(ruta: string): string {
  return ruta.split(/[\\/]/).filter(Boolean).pop() ?? ruta
}

export function duracion(desde: number, hasta = Date.now()): string {
  const s = Math.max(0, Math.round((hasta - desde) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}
