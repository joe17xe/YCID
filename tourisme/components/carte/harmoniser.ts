import type { Map as MlMap } from 'maplibre-gl'

/* Le fond de carte public arrive avec ses verts saturés et ses routes
   jaunes — un autre univers que le calcaire et le pin d'Azour. Plutôt
   que de figer un style maison (invérifiable et cassant si le schéma
   change), on RETEINTE au runtime les couleurs du style effectivement
   chargé : désaturation, virage vers la terre et la forêt, éclaircie
   vers le calcaire. Marche avec n'importe quel fond, et laisse intacts
   la trace, les marqueurs, les contrôles et les attributions. */

type RGB = { r: number; g: number; b: number }

function lire(couleur: string): RGB | null {
  const c = couleur.trim()
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (x) => x + x) : hex[1]
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    }
  }
  const rgb = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3] }
  return null
}

/** Teinte de référence : le calcaire du Shir. */
const PAPIER: RGB = { r: 244, g: 242, b: 232 }

function reteinter({ r, g, b }: RGB): string {
  // Désaturation vers le gris perceptuel, puis un souffle de terre.
  const gris = 0.299 * r + 0.587 * g + 0.114 * b
  const s = 0.42 // ce qui reste de saturation
  const t = 0.16 // part de calcaire mélangée
  const mix = (v: number, ref: number) =>
    Math.round(Math.min(255, Math.max(0, (gris + (v - gris) * s) * (1 - t) + ref * t)))
  return `rgb(${mix(r, PAPIER.r)}, ${mix(g, PAPIER.g)}, ${mix(b, PAPIER.b)})`
}

const PROPS_COULEUR = [
  'background-color',
  'fill-color',
  'fill-outline-color',
  'line-color',
  'fill-extrusion-color',
] as const

/** Applique la reteinte à toutes les couches du fond. Les couches de
 *  l'application (préfixe `va-`) sont épargnées : la trace doit rester
 *  vive. Les couleurs exprimées par expression sont laissées telles
 *  quelles — les toucher casserait le style. */
export function harmoniserFond(map: MlMap) {
  let style
  try {
    style = map.getStyle()
  } catch {
    return
  }
  for (const couche of style?.layers ?? []) {
    if (couche.id.startsWith('va-')) continue
    for (const prop of PROPS_COULEUR) {
      let valeur: unknown
      try {
        valeur = map.getPaintProperty(couche.id, prop)
      } catch {
        continue
      }
      if (typeof valeur !== 'string') continue
      const rgb = lire(valeur)
      if (!rgb) continue
      try {
        map.setPaintProperty(couche.id, prop, reteinter(rgb))
      } catch {
        /* couche non peignable : on passe */
      }
    }
  }
}
