"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { updateAiPricing } from "@/app/(app)/admin/configuration/settings-actions"
import type { AiUsageSummary } from "@/lib/ai-usage"

// ============================================================
// Consommation d'IA (0043)
// ============================================================
// L'application appelait un fournisseur payant sans compteur. Ce
// panneau répond à trois questions qui n'avaient aucune réponse :
// combien de jetons, pour quel coût, et où en est-on du budget.

const label = "block text-xs font-semibold mb-1 tracking-wider"
const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

const fmtNum = (n: number) => Math.round(n).toLocaleString("fr-FR")

export default function AiUsagePanel({ usage }: { usage: AiUsageSummary }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    priceIn: String(usage.priceIn ?? 0),
    priceOut: String(usage.priceOut ?? 0),
    monthlyBudget: String(usage.monthlyBudget ?? 0),
    currency: usage.currency ?? "EUR",
  })

  const fmtCost = (n: number) =>
    `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${usage.currency}`

  const budget = Number(form.monthlyBudget) || 0
  const pct = budget > 0 ? Math.round((usage.month.cost / budget) * 100) : 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setOk("")
    startTransition(async () => {
      const res = await updateAiPricing(form)
      if (res.ok) { setOk("Tarifs enregistrés."); router.refresh() }
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border p-6" style={border}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: "#17211D" }}>Consommation du mois en cours</h3>
        <p className="text-xs mb-4" style={{ color: "#66716B" }}>
          Chaque appel au fournisseur est compté, y compris les tentatives échouées : elles
          consomment des jetons d&apos;entrée, et deux essais coûtent deux fois.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {[
            { label: "Jetons ce mois-ci", value: fmtNum(usage.month.total), color: "#17211D" },
            { label: "Appels", value: `${usage.month.calls}${usage.month.failed > 0 ? ` · ${usage.month.failed} en échec` : ""}`, color: usage.month.failed > 0 ? "#B4690E" : "#17211D" },
            {
              label: usage.configured ? "Coût estimé" : "Coût — tarifs non saisis",
              value: usage.configured ? fmtCost(usage.month.cost) : "—",
              color: usage.configured ? "var(--brand-accent,#0E6B5C)" : "#9AA39D",
            },
            { label: "Depuis l'origine", value: `${fmtNum(usage.allTime.total)} jetons`, color: "#66716B" },
          ].map(t => (
            <div key={t.label} className="rounded-xl border p-3" style={{ ...border, background: "#FAFBFA" }}>
              <div className="text-lg font-bold" style={{ fontFamily: "var(--font-sora)", color: t.color }}>{t.value}</div>
              <div className="text-xs mt-0.5" style={{ color: "#66716B" }}>{t.label}</div>
            </div>
          ))}
        </div>

        {/* Le budget ne bloque rien : il alerte. Interrompre un rapport la
            veille d'un COPIL parce qu'un plafond est atteint serait pire
            que la dépense évitée. */}
        {budget > 0 && usage.configured && (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1" style={{ color: "#66716B" }}>
              <span>{fmtCost(usage.month.cost)} sur un budget de {fmtCost(budget)}</span>
              <span style={{ color: pct >= 80 ? "#A3342C" : "#66716B" }}>{pct} %</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#E3E6E2" }}>
              <div className="h-full rounded-full" style={{
                width: `${Math.min(100, pct)}%`,
                background: pct >= 100 ? "#A3342C" : pct >= 80 ? "#B4690E" : "var(--brand-accent,#0E6B5C)",
              }} />
            </div>
            {pct >= 80 && (
              <p className="text-xs mt-2 rounded-lg px-3 py-2" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
                {pct >= 100
                  ? "Budget mensuel dépassé. Rien n'est bloqué — l'application continue de fonctionner — mais la dépense court."
                  : "Vous approchez du budget mensuel."}
              </p>
            )}
          </div>
        )}

        {usage.byFeature.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
                  {["Fonction", "Appels", "Jetons", "Coût estimé"].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold" style={{ color: "#66716B" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usage.byFeature.map(f => (
                  <tr key={f.feature} style={{ borderBottom: "1px solid #F0F2F0" }}>
                    <td className="px-3 py-2" style={{ color: "#17211D" }}>{f.feature}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: "#66716B" }}>{f.calls}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: "#66716B" }}>{fmtNum(f.total)}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: "#66716B" }}>{usage.configured ? fmtCost(f.cost) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Annoncer l'incertitude plutôt qu'un chiffre faux : certains
            appels n'ont qu'un total, sans répartition entrée/sortie. */}
        {usage.partial && (
          <p className="text-xs mt-3" style={{ color: "#66716B" }}>
            Certains appels ne renseignent pas la répartition entrée / sortie — notamment
            l&apos;historique repris. Ils sont imputés au tarif d&apos;entrée, le moins cher :
            le coût réel est donc <strong>supérieur</strong> à l&apos;estimation affichée.
          </p>
        )}
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl border p-6 space-y-4" style={border}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "#17211D" }}>Tarifs et budget</h3>
          <p className="text-xs mt-0.5" style={{ color: "#66716B" }}>
            Les prix dépendent du fournisseur et du modèle, et changent : ils ne sont pas devinés,
            ils se saisissent. Relevez-les sur la page tarifaire de votre fournisseur. Tant qu&apos;ils
            valent zéro, seuls les jetons sont comptés.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="p-in" className={label} style={{ color: "#66716B" }}>PRIX ENTRÉE / MILLION</label>
            <input id="p-in" type="number" min={0} step="0.001" value={form.priceIn}
              onChange={e => setForm({ ...form, priceIn: e.target.value })} className={inputCls} style={border} />
          </div>
          <div>
            <label htmlFor="p-out" className={label} style={{ color: "#66716B" }}>PRIX SORTIE / MILLION</label>
            <input id="p-out" type="number" min={0} step="0.001" value={form.priceOut}
              onChange={e => setForm({ ...form, priceOut: e.target.value })} className={inputCls} style={border} />
            <p className="text-xs mt-1" style={{ color: "#66716B" }}>
              La sortie coûte souvent 3 à 8 fois l&apos;entrée.
            </p>
          </div>
          <div>
            <label htmlFor="p-cur" className={label} style={{ color: "#66716B" }}>DEVISE</label>
            <input id="p-cur" value={form.currency} maxLength={4}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} className={inputCls} style={border} />
          </div>
        </div>

        <div>
          <label htmlFor="p-budget" className={label} style={{ color: "#66716B" }}>BUDGET MENSUEL</label>
          <input id="p-budget" type="number" min={0} step="1" value={form.monthlyBudget}
            onChange={e => setForm({ ...form, monthlyBudget: e.target.value })} className={inputCls} style={border} />
          <p className="text-xs mt-1" style={{ color: "#66716B" }}>
            Repère et alerte, <strong>pas un blocage</strong> : dépasser le budget n&apos;interrompt
            aucune génération. Interrompre un rapport la veille d&apos;un COPIL coûterait plus
            que la dépense évitée. 0 = pas de budget suivi.
          </p>
        </div>

        {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
        {ok && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#E4F0EC", color: "#0E6B5C" }}>{ok}</p>}

        <button type="submit" disabled={pending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
          style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
          <Check size={16} /> {pending ? "…" : "Enregistrer"}
        </button>
      </form>
    </div>
  )
}
