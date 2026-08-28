"use client"
import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, BellRing } from "lucide-react"
import BaseModal, { ErrorMessage } from "@/components/ui/Modal"
import { fmtEur } from "@/lib/budget"
import { fmtDate } from "@/lib/constants"
import { saveFundingCall, setFundingCallStatus, deleteFundingCall, sendFundingReminder } from "@/app/(app)/projets/[id]/actions"

// ============================================================
// Appels de fonds (0066) — la section de l'onglet Budget
// ============================================================
// Les promesses annuelles de financement et leurs relances. Trois
// décisions d'écran, toutes issues des arbitrages de la roadmap :
//   · le budget s'AFFICHE à côté de la promesse (ce que budget_lines
//     prévoit pour ce financeur cette année-là) et l'écart se signale —
//     mais rien ne bloque jamais : la promesse est la réalité
//     politique, le budget la référence ;
//   · la relance est un BOUTON, pas un automatisme — et quand
//     l'organisation n'a aucun compte, le serveur le dit et l'écran le
//     répète tel quel, plutôt que de laisser croire qu'un rappel est
//     parti ;
//   · pas de balise tableau : les rangées sont des div — la règle
//     mobile du dépôt (check:mobile) vaut pour les nouveaux écrans.

export interface FundingCallRow {
  id: string
  year: number
  payer_org_id: string
  beneficiary_org_id: string | null
  amount: number
  note: string | null
  status: string
  requested_at: string | null
  received_at: string | null
  last_reminder_at: string | null
}

interface Option { id: string; name: string }

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

// promis / demandé / reçu — l'état colore, la date précise.
const STATUS_UI: Record<string, { label: string; fg: string; bg: string }> = {
  promis: { label: "Promis", fg: "#66716B", bg: "#EEF0EE" },
  demande: { label: "Demandé", fg: "#8A6A1F", bg: "#F7EDDD" },
  recu: { label: "Reçu", fg: "var(--brand-accent,#0E6B5C)", bg: "var(--brand-accent-soft,#E4F0EC)" },
}

function Field({ label, children }: { label: React.ReactNode; children: (id: string) => React.ReactNode }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>{label}</label>
      {children(id)}
    </div>
  )
}

// ------------------------------------------------------------
// Le dialogue — création et modification
// ------------------------------------------------------------
function FundingCallDialog({ projectId, orgs, budgetRef, call, onClose }: {
  projectId: string
  orgs: Option[]
  budgetRef: Record<string, number>
  call?: FundingCallRow
  onClose: () => void
}) {
  const router = useRouter()
  const [year, setYear] = useState(String(call?.year ?? new Date().getFullYear()))
  const [payer, setPayer] = useState(call?.payer_org_id ?? "")
  const [beneficiary, setBeneficiary] = useState(call?.beneficiary_org_id ?? "")
  const [amount, setAmount] = useState(call ? String(call.amount) : "")
  const [note, setNote] = useState(call?.note ?? "")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  // La référence budgétaire du financeur choisi, pour l'année saisie —
  // calculée par la page (hors valorisation), simplement lue ici.
  const ref = payer ? budgetRef[`${payer}|${Math.floor(Number(year))}`] : undefined
  const amountNum = Number(String(amount).replace(",", ".") || "0")
  const gap = ref !== undefined && Number.isFinite(amountNum) ? amountNum - ref : null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await saveFundingCall({
        projectId, callId: call?.id, year, payerOrgId: payer,
        beneficiaryOrgId: beneficiary || null, amount, note,
      })
      if (res.ok) { onClose(); router.refresh() }
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  function remove() {
    if (!call) return
    if (!window.confirm("Supprimer cet appel de fonds ? La suppression sera tracée au Journal.")) return
    setError("")
    startTransition(async () => {
      const res = await deleteFundingCall({ projectId, callId: call.id })
      if (res.ok) { onClose(); router.refresh() }
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <BaseModal open onClose={onClose} title={call ? "Modifier l'appel de fonds" : "Nouvel appel de fonds"} busy={pending} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Année">
            {id => <input id={id} type="number" min={2000} max={2100} required value={year}
              onChange={e => setYear(e.target.value)} className={inputCls} style={border} />}
          </Field>
          <Field label="Montant (€)">
            {id => <input id={id} type="text" inputMode="decimal" required value={amount} placeholder="2000"
              onChange={e => setAmount(e.target.value)} className={inputCls} style={border} />}
          </Field>
        </div>
        <Field label="Organisation qui s'engage à payer">
          {id => (
            <select id={id} required value={payer} onChange={e => setPayer(e.target.value)} className={inputCls} style={border}>
              <option value="">— choisir —</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Reçoit le versement">
          {id => (
            <select id={id} value={beneficiary} onChange={e => setBeneficiary(e.target.value)} className={inputCls} style={border}>
              <option value="">— pour le projet lui-même (réserver) —</option>
              {orgs.filter(o => o.id !== payer).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </Field>
        {/* La comparaison promise ↔ budget, sans blocage : une phrase. */}
        {payer && (
          <p className="text-xs rounded-xl px-3 py-2" style={{
            background: gap !== null && Math.abs(gap) >= 1 ? "#F7EDDD" : "#F5F6F4",
            color: gap !== null && Math.abs(gap) >= 1 ? "#8A6A1F" : "#66716B",
          }}>
            {ref === undefined
              ? <>Aucune ligne budgétaire ne prévoit ce financeur pour {Math.floor(Number(year)) || "cette année"} — la promesse reste libre, le budget pourra suivre.</>
              : <>Le budget {Math.floor(Number(year))} prévoit <strong>{fmtEur(ref)}</strong> pour ce financeur (hors valorisation)
                {gap !== null && Math.abs(gap) >= 1 && <> — écart de <strong>{gap > 0 ? "+" : ""}{fmtEur(gap)}</strong> avec la promesse</>}.</>}
          </p>
        )}
        <Field label="Note (facultative)">
          {id => <textarea id={id} rows={2} value={note} onChange={e => setNote(e.target.value)} className={inputCls} style={border}
            placeholder="Ex. : versement attendu avant le COPIL de juin" />}
        </Field>
        <ErrorMessage>{error}</ErrorMessage>
        <div className="flex items-center justify-between gap-2 pt-1">
          {call ? (
            <button type="button" onClick={remove} disabled={pending}
              className="px-3 py-2 rounded-xl text-sm font-medium" style={{ color: "#A33B2E" }}>
              Supprimer
            </button>
          ) : <span />}
          <span className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
            <button type="submit" disabled={pending}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.5 : 1 }}>
              {pending ? "…" : call ? "Enregistrer" : "Créer"}
            </button>
          </span>
        </div>
      </form>
    </BaseModal>
  )
}

// ------------------------------------------------------------
// Une rangée — la promesse, son état, ses gestes
// ------------------------------------------------------------
function CallRow({ projectId, call, orgs, budgetRef, canManage, onEdit }: {
  projectId: string
  call: FundingCallRow
  orgs: Option[]
  budgetRef: Record<string, number>
  canManage: boolean
  onEdit: () => void
}) {
  const router = useRouter()
  const [msg, setMsg] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const name = (oid: string | null) => orgs.find(o => o.id === oid)?.name ?? "?"
  const st = STATUS_UI[call.status] ?? STATUS_UI.promis
  const ref = budgetRef[`${call.payer_org_id}|${call.year}`]
  const gap = ref !== undefined ? call.amount - ref : null

  function setStatus(status: string) {
    setError(""); setMsg("")
    startTransition(async () => {
      const res = await setFundingCallStatus({ projectId, callId: call.id, status })
      if (res.ok) router.refresh()
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }
  function remind() {
    setError(""); setMsg("")
    startTransition(async () => {
      const res = await sendFundingReminder({ projectId, callId: call.id })
      if (res.ok) { setMsg(`Rappel envoyé (${res.sent} compte${(res.sent ?? 0) > 1 ? "s" : ""} prévenu${(res.sent ?? 0) > 1 ? "s" : ""}).`); router.refresh() }
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <div className="px-4 py-3" style={{ borderTop: "1px solid #E3E6E2" }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-sm font-medium" style={{ color: "#17211D" }}>
          {name(call.payer_org_id)}
          <span aria-hidden="true" style={{ color: "#66716B" }}> → </span>
          <span style={{ color: call.beneficiary_org_id ? "#17211D" : "#66716B" }}>
            {call.beneficiary_org_id ? name(call.beneficiary_org_id) : "pour le projet (réserve)"}
          </span>
        </span>
        <span className="text-sm font-semibold" style={{ color: "#17211D" }}>{fmtEur(call.amount)}</span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.fg }}>
          {st.label}
          {call.status === "demande" && call.requested_at && <> le {fmtDate(call.requested_at)}</>}
          {call.status === "recu" && call.received_at && <> le {fmtDate(call.received_at)}</>}
        </span>
        {gap !== null && Math.abs(gap) >= 1 && (
          <span className="text-xs" style={{ color: "#8A6A1F" }}>
            écart budget {gap > 0 ? "+" : ""}{fmtEur(gap)}
          </span>
        )}
        {call.last_reminder_at && (
          <span className="text-xs" style={{ color: "#66716B" }}>relancé le {fmtDate(call.last_reminder_at)}</span>
        )}
      </div>
      {call.note && <p className="mt-1 text-xs italic" style={{ color: "#66716B" }}>{call.note}</p>}
      {canManage && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {(["promis", "demande", "recu"] as const).map(s => (
            <button key={s} type="button" disabled={pending || call.status === s}
              onClick={() => setStatus(s)}
              aria-pressed={call.status === s}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border"
              style={{
                ...border,
                background: call.status === s ? STATUS_UI[s].bg : "#fff",
                color: call.status === s ? STATUS_UI[s].fg : "#66716B",
              }}>
              {STATUS_UI[s].label}
            </button>
          ))}
          {call.status !== "recu" && (
            <button type="button" disabled={pending} onClick={remind}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border"
              style={{ borderColor: "#D9C58F", background: "#FBF0E0", color: "#8A6A1F" }}>
              <BellRing size={12} aria-hidden="true" /> {pending ? "…" : "Envoyer un rappel"}
            </button>
          )}
          <button type="button" onClick={onEdit} aria-label="Modifier l'appel de fonds"
            className="p-1.5 rounded-lg" style={{ color: "#66716B" }}>
            <Pencil size={14} />
          </button>
        </div>
      )}
      {msg && <p className="mt-1.5 text-xs" style={{ color: "var(--brand-accent,#0E6B5C)" }}>{msg}</p>}
      <ErrorMessage>{error}</ErrorMessage>
    </div>
  )
}

// ------------------------------------------------------------
// La section
// ------------------------------------------------------------
export default function FundingCalls({ projectId, calls, orgs, budgetRef, canManage }: {
  projectId: string
  calls: FundingCallRow[]
  orgs: Option[]
  budgetRef: Record<string, number>
  canManage: boolean
}) {
  const [dialog, setDialog] = useState<"closed" | "create" | FundingCallRow>("closed")

  // Groupées par année, la plus récente d'abord — l'ordre vient de la
  // page, on ne fait que couper.
  const years: { year: number; rows: FundingCallRow[] }[] = []
  for (const c of calls) {
    const g = years.find(y => y.year === c.year)
    if (g) g.rows.push(c)
    else years.push({ year: c.year, rows: [c] })
  }

  return (
    <div id="appels-de-fonds" className="bg-white rounded-2xl border mt-6 overflow-hidden scroll-mt-4" style={border}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div>
          <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
            Appels de fonds{calls.length > 0 && ` (${calls.length})`}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "#66716B" }}>
            Qui s&apos;est engagé à verser quoi, à qui, chaque année — et les relances. Le budget reste la référence, la promesse s&apos;y compare.
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={() => setDialog("create")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
            style={{ background: "var(--brand-accent,#0E6B5C)" }}>
            <Plus size={14} aria-hidden="true" /> Appel de fonds
          </button>
        )}
      </div>

      {!calls.length && (
        <p className="px-4 pb-4 text-sm" style={{ color: "#66716B" }}>
          Aucun appel de fonds. Exemple : « la mairie de Villepreux verse 2 000 € à LEY pour 2026 » — saisi ici, relancé d&apos;un bouton.
        </p>
      )}

      {years.map(({ year, rows }) => {
        // Reçu / promis de l'année : deux sommes d'un même geste — des
        // MONTANTS PROMIS, pas du budget : la valorisation n'existe pas ici.
        const total = rows.reduce((s, r) => s + r.amount, 0)
        const recu = rows.reduce((s, r) => s + (r.status === "recu" ? r.amount : 0), 0)
        return (
          <div key={year}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2" style={{ background: "#F5F6F4" }}>
              <span className="text-xs font-semibold tracking-wider" style={{ color: "#66716B" }}>{year}</span>
              <span className="text-xs" style={{ color: "#66716B" }}>
                {fmtEur(recu)} reçus sur {fmtEur(total)} promis
              </span>
            </div>
            {rows.map(c => (
              <CallRow key={c.id} projectId={projectId} call={c} orgs={orgs} budgetRef={budgetRef}
                canManage={canManage} onEdit={() => setDialog(c)} />
            ))}
          </div>
        )
      })}

      {dialog !== "closed" && (
        <FundingCallDialog projectId={projectId} orgs={orgs} budgetRef={budgetRef}
          call={dialog === "create" ? undefined : dialog} onClose={() => setDialog("closed")} />
      )}
    </div>
  )
}
