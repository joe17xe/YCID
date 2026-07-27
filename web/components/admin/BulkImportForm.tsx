"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Upload, Copy, Check, AlertTriangle } from "lucide-react"
import { PLATFORM_ROLES } from "@/lib/constants"
import { parseRecipients } from "@/lib/recipients"
import { createUsersBulk, type BulkLine } from "@/app/(app)/admin/utilisateurs/user-actions"

// ============================================================
// PR 35 — Import en masse d'utilisateurs
// ============================================================
// Les mots de passe temporaires ne sont affichés QU'UNE fois, juste
// après l'import : ils ne sont jamais réaffichables ensuite.

const border = { borderColor: "#E3E6E2" }

export default function BulkImportForm({ canCreateAdmin }: { canCreateAdmin: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [raw, setRaw] = useState("")
  const [role, setRole] = useState("user")
  const [error, setError] = useState("")
  const [lines, setLines] = useState<BulkLine[] | null>(null)
  const [copied, setCopied] = useState(false)

  // Aperçu en direct : l'utilisateur voit ce qui sera créé avant d'agir
  const preview = parseRecipients(raw)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setLines(null)
    startTransition(async () => {
      const res = await createUsersBulk(raw, role)
      if (res.ok && res.lines) { setLines(res.lines); router.refresh() }
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  async function copyCreds() {
    const created = (lines ?? []).filter(l => l.status === "cree")
    await navigator.clipboard.writeText(
      created.map(l => `${l.fullName}\t${l.email}\t${l.password}`).join("\n")
    )
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const roleOptions = Object.entries(PLATFORM_ROLES).filter(([k]) => canCreateAdmin || k !== "admin")
  const createdCount = (lines ?? []).filter(l => l.status === "cree").length

  if (lines) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border p-6" style={border}>
          <h2 className="font-semibold mb-3" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
            Résultat de l&apos;import
          </h2>
          {createdCount > 0 && (
            <p className="text-sm rounded-lg px-3 py-2 mb-3 flex items-start gap-2" style={{ background: "#F7EDDD", color: "#B4690E" }}>
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>Copiez les mots de passe temporaires maintenant : ils ne seront <strong>plus jamais affichés</strong>. Transmettez-les de façon sécurisée ; chacun pourra le changer dans ses Préférences.</span>
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 620 }}>
              <thead>
                <tr style={{ background: "#F5F6F4" }}>
                  {["Nom", "Email", "État", "Mot de passe temporaire"].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold" style={{ color: "#66716B" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.email} style={{ borderTop: "1px solid #E3E6E2" }}>
                    <td className="px-3 py-2" style={{ color: "#17211D" }}>{l.fullName}</td>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: "#66716B" }}>{l.email}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={
                        l.status === "cree" ? { background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }
                        : l.status === "existe" ? { background: "#EEF0EE", color: "#66716B" }
                        : { background: "#F6E7E5", color: "#A3342C" }
                      }>
                        {l.status === "cree" ? "créé" : l.status === "existe" ? "existait déjà" : "échec"}
                      </span>
                      {l.error && <div className="text-xs mt-1" style={{ color: "#A3342C" }}>{l.error}</div>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: "#17211D" }}>{l.password ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {createdCount > 0 && (
            <button onClick={copyCreds} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium" style={{ ...border, color: "#17211D" }}>
              {copied ? <Check size={15} style={{ color: "var(--brand-accent,#0E6B5C)" }} /> : <Copy size={15} />} {copied ? "Copié" : "Copier les identifiants"}
            </button>
          )}
          <button onClick={() => { setLines(null); setRaw("") }} className="text-sm underline" style={{ color: "#66716B" }}>
            Nouvel import
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="bg-white rounded-2xl border p-6 space-y-5" style={border}>
        <div>
          <label htmlFor="bulk-raw" className="block text-xs font-semibold mb-1 tracking-wider" style={{ color: "#66716B" }}>
            ADRESSES À IMPORTER
          </label>
          <textarea id="bulk-raw" rows={8} value={raw} onChange={e => setRaw(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border text-sm font-mono" style={border}
            placeholder={'Clara BEAUCAIRE <clara.beaucaire@villepreux.fr>; d.morin@jouy-en-josas.fr;\nmariechristine.buale@gmail.com'} />
          <p className="text-xs mt-1" style={{ color: "#66716B" }}>
            {preview.length > 0
              ? `${preview.length} adresse${preview.length > 1 ? "s" : ""} détectée${preview.length > 1 ? "s" : ""} : ${preview.slice(0, 4).map(r => r.email).join(", ")}${preview.length > 4 ? "…" : ""}`
              : "Aucune adresse détectée pour l'instant. 50 maximum par import."}
          </p>
        </div>
        <div>
          <label htmlFor="bulk-role" className="block text-xs font-semibold mb-1 tracking-wider" style={{ color: "#66716B" }}>
            RÔLE ATTRIBUÉ À TOUS
          </label>
          <select id="bulk-role" value={role} onChange={e => setRole(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border text-sm" style={border}>
            {roleOptions.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <p className="text-xs mt-1" style={{ color: "#66716B" }}>
            Modifiable individuellement ensuite. Les comptes existants sont ignorés, jamais écrasés.
          </p>
        </div>
      </div>

      {error && <p className="text-sm rounded-lg px-3 py-2" role="alert" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}

      <button type="submit" disabled={pending || preview.length === 0}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
        style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending || preview.length === 0 ? 0.6 : 1 }}>
        <Upload size={16} /> {pending ? "Import en cours…" : `Créer ${preview.length || ""} compte${preview.length > 1 ? "s" : ""}`}
      </button>
    </form>
  )
}
