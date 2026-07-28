import Link from "next/link"
import { countryCode } from "@/lib/flags"
import { YVELINES_OUTLINE, LIBAN_OUTLINE, type Outline } from "@/lib/map-outlines"

// ============================================================
// Carte des interventions Yvelines–Liban (V1, Lot 3)
// ============================================================
// Deux panneaux, un repère par projet, cliquable vers la fiche.
//
// Choix technique ARBITRÉ le 27/07 : SVG embarqué, zéro dépendance. Une
// bibliothèque cartographique (Leaflet, Google Maps…) tirerait des
// fonds de carte d'un serveur tiers — réseau, poids, RGPD, clé d'API —
// pour deux territoires qui ne changeront jamais. Les contours viennent
// de lib/map-outlines.ts : les limites administratives RÉELLES (IGN
// Admin Express, geoBoundaries), simplifiées hors ligne et figées dans
// le dépôt — la précision d'un fond officiel, sans fournisseur à
// l'exécution.
//
// Les repères viennent de `projects.lat` / `projects.lng` — colonnes
// présentes depuis la 0001, jamais branchées. PAS de géocodage
// automatique (qui appellerait un service externe pour trois communes
// connues) : les coordonnées se saisissent dans « Modifier la fiche du
// projet », et un projet sans coordonnées est COMPTÉ comme tel dans la
// légende plutôt que placé au hasard ou passé sous silence.
//
// Rendu : le SVG ne porte que les contours ; les repères sont des
// <Link> positionnés en % au-dessus, dans un conteneur qui fige le même
// ratio que le viewBox — la navigation reste celle de l'application, et
// l'infobulle est un vrai title. Sur téléphone, les panneaux s'empilent
// (règle « rien ne sort du cadre »).

type MapProject = {
  id: string
  name: string
  country: string | null
  lat: number | null
  lng: number | null
}

const W = 200
const H = 220
const PAD = 14

// Projection équirectangulaire locale : les longitudes sont resserrées
// par cos(latitude médiane) — sans quoi le Liban, étiré nord-sud,
// sortirait aplati — puis le tracé est ajusté au panneau.
function makeProjection(outline: Outline) {
  const midLat = outline.reduce((s, p) => s + p[1], 0) / outline.length
  const kx = Math.cos((midLat * Math.PI) / 180)
  const xs = outline.map(p => p[0] * kx)
  const ys = outline.map(p => -p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const scale = Math.min((W - 2 * PAD) / (maxX - minX), (H - 2 * PAD) / (maxY - minY))
  const ox = (W - (maxX - minX) * scale) / 2
  const oy = (H - (maxY - minY) * scale) / 2
  const toXY = (lat: number, lng: number): [number, number] => [
    ox + (lng * kx - minX) * scale,
    oy + (-lat - minY) * scale,
  ]
  const path = outline
    .map((p, i) => `${i === 0 ? "M" : "L"}${toXY(p[1], p[0]).map(v => v.toFixed(1)).join(",")}`)
    .join(" ") + " Z"
  const contains = (lat: number, lng: number) => {
    const [x, y] = toXY(lat, lng)
    return x >= 0 && x <= W && y >= 0 && y <= H
  }
  return { toXY, path, contains }
}

type Territory = {
  key: string
  label: string
  outline: Outline
  // Rattachement par le pays saisi sur le projet (texte libre,
  // rapproché d'un code ISO par lib/flags)
  codes: string[]
}

const TERRITORIES: Territory[] = [
  { key: "yvelines", label: "Yvelines", outline: YVELINES_OUTLINE, codes: ["FR"] },
  { key: "liban", label: "Liban", outline: LIBAN_OUTLINE, codes: ["LB"] },
]

export default function InterventionMap({ projects }: { projects: MapProject[] }) {
  const panels = TERRITORIES.map(t => {
    const proj = makeProjection(t.outline)
    const assigned = projects.filter(p => {
      const code = countryCode(p.country)
      return code !== null && t.codes.includes(code)
    })
    const placed = assigned.filter(p =>
      p.lat != null && p.lng != null && proj.contains(p.lat, p.lng)
    )
    return { ...t, proj, assigned, placed }
  })

  const assignedIds = new Set(panels.flatMap(p => p.assigned.map(pr => pr.id)))
  const elsewhere = projects.filter(p => !assignedIds.has(p.id))
  const nothingPlaced = panels.every(p => p.placed.length === 0)

  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: "#E3E6E2" }}>
        <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
          Carte des interventions — Yvelines &amp; Liban
        </h2>
      </div>
      <div className="grid sm:grid-cols-2">
        {panels.map((panel, i) => (
          <div key={panel.key} className={`p-4 ${i > 0 ? "border-t sm:border-t-0 sm:border-l" : ""}`} style={{ borderColor: "#E3E6E2" }}>
            {/* Le conteneur fige le ratio du viewBox : les repères en %
                tombent exactement sur la géométrie rendue. */}
            <div className="relative mx-auto max-w-xs" style={{ aspectRatio: `${W}/${H}` }}>
              <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" role="img"
                aria-label={`${panel.label} — ${panel.placed.length} projet${panel.placed.length > 1 ? "s" : ""} localisé${panel.placed.length > 1 ? "s" : ""}`}>
                <path d={panel.proj.path}
                  fill="var(--brand-accent-soft,#E4F0EC)"
                  stroke="var(--brand-accent,#0E6B5C)"
                  strokeWidth="1.5"
                  strokeLinejoin="round" />
              </svg>
              {panel.placed.map(p => {
                const [x, y] = panel.proj.toXY(p.lat as number, p.lng as number)
                return (
                  <Link
                    key={p.id}
                    href={`/projets/${p.id}`}
                    title={p.name}
                    aria-label={`${p.name} — ouvrir la fiche projet`}
                    className="absolute block w-3 h-3 rounded-full border-2 border-white shadow-md transition-transform hover:scale-125 focus-visible:scale-125"
                    style={{
                      left: `${(x / W) * 100}%`,
                      top: `${(y / H) * 100}%`,
                      transform: "translate(-50%, -50%)",
                      background: "var(--brand-accent,#0E6B5C)",
                    }}
                  />
                )
              })}
            </div>
            <div className="mt-2 text-center text-sm font-medium" style={{ color: "#17211D", fontFamily: "var(--font-sora)" }}>
              {panel.label}
            </div>
            <div className="text-center text-xs" style={{ color: "#66716B" }}>
              {panel.assigned.length} projet{panel.assigned.length > 1 ? "s" : ""}
              {panel.assigned.length > panel.placed.length &&
                ` · ${panel.assigned.length - panel.placed.length} sans coordonnées`}
            </div>
          </div>
        ))}
      </div>
      {/* La carte dit ce qu'elle ne montre pas : un projet hors de ces
          deux territoires, ou sans coordonnées, est compté — jamais
          passé sous silence ni placé au hasard. */}
      {(elsewhere.length > 0 || nothingPlaced) && (
        <div className="px-6 py-3 border-t text-xs space-y-0.5" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
          {elsewhere.length > 0 && (
            <p>{elsewhere.length} projet{elsewhere.length > 1 ? "s" : ""} hors de ces deux territoires.</p>
          )}
          {nothingPlaced && (
            <p>
              Les repères apparaîtront quand les coordonnées seront renseignées —
              bouton « Modifier » de la fiche projet, champs latitude / longitude.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
