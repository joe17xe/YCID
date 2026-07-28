"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { MoreHorizontal, FolderOpen, PieChart, Globe } from "lucide-react"

// ============================================================
// Menu « ⋯ » d'une ligne du tableau des projets (V1, Lot 2)
// ============================================================
// Trois gestes, pas plus : Ouvrir, Budget, Vitrine publique. La vitrine
// n'apparaît QUE si le projet en a une (public_token, opt-in de la 0021) —
// une entrée qui mènerait à une page inexistante serait un bouton mort,
// exactement ce que la PR 3 a chassé.
//
// Le menu est positionné en `fixed`, pas en `absolute` : le tableau vit
// dans un conteneur `overflow-x-auto` (règle « rien ne sort du cadre du
// téléphone »), et un conteneur qui défile en x rogne AUSSI en y — un
// menu absolu y serait coupé ou déclencherait un ascenseur dans le
// tableau. Il se referme donc au moindre défilement : sa position ne
// suit pas la page, mieux vaut disparaître que flotter au mauvais endroit.

const MENU_WIDTH = 192 // w-48

export default function RowMenu({ projectId, publicToken, projectName }: {
  projectId: string
  publicToken: string | null
  projectName: string
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const open = pos !== null

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    if (open) { setPos(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: Math.max(8, r.right - MENU_WIDTH) })
  }

  // Fermeture au clic hors du menu, à Échap (RGAA : le clavier suffit)
  // et au défilement (position fixe, voir en-tête).
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

  const item = "flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-gray-50 transition-colors"

  return (
    <div ref={ref} className="inline-block">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions — ${projectName}`}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        style={{ color: "#66716B" }}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`Actions — ${projectName}`}
          className="fixed z-50 bg-white rounded-xl border shadow-lg p-1"
          style={{ borderColor: "#E3E6E2", top: pos.top, left: pos.left, width: MENU_WIDTH }}
        >
          <Link role="menuitem" href={`/projets/${projectId}`} className={item} style={{ color: "#17211D" }} onClick={() => setPos(null)}>
            <FolderOpen size={15} aria-hidden="true" style={{ color: "#66716B" }} /> Ouvrir
          </Link>
          <Link role="menuitem" href={`/projets/${projectId}?tab=budget`} className={item} style={{ color: "#17211D" }} onClick={() => setPos(null)}>
            <PieChart size={15} aria-hidden="true" style={{ color: "#66716B" }} /> Budget
          </Link>
          {publicToken && (
            <Link role="menuitem" href={`/p/${publicToken}`} className={item} style={{ color: "#17211D" }} onClick={() => setPos(null)}>
              <Globe size={15} aria-hidden="true" style={{ color: "#66716B" }} /> Vitrine publique
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
