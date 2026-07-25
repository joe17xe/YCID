"use client"
import { useEffect, useId, useRef, useState } from "react"
import { X } from "lucide-react"

// ============================================================
// PR 37 — Dialogue accessible (RGAA / WCAG 2.1)
// ============================================================
// Obligation pour une plateforme du secteur public. Ce composant
// centralise ce que chaque modal doit garantir :
//  · role="dialog" + aria-modal + aria-labelledby (titre annoncé)
//  · focus déplacé dans le dialogue à l'ouverture, RESTITUÉ à l'élément
//    d'origine à la fermeture
//  · focus PIÉGÉ : Tab et Maj+Tab tournent dans le dialogue
//  · Échap ferme (sauf traitement en cours)
//  · défilement de la page bloqué pendant l'ouverture

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  headerExtra?: React.ReactNode
  maxWidth?: string
  busy?: boolean // empêche la fermeture pendant un traitement
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ open, onClose, title, icon, children, footer, headerExtra, maxWidth = "max-w-3xl", busy = false }: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const [viewportH, setViewportH] = useState<number | null>(null)

  // Clavier virtuel (mobile). `vh` mesure le viewport de MISE EN PAGE,
  // qui ne rétrécit pas à l'ouverture du clavier : un dialogue en
  // max-h-[92vh] croit donc disposer de tout l'écran et laisse sa moitié
  // basse sous le clavier. Seul le viewport VISUEL reflète la surface
  // réellement libre — d'où visualViewport, qui couvre iOS comme Android
  // (les unités `dvh` ne réagissent pas au clavier sur iOS).
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setViewportH(vv.height)
    update()
    vv.addEventListener("resize", update)
    return () => { vv.removeEventListener("resize", update); setViewportH(null) }
  }, [open])

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement | null
    document.body.style.overflow = "hidden"

    // Focus initial : premier élément interactif, sinon le panneau
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) { e.preventDefault(); onClose(); return }
      if (e.key !== "Tab" || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el === document.activeElement)
      if (!items.length) return
      const firstEl = items[0], lastEl = items[items.length - 1]
      // Piège : on boucle au lieu de sortir du dialogue
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = ""
      previousFocus.current?.focus()
    }
  }, [open, busy, onClose])

  if (!open) return null

  return (
    // Alignement haut sur mobile, centré à partir de sm : centrer
    // verticalement fait glisser le champ actif dès que la hauteur du
    // contenu change en cours de frappe (compteur de répartition,
    // message de dépassement).
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4"
      style={viewportH ? { height: `${viewportH}px` } : undefined}
    >
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative bg-white rounded-2xl shadow-xl w-full ${maxWidth} ${viewportH ? "max-h-full" : "max-h-[92dvh]"} flex flex-col focus:outline-none`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#E3E6E2" }}>
          <h2 id={titleId} className="font-bold flex items-center gap-2 min-w-0" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
            {icon}<span className="truncate">{title}</span>
          </h2>
          <span className="flex items-center gap-1 flex-shrink-0">
            {headerExtra}
            <button onClick={onClose} disabled={busy} aria-label="Fermer la fenêtre"
              className="p-1.5 rounded-lg hover:bg-gray-50" style={{ color: "#66716B" }}>
              <X size={20} />
            </button>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center gap-2 px-6 py-4 border-t flex-wrap" style={{ borderColor: "#E3E6E2" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// Message d'erreur annoncé aux lecteurs d'écran (role="alert" + aria-live)
export function ErrorMessage({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" aria-live="assertive" className="text-sm rounded-lg px-3 py-2"
      style={{ background: "#F6E7E5", color: "#A3342C" }}>
      {children}
    </p>
  )
}

// Confirmation / succès : annonce non intrusive
export function SuccessMessage({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <p role="status" aria-live="polite" className="text-sm rounded-lg px-3 py-2"
      style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>
      {children}
    </p>
  )
}
