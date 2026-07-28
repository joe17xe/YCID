"use client"
import { useEffect, useRef, useState } from "react"

// ============================================================
// Liaisons entre les villes d'un même projet (28/07)
// ============================================================
// « Ce serait sympa de montrer sur les cartes les liens » : un trait
// pointillé relie les villes qu'un projet enjambe — Villepreux ↔ Azour
// d'un panneau à l'autre pour une triade, deux villes libanaises pour
// un échange.
//
// Les deux panneaux sont des SVG séparés avec chacun sa projection :
// aucune géométrie commune où tracer un trait qui les traverse. On
// mesure donc les repères RENDUS (les boutons portent data-city-dot)
// et on dessine dans un calque absolu par-dessus la grille — recalculé
// au redimensionnement, y compris quand les panneaux s'empilent sur
// téléphone. Le calque ne capte aucun clic (pointer-events-none) : les
// repères restent des boutons.
//
// Les traits sont ANONYMES : ils disent qu'un projet relie deux
// villes, jamais lequel — la même règle que les nombres (« visualiser
// sans accéder », 0050). Le décor est marqué aria-hidden : le panneau
// d'une ville raconte déjà l'histoire aux lecteurs d'écran.

export type CityPair = { a: string; b: string }

type Line = { x1: number; y1: number; x2: number; y2: number }

export default function MapLinkOverlay({ pairs }: { pairs: CityPair[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = ref.current
    const host = el?.parentElement
    if (!el || !host) return
    function measure() {
      if (!host) return
      const base = host.getBoundingClientRect()
      const next: Line[] = []
      for (const { a, b } of pairs) {
        const da = host.querySelector(`[data-city-dot="${CSS.escape(a)}"]`)
        const db = host.querySelector(`[data-city-dot="${CSS.escape(b)}"]`)
        // Une ville hors des deux territoires n'a pas de repère : son
        // trait est simplement absent, comme elle.
        if (!da || !db) continue
        const ra = da.getBoundingClientRect()
        const rb = db.getBoundingClientRect()
        next.push({
          x1: ra.left + ra.width / 2 - base.left,
          y1: ra.top + ra.height / 2 - base.top,
          x2: rb.left + rb.width / 2 - base.left,
          y2: rb.top + rb.height / 2 - base.top,
        })
      }
      setSize({ w: base.width, h: base.height })
      setLines(next)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(host)
    window.addEventListener("resize", measure)
    return () => { ro.disconnect(); window.removeEventListener("resize", measure) }
  }, [pairs])

  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0 pointer-events-none">
      {size.w > 0 && lines.length > 0 && (
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none">
          {lines.map((l, i) => {
            // Léger arc — un trait droit traverserait les contours comme
            // une rature ; le point de contrôle est décalé
            // perpendiculairement au segment.
            const mx = (l.x1 + l.x2) / 2
            const my = (l.y1 + l.y2) / 2
            const dx = l.x2 - l.x1
            const dy = l.y2 - l.y1
            const len = Math.hypot(dx, dy) || 1
            const off = Math.min(28, len * 0.12)
            const cx = mx - (dy / len) * off
            const cy = my + (dx / len) * off
            return (
              <path key={i}
                d={`M${l.x1},${l.y1} Q${cx},${cy} ${l.x2},${l.y2}`}
                fill="none"
                stroke="var(--brand-accent,#0E6B5C)"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                strokeLinecap="round"
                opacity="0.4" />
            )
          })}
        </svg>
      )}
    </div>
  )
}
