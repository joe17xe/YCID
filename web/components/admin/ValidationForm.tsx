"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { updateValidationSettings } from "@/app/(app)/admin/configuration/settings-actions"

// ============================================================
// Configuration du circuit de validation (0042)
// ============================================================
// La 0041 avait posé la chaîne — porteur, puis coordinateur — mais ses
// réglages ne se changeaient qu'en SQL. Un circuit qu'on ne peut pas
// régler depuis l'application n'est pas paramétrable, quoi qu'en dise
// la documentation.

const label = "block text-xs font-semibold mb-1 tracking-wider"
const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

export default function ValidationForm({ settings, organizations, projects }: {
  settings: { coordinator_org_id: string | null; coordinator_min_amount: number }
  organizations: { id: string; name: string }[]
  projects: { name: string; leadName: string | null }[]
}) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    coordinatorOrgId: settings.coordinator_org_id ?? "",
    minAmount: String(settings.coordinator_min_amount ?? 0),
  })

  const coordName = organizations.find(o => o.id === form.coordinatorOrgId)?.name ?? "—"
  const seuil = Number(form.minAmount) > 0 ? Number(form.minAmount) : 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setOk("")
    startTransition(async () => {
      const res = await updateValidationSettings(form)
      if (res.ok) { setOk("Circuit enregistré."); router.refresh() }
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border p-6 space-y-5" style={border}>
      <div>
        <label htmlFor="coord-org" className={label} style={{ color: "#66716B" }}>ORGANISATION COORDINATRICE</label>
        <select id="coord-org" value={form.coordinatorOrgId}
          onChange={e => setForm({ ...form, coordinatorOrgId: e.target.value })}
          className={inputCls} style={border}>
          <option value="">Aucune — l&apos;organisation porteuse valide seule</option>
          {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <p className="text-xs mt-1" style={{ color: "#66716B" }}>
          Second et dernier échelon du circuit : elle entérine ce que l&apos;organisation
          porteuse a validé. Laisser vide réduit le circuit à une seule étape.
        </p>
      </div>

      <div>
        <label htmlFor="min-amount" className={label} style={{ color: "#66716B" }}>
          SEUIL DE SOLLICITATION DU COORDINATEUR (€)
        </label>
        <input id="min-amount" type="number" min={0} step="1" value={form.minAmount}
          onChange={e => setForm({ ...form, minAmount: e.target.value })}
          className={inputCls} style={border} />
        <p className="text-xs mt-1" style={{ color: "#66716B" }}>
          En dessous de ce montant, l&apos;organisation porteuse valide seule.
          <strong> 0 = aucun seuil</strong>, le coordinateur est sollicité pour tout devis.
        </p>
        {/* Le porteur n'est jamais sauté : une dépense engage toujours
            quelqu'un. Un seuil qui supprimerait toute validation ferait
            du circuit une option. */}
        <p className="text-xs mt-1" style={{ color: "#66716B" }}>
          L&apos;organisation porteuse, elle, valide <strong>toujours</strong> — quel que soit
          le montant.
        </p>
      </div>

      {/* Montrer le circuit obtenu, projet par projet. Un réglage dont on
          ne voit pas l'effet se règle à l'aveugle. */}
      <div className="rounded-xl border p-4" style={{ ...border, background: "#FAFBFA" }}>
        <p className="text-xs font-semibold mb-2 tracking-wider" style={{ color: "#66716B" }}>
          CIRCUIT OBTENU
        </p>
        {projects.length === 0 ? (
          <p className="text-xs" style={{ color: "#9AA39D" }}>Aucun projet.</p>
        ) : (
          <ul className="space-y-1.5">
            {projects.map(p => {
              const meme = p.leadName && p.leadName === coordName
              return (
                <li key={p.name} className="text-xs" style={{ color: "#17211D" }}>
                  <span style={{ color: "#66716B" }}>{p.name} — </span>
                  {p.leadName ?? <span style={{ color: "#A3342C" }}>aucune organisation porteuse</span>}
                  {p.leadName && form.coordinatorOrgId && !meme && ` → ${coordName}`}
                  {meme && <span style={{ color: "#66716B" }}> (porteur et coordinateur confondus : une seule étape)</span>}
                  {seuil > 0 && p.leadName && form.coordinatorOrgId && !meme && (
                    <span style={{ color: "#66716B" }}> — en dessous de {seuil.toLocaleString("fr-FR")} €, {p.leadName} seule</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="text-xs" style={{ color: "#66716B" }}>
        L&apos;organisation porteuse se règle projet par projet, dans <strong>Modifier la fiche
        du projet</strong>.
      </p>

      {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
      {ok && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#E4F0EC", color: "#0E6B5C" }}>{ok}</p>}

      <button type="submit" disabled={pending}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
        style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
        <Check size={16} /> {pending ? "…" : "Enregistrer"}
      </button>
    </form>
  )
}
