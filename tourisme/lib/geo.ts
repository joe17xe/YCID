// Petits calculs géographiques sans dépendance : assez précis pour
// l'affichage (les valeurs officielles restent celles de l'étude).
import type { LineString, Position } from './types'

const R = 6371000

/** Distance haversine en mètres entre deux positions [lon, lat]. */
export function distanceM(a: Position, b: Position): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLon = toRad(b[0] - a[0])
  const la1 = toRad(a[1])
  const la2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function lengthM(line: LineString): number {
  let total = 0
  for (let i = 1; i < line.coordinates.length; i++) {
    total += distanceM(line.coordinates[i - 1], line.coordinates[i])
  }
  return Math.round(total)
}

export function bbox(line: LineString): [Position, Position] {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  for (const [lon, lat] of line.coordinates) {
    if (lon < minLon) minLon = lon
    if (lat < minLat) minLat = lat
    if (lon > maxLon) maxLon = lon
    if (lat > maxLat) maxLat = lat
  }
  return [[minLon, minLat], [maxLon, maxLat]]
}

/** Point de la trace le plus proche d'une position, avec distance. */
export function nearestOnLine(line: LineString, p: Position): { index: number; distanceM: number } {
  let best = { index: 0, distanceM: Infinity }
  line.coordinates.forEach((c, i) => {
    const d = distanceM(c, p)
    if (d < best.distanceM) best = { index: i, distanceM: d }
  })
  return best
}

/** Distance restante le long de la trace depuis l'index donné. */
export function remainingM(line: LineString, fromIndex: number): number {
  let total = 0
  for (let i = Math.max(1, fromIndex + 1); i < line.coordinates.length; i++) {
    total += distanceM(line.coordinates[i - 1], line.coordinates[i])
  }
  return Math.round(total)
}

/** GPX 1.1 minimal généré depuis la trace — l'échange universel. */
export function toGpx(name: string, line: LineString, opts?: { provisional?: boolean }): string {
  const pts = line.coordinates
    .map(([lon, lat]) => `      <trkpt lat="${lat}" lon="${lon}"></trkpt>`)
    .join('\n')
  const desc = opts?.provisional
    ? '\n    <desc>Tracé provisoire dessiné d’après l’étude des sentiers — en attente du relevé officiel. Provisional track awaiting official survey.</desc>'
    : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Visit Azour" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</name>${desc}
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`
}

export function formatKm(m: number | null | undefined, locale: string): string {
  if (m == null) return '—'
  const km = m / 1000
  const s = km >= 10 ? km.toFixed(0) : km.toFixed(1).replace(/\.0$/, '')
  return locale === 'fr' ? `${s.replace('.', ',')} km` : `${s} km`
}

export function formatDuree(min: number | null, max: number | null, locale: string): string {
  const one = (m: number) => {
    const h = Math.floor(m / 60)
    const r = m % 60
    if (h === 0) return `${r} min`
    if (r === 0) return `${h} h`
    return `${h} h ${String(r).padStart(2, '0')}`
  }
  if (min == null && max == null) return '—'
  if (min != null && max != null && min !== max)
    return locale === 'ar' ? `${one(min)}–${one(max)}` : `${one(min)} – ${one(max)}`
  return one((min ?? max) as number)
}
