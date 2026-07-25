"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Globe, X, Copy, Check, ExternalLink } from "lucide-react"
import { setPublicPage } from "@/app/(app)/projets/[id]/actions"

// ============================================================
// PR 28 — Activation et partage de la page vitrine publique
// ============================================================
export default function PublicPageDialog({ projectId, token }: { projectId: string; token: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const url = token && typeof window !== "undefined" ? `${window.location.origin}/p/${token}` : null

  async function toggle(enabled: boolean) {
    setBusy(true); setError("")
    const res = await setPublicPage(projectId, enabled)
    if (!res.ok) setError(res.error ?? "Une erreur est survenue.")
    setBusy(false)
    router.refresh()
  }

  async function copyUrl() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium"
        style={{ borderColor: token ? "var(--brand-accent,#0E6B5C)" : "#E3E6E2", color: token ? "var(--brand-accent,#0E6B5C)" : "#17211D" }}>
        <Globe size={15} /> Page publique{token ? " · active" : ""}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
                <Globe size={18} style={{ color: "var(--brand-accent,#0E6B5C)" }} /> Page vitrine publique
              </h3>
              <button onClick={() => setOpen(false)} aria-label="Fermer" style={{ color: "#66716B" }}><X size={20} /></button>
            </div>

            <p className="text-sm mb-4" style={{ color: "#66716B" }}>
              Une page en <strong>lecture seule</strong>, accessible sans compte via un lien
              non devinable : avancement, étapes, indicateurs et actualités publiées.
              Aucune donnée sensible (membres, emails, budget détaillé, journal).
              À partager aux élus, partenaires et à la presse.
            </p>

            {token ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input readOnly value={url ?? ""} className="flex-1 px-3 py-2 rounded-xl border text-xs font-mono" style={{ borderColor: "#E3E6E2", color: "#17211D" }} />
                  <button onClick={copyUrl} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium flex-shrink-0" style={{ borderColor: "#E3E6E2", color: "#17211D" }}>
                    {copied ? <Check size={14} style={{ color: "var(--brand-accent,#0E6B5C)" }} /> : <Copy size={14} />} {copied ? "Copié" : "Copier"}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm underline" style={{ color: "var(--brand-accent,#0E6B5C)" }}>
                      <ExternalLink size={14} /> Ouvrir la page
                    </a>
                  )}
                  <button onClick={() => toggle(false)} disabled={busy} className="ml-auto text-xs underline" style={{ color: "#A3342C" }}>
                    {busy ? "…" : "Désactiver (le lien cessera de fonctionner)"}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => toggle(true)} disabled={busy}
                className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
                style={{ background: "var(--brand-accent,#0E6B5C)", opacity: busy ? 0.7 : 1 }}>
                {busy ? "…" : "Activer la page publique"}
              </button>
            )}

            {error && <p className="text-sm rounded-lg px-3 py-2 mt-3" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
          </div>
        </div>
      )}
    </>
  )
}
