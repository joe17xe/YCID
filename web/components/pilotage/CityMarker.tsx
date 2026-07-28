"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { FolderOpen, Lock } from "lucide-react"

// ============================================================
// Repère d'une ville sur la carte des interventions (28/07)
// ============================================================
// Le repère est une VILLE, plus un projet : cliquer ouvre la liste des
// projets qui l'impliquent. La liste ne contient que les projets que
// les policies laissent voir à ce compte ; les autres ne sont ni
// nommés ni cliquables — juste comptés (« visualiser sans accéder »,
// arbitrage de la 0050).
//
// Même mécanique que le menu « ⋯ » du tableau (RowMenu) : panneau en
// `fixed` — le conteneur de la carte fige un ratio, un panneau absolu
// y serait rogné — refermé au moindre défilement, à Échap, au clic
// hors du panneau.

const POP_WIDTH = 232

export type CityMarkerProject = { id: string; name: string }

export default function CityMarker({ name, flag, xPct, yPct, projects, hiddenCount }: {
  name: string
  flag: string | null
  xPct: number
  yPct: number
  projects: CityMarkerProject[]
  hiddenCount: number
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const open = pos !== null
  const total = projects.length + hiddenCount

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    if (open) { setPos(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    const left = Math.min(
      Math.max(8, r.left + r.width / 2 - POP_WIDTH / 2),
      window.innerWidth - POP_WIDTH - 8
    )
    setPos({ top: r.bottom + 6, left })
  }

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPos(null)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPos(null)
    }
    function onScroll() { setPos(null) }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onScroll)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
    }
  }, [open])

  return (
    <div ref={ref} className="contents">
      {/* Cible tactile de 24 px autour d'un point de 12 px : un doigt
          n'est pas une souris. */}
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${name} — ${total} projet${total > 1 ? "s" : ""}`}
        title={name}
        className="absolute w-6 h-6 flex items-center justify-center"
        style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)" }}
      >
        <span
          className="block w-3 h-3 rounded-full border-2 border-white shadow-md transition-transform hover:scale-125"
          style={{ background: "var(--brand-accent,#0E6B5C)" }}
        />
      </button>
      {open && (
        <div
          role="group"
          aria-label={`Projets à ${name}`}
          className="fixed z-50 bg-white rounded-xl border shadow-lg p-2"
          style={{ borderColor: "#E3E6E2", top: pos.top, left: pos.left, width: POP_WIDTH }}
        >
          <div className="px-2 pt-1 pb-1.5 border-b" style={{ borderColor: "#E3E6E2" }}>
            <div className="text-sm font-semibold" style={{ color: "#17211D", fontFamily: "var(--font-sora)" }}>
              {flag && <span className="mr-1.5" aria-hidden="true">{flag}</span>}{name}
            </div>
            <div className="text-xs" style={{ color: "#66716B" }}>
              {total} projet{total > 1 ? "s" : ""}
            </div>
          </div>
          <div className="pt-1 space-y-0.5">
            {projects.map(p => (
              <Link
                key={p.id}
                href={`/projets/${p.id}`}
                onClick={() => setPos(null)}
                className="flex items-start gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                style={{ color: "#17211D" }}
              >
                <FolderOpen size={14} aria-hidden="true" className="mt-0.5 flex-shrink-0" style={{ color: "#66716B" }} />
                <span className="min-w-0">{p.name}</span>
              </Link>
            ))}
            {projects.length === 0 && (
              <p className="px-2 py-1.5 text-xs" style={{ color: "#66716B" }}>
                Aucun projet accessible pour votre compte.
              </p>
            )}
            {hiddenCount > 0 && (
              <p className="flex items-center gap-1.5 px-2 py-1 text-xs" style={{ color: "#66716B" }}>
                <Lock size={11} aria-hidden="true" />
                {hiddenCount} projet{hiddenCount > 1 ? "s" : ""} sans accès pour votre compte
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
