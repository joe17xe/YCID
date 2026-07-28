import Link from "next/link"
import { countryCode, countryFlag } from "@/lib/flags"
import { YVELINES_OUTLINE, LIBAN_OUTLINE, type Outline } from "@/lib/map-outlines"
import CityMarker, { type CityMarkerProject } from "@/components/pilotage/CityMarker"
import MapLinkOverlay, { type CityPair } from "@/components/pilotage/MapLinkOverlay"

// ============================================================
// Carte des interventions Yvelines–Liban (V1, Lot 3 · villes 28/07)
// ============================================================
// Deux panneaux ; les contours viennent de lib/map-outlines.ts (limites
// administratives réelles, simplifiées hors ligne, figées) — SVG
// statique, zéro fournisseur à l'exécution, l'arbitrage du 27/07 tient.
//
// Depuis le 28/07, le repère est une VILLE, plus un projet. Le travail
// est ENTRE des villes — une en Yvelines et une au Liban pour les
// triades, parfois deux villes libanaises — et le modèle « un projet,
// un point » laissait le panneau Yvelines à zéro pendant que les deux
// triades s'affichaient côté Liban. Les villes d'un projet se
// renseignent sur sa fiche (bouton « Villes ») ; cliquer un repère
// liste les projets qui impliquent la ville.
//
// Qui voit quoi : le repère et le NOMBRE de projets d'une ville sont
// visibles de tous (project_cities est lisible par tout connecté,
// 0050) ; les NOMS et les fiches restent derrière les policies
// projets. Un projet hors droits est compté « sans accès », jamais
// nommé — visualiser sans accéder.
//
// Tant que la migration 0050 n'est pas passée, les requêtes villes
// échouent et la carte retombe sur l'ancien mode : un repère par
// projet localisé (projects.lat/lng). Aucun écran cassé entre le
// déploiement du code et le passage du SQL.
//
// La carte dit ce qu'elle ne montre pas : projets sans ville, villes
// hors des deux territoires — comptés dans la légende, jamais placés
// au hasard ni passés sous silence.

type MapProject = {
  id: string
  name: string
  country: string | null
  lat: number | null
  lng: number | null
}

export type MapCity = {
  id: string
  name: string
  country: string | null
  lat: number
  lng: number
  // Tous les projets liés à la ville, droits ou pas (le lien est
  // lisible par tous — un identifiant opaque, jamais un nom)…
  total: number
  // …et ceux que les policies laissent voir à CE compte.
  accessible: CityMarkerProject[]
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
  // Rattachement par le pays (texte libre, rapproché d'un code ISO par
  // lib/flags)
  codes: string[]
}

const TERRITORIES: Territory[] = [
  { key: "yvelines", label: "Yvelines", outline: YVELINES_OUTLINE, codes: ["FR"] },
  { key: "liban", label: "Liban", outline: LIBAN_OUTLINE, codes: ["LB"] },
]

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: "#E3E6E2" }}>
        <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
          Carte des interventions — Yvelines &amp; Liban
        </h2>
      </div>
      {children}
    </div>
  )
}

export default function InterventionMap({ projects, cities, unlinkedCount = 0, cityPairs = [] }: {
  projects: MapProject[]
  // null / absent : la migration 0050 n'est pas passée → mode héritage
  cities?: MapCity[] | null
  // Projets visibles par ce compte qui n'ont encore aucune ville
  unlinkedCount?: number
  // Paires de villes reliées par un même projet — les traits pointillés
  // de MapLinkOverlay. Anonymes, comme les nombres.
  cityPairs?: CityPair[]
}) {
  if (cities != null) {
    return <CitiesMap cities={cities} unlinkedCount={unlinkedCount} cityPairs={cityPairs} />
  }

  // ------- Mode héritage (avant la 0050) : un repère par projet -------
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
    <Card>
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
    </Card>
  )
}

// ------- Mode villes (0050) : un repère par ville -------
function CitiesMap({ cities, unlinkedCount, cityPairs }: { cities: MapCity[]; unlinkedCount: number; cityPairs: CityPair[] }) {
  // Une ville sans plus aucun projet (référentiel orphelin après un
  // détachement) n'a rien à dire sur cette carte.
  const active = cities.filter(c => c.total > 0 || c.accessible.length > 0)

  const panels = TERRITORIES.map(t => {
    const proj = makeProjection(t.outline)
    const assigned = active.filter(c => {
      const code = countryCode(c.country)
      return code !== null && t.codes.includes(code)
    })
    const placed = assigned.filter(c => proj.contains(c.lat, c.lng))
    // Projets ACCESSIBLES distincts du panneau — une triade liée à deux
    // villes du même panneau ne compte qu'une fois.
    const projectIds = new Set(placed.flatMap(c => c.accessible.map(p => p.id)))
    return { ...t, proj, assigned, placed, projectCount: projectIds.size }
  })

  const placedIds = new Set(panels.flatMap(p => p.placed.map(c => c.id)))
  const elsewhere = active.filter(c => !placedIds.has(c.id))
  const nothingPlaced = panels.every(p => p.placed.length === 0)
  // Un trait ne se dessine qu'entre deux repères rendus : une paire
  // dont une ville est hors des deux territoires n'a rien à relier.
  const drawablePairs = cityPairs.filter(p => placedIds.has(p.a) && placedIds.has(p.b))

  return (
    <Card>
      {/* `relative` : la grille porte le calque des liaisons
          (MapLinkOverlay), qui mesure les repères rendus pour tracer
          d'un panneau à l'autre. */}
      <div className="relative grid sm:grid-cols-2">
        {panels.map((panel, i) => (
          <div key={panel.key} className={`p-4 ${i > 0 ? "border-t sm:border-t-0 sm:border-l" : ""}`} style={{ borderColor: "#E3E6E2" }}>
            <div className="relative mx-auto max-w-xs" style={{ aspectRatio: `${W}/${H}` }}>
              <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" role="img"
                aria-label={`${panel.label} — ${panel.placed.length} ville${panel.placed.length > 1 ? "s" : ""}`}>
                <path d={panel.proj.path}
                  fill="var(--brand-accent-soft,#E4F0EC)"
                  stroke="var(--brand-accent,#0E6B5C)"
                  strokeWidth="1.5"
                  strokeLinejoin="round" />
              </svg>
              {panel.placed.map(c => {
                const [x, y] = panel.proj.toXY(c.lat, c.lng)
                return (
                  <CityMarker
                    key={c.id}
                    id={c.id}
                    name={c.name}
                    flag={countryFlag(c.country)}
                    xPct={(x / W) * 100}
                    yPct={(y / H) * 100}
                    projects={c.accessible}
                    hiddenCount={Math.max(0, c.total - c.accessible.length)}
                  />
                )
              })}
            </div>
            <div className="mt-2 text-center text-sm font-medium" style={{ color: "#17211D", fontFamily: "var(--font-sora)" }}>
              {panel.label}
            </div>
            <div className="text-center text-xs" style={{ color: "#66716B" }}>
              {panel.placed.length} ville{panel.placed.length > 1 ? "s" : ""}
              {" · "}{panel.projectCount} projet{panel.projectCount > 1 ? "s" : ""}
            </div>
          </div>
        ))}
        {drawablePairs.length > 0 && <MapLinkOverlay pairs={drawablePairs} />}
      </div>
      {(elsewhere.length > 0 || unlinkedCount > 0 || nothingPlaced || drawablePairs.length > 0) && (
        <div className="px-6 py-3 border-t text-xs space-y-0.5" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
          {drawablePairs.length > 0 && (
            <p>Les pointillés relient les villes d&apos;un même projet.</p>
          )}
          {elsewhere.length > 0 && (
            <p>{elsewhere.length} ville{elsewhere.length > 1 ? "s" : ""} hors de ces deux territoires.</p>
          )}
          {unlinkedCount > 0 && (
            <p>
              {unlinkedCount} projet{unlinkedCount > 1 ? "s" : ""} sans ville renseignée —
              bouton « Villes » de la fiche projet.
            </p>
          )}
          {nothingPlaced && (
            <p>Les repères apparaîtront quand les villes des projets seront renseignées.</p>
          )}
        </div>
      )}
    </Card>
  )
}
