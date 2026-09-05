"use client"
import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, BellRing, Send, CheckCircle2, Paperclip, Trash2, Download } from "lucide-react"
import BaseModal, { ErrorMessage } from "@/components/ui/Modal"
import Foldable from "@/components/ui/Foldable"
import { fmtEur } from "@/lib/budget"
import { fmtDate } from "@/lib/constants"
import { saveFundingCall, setFundingCallStatus, deleteFundingCall, sendFundingReminder } from "@/app/(app)/projets/[id]/actions"
import { declareFundingPayment, confirmFundingReceipt, revokeFundingReceipt } from "@/app/(app)/projets/[id]/funding-actions"
import { saveDocument, deleteDocument, getDocumentUrl } from "@/app/(app)/projets/[id]/document-actions"
import { createClient } from "@/lib/supabase/client"
import { MAX_DOC_SIZE, buildStoragePath } from "@/lib/documents"

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
  // 0069 — le versement et sa réception, chacun constaté par sa main.
  paid_on: string | null
  payment_ref: string | null
  received_on: string | null
  received_on_behalf: boolean
  receiver: { full_name: string | null } | null
  // Ce que le serveur a tranché pour CE compte sur CET appel de fonds :
  // l'écran ne recalcule pas des droits, il les reçoit.
  can_declare_payment: boolean
  can_confirm_receipt: boolean
  proofs: { id: string; filename: string }[]
}

interface Option { id: string; name: string }

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

// promis / demandé / reçu — l'état colore, la date précise.
const STATUS_UI: Record<string, { label: string; fg: string; bg: string }> = {
  promis: { label: "Promis", fg: "#66716B", bg: "#EEF0EE" },
  demande: { label: "Demandé", fg: "#8A6A1F", bg: "#F7EDDD" },
  verse: { label: "Versé", fg: "#3B5488", bg: "#E8ECF5" },
  recu: { label: "Reçu", fg: "var(--brand-accent,#0E6B5C)", bg: "var(--brand-accent-soft,#E4F0EC)" },
}

// Les deux états qui ne se DÉCRÈTENT pas : ils se constatent, chacun par
// la main qui a vu la chose. Le bouton d'état ne les propose donc plus.
const STATUS_BUTTONS = ["promis", "demande"] as const

const today = () => new Date().toISOString().slice(0, 10)

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
// ------------------------------------------------------------
// Le virement est parti — côté payeur
// ------------------------------------------------------------
// La date est SAISIE, jamais déduite du clic : un virement se relève en
// fin de semaine, et c'est la date de valeur qui compte en comptabilité.
function PaymentDialog({ projectId, call, onClose }: {
  projectId: string; call: FundingCallRow; onClose: () => void
}) {
  const router = useRouter()
  const [paidOn, setPaidOn] = useState(call.paid_on ?? today())
  const [ref, setRef] = useState(call.payment_ref ?? "")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await declareFundingPayment({ projectId, callId: call.id, paidOn, reference: ref })
      if (res.ok) { onClose(); router.refresh() }
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <BaseModal open onClose={onClose} title="Déclarer le virement émis" busy={pending} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs" style={{ color: "#66716B" }}>
          Vous déclarez avoir <strong>émis</strong> le virement de {fmtEur(call.amount)}. L&apos;organisation qui
          reçoit sera prévenue et confirmera de son côté quand la somme sera créditée.
        </p>
        <Field label="Date du virement">
          {id => <input id={id} type="date" required value={paidOn} max={today()}
            onChange={e => setPaidOn(e.target.value)} className={inputCls} style={border} />}
        </Field>
        <Field label={<>Référence <span style={{ color: "#66716B", fontWeight: 400 }}>(facultatif)</span></>}>
          {id => <input id={id} type="text" value={ref} placeholder="VIR-2026-041"
            onChange={e => setRef(e.target.value)} className={inputCls} style={border} />}
        </Field>
        <ErrorMessage>{error}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={pending}
            className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
          <button type="submit" disabled={pending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#3B5488", opacity: pending ? 0.7 : 1 }}>
            <Send size={14} aria-hidden="true" /> {pending ? "…" : "Virement émis"}
          </button>
        </div>
      </form>
    </BaseModal>
  )
}

// ------------------------------------------------------------
// C'est arrivé — côté bénéficiaire
// ------------------------------------------------------------
// L'avis de virement se dépose ICI, dans le même geste : demandé après
// coup, il ne serait jamais joint. « Reçu » sans pièce n'est qu'une
// affirmation — on ne bloque pas pour autant, on le dit.
function ReceiptDialog({ projectId, call, onClose }: {
  projectId: string; call: FundingCallRow; onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [receivedOn, setReceivedOn] = useState(call.received_on ?? today())
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setBusy(true)

    // La pièce D'ABORD : si l'envoi échoue, rien n'est confirmé et on
    // recommence entier. L'inverse laisserait une confirmation nue,
    // qu'il faudrait penser à compléter plus tard.
    if (file) {
      if (file.size > MAX_DOC_SIZE) { setError("Fichier trop lourd (10 Mo maximum)."); setBusy(false); return }
      const path = buildStoragePath(projectId, null, file.name)
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file)
      if (upErr) { setError(`Échec de l'envoi de la pièce : ${upErr.message}`); setBusy(false); return }
      const saved = await saveDocument({
        projectId, fundingCallId: call.id, type: "justificatif",
        filename: file.name, storagePath: path, amount: String(call.amount),
      })
      if (!saved.ok) {
        await supabase.storage.from("documents").remove([path])
        setError(saved.error ?? "La pièce n'a pas pu être enregistrée."); setBusy(false); return
      }
    }

    const res = await confirmFundingReceipt({ projectId, callId: call.id, receivedOn })
    setBusy(false)
    if (!res.ok) { setError(res.error ?? "Une erreur est survenue."); return }
    onClose(); router.refresh()
  }

  return (
    <BaseModal open onClose={() => !busy && onClose()} title="Confirmer la réception" busy={busy} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs" style={{ color: "#66716B" }}>
          Vous confirmez que {fmtEur(call.amount)} sont <strong>arrivés sur le compte</strong> de votre organisation.
          Les responsables du budget seront prévenus, avec la liste des lignes que cette enveloppe finance.
        </p>
        <Field label="Date de réception sur le compte">
          {id => <input id={id} type="date" required value={receivedOn} max={today()}
            onChange={e => setReceivedOn(e.target.value)} className={inputCls} style={border} />}
        </Field>
        <Field label={<>Avis de virement ou relevé <span style={{ color: "#66716B", fontWeight: 400 }}>(fortement conseillé)</span></>}>
          {id => <input id={id} type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />}
        </Field>
        <p className="text-xs" style={{ color: "#8A6A1F" }}>
          Sans pièce jointe, la confirmation reste une affirmation : devant un financeur, c&apos;est l&apos;avis
          de virement qui fait foi. Vous pourrez l&apos;ajouter plus tard, mais on l&apos;oublie souvent.
        </p>
        <ErrorMessage>{error}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy}
            className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--brand-accent,#0E6B5C)", opacity: busy ? 0.7 : 1 }}>
            <CheckCircle2 size={14} aria-hidden="true" /> {busy ? "…" : "Je confirme la réception"}
          </button>
        </div>
      </form>
    </BaseModal>
  )
}

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
  const [dialog, setDialog] = useState<"none" | "payment" | "receipt">("none")
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
  function revoke() {
    if (!window.confirm("Retirer la confirmation de réception ? Le retrait sera tracé au Journal.")) return
    setError(""); setMsg("")
    startTransition(async () => {
      const res = await revokeFundingReceipt({ projectId, callId: call.id })
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
          {call.status === "verse" && call.paid_on && <> le {fmtDate(call.paid_on)}</>}
          {call.status === "recu" && (call.received_on || call.received_at) && <> le {fmtDate(call.received_on ?? call.received_at)}</>}
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
      {/* Le récit du versement, en une ligne : qui a constaté quoi, et
          quand. C'est ce qu'un contrôleur lit en premier. */}
      {(call.paid_on || call.received_on) && (
        <p className="mt-1 text-xs" style={{ color: "#66716B" }}>
          {call.paid_on && <>Virement émis le {fmtDate(call.paid_on)}{call.payment_ref ? ` — réf. ${call.payment_ref}` : ""}</>}
          {call.paid_on && call.received_on && " · "}
          {call.received_on && (
            <>Reçu le {fmtDate(call.received_on)}, confirmé par{" "}
              {call.received_on_behalf
                ? <strong style={{ color: "#8A6A1F" }}>un administrateur, au nom de {name(call.beneficiary_org_id ?? call.payer_org_id)}</strong>
                : (call.receiver?.full_name ?? name(call.beneficiary_org_id ?? call.payer_org_id))}
            </>
          )}
        </p>
      )}
      {call.proofs.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-2">
          {call.proofs.map(d => <ProofLink key={d.id} doc={d} />)}
        </ul>
      )}
      {call.status === "recu" && call.proofs.length === 0 && (
        <p className="mt-1 text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-lg"
          style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
          <Paperclip size={10} aria-hidden="true" /> reçu sans avis de virement joint
        </p>
      )}
      {/* Les deux constats ne suivent PAS les droits du budget : ils
          suivent l'APPARTENANCE à l'organisation concernée. Un chef de
          projet n'a pas à signer la réception d'une somme qu'il n'a pas
          vue arriver — c'est tout l'objet de la 0069. */}
      {(call.can_declare_payment || call.can_confirm_receipt) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {call.can_declare_payment && call.status !== "recu" && (
            <button type="button" onClick={() => setDialog("payment")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border"
              style={{ borderColor: "#B9C6DE", background: "#E8ECF5", color: "#3B5488" }}>
              <Send size={12} aria-hidden="true" /> {call.paid_on ? "Corriger le virement" : "Virement émis"}
            </button>
          )}
          {call.can_confirm_receipt && call.status !== "recu" && (
            <button type="button" onClick={() => setDialog("receipt")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white"
              style={{ background: "var(--brand-accent,#0E6B5C)" }}>
              <CheckCircle2 size={12} aria-hidden="true" /> Je confirme la réception
            </button>
          )}
          {call.can_confirm_receipt && call.status === "recu" && (
            <>
              <button type="button" onClick={() => setDialog("receipt")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border"
                style={{ ...border, color: "#66716B" }}>
                <Paperclip size={12} aria-hidden="true" /> Ajouter l&apos;avis de virement
              </button>
              <button type="button" disabled={pending} onClick={revoke}
                className="px-2.5 py-1 rounded-lg text-xs underline" style={{ color: "#A3342C" }}>
                retirer la confirmation
              </button>
            </>
          )}
        </div>
      )}
      {canManage && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {STATUS_BUTTONS.map(s => (
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
      {dialog === "payment" && <PaymentDialog projectId={projectId} call={call} onClose={() => setDialog("none")} />}
      {dialog === "receipt" && <ReceiptDialog projectId={projectId} call={call} onClose={() => setDialog("none")} />}
    </div>
  )
}

// Le lien vers une pièce passe par une URL signée : le bucket est privé.
function ProofLink({ doc }: { doc: { id: string; filename: string } }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  async function open() {
    const res = await getDocumentUrl(doc.id)
    if (res.ok && res.url) window.open(res.url, "_blank", "noopener")
  }
  function remove() {
    if (!window.confirm(`Supprimer définitivement « ${doc.filename} » ?`)) return
    startTransition(async () => { await deleteDocument(doc.id); router.refresh() })
  }
  return (
    <li className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs" style={{ background: "#F5F6F4", color: "#66716B" }}>
      <button type="button" onClick={open} className="inline-flex items-center gap-1 underline decoration-dotted">
        <Download size={10} aria-hidden="true" /> {doc.filename}
      </button>
      <button type="button" onClick={remove} disabled={pending} aria-label={`Supprimer ${doc.filename}`}>
        <Trash2 size={10} style={{ color: "#A3342C" }} aria-hidden="true" />
      </button>
    </li>
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

  // Repliable, mais OUVERT par défaut, y compris sur téléphone : le
  // bandeau du haut de l'onglet Budget pointe ici par une ancre, et une
  // ancre qui mène à un bloc fermé ne mène nulle part.
  const promis = calls.reduce((s, c) => s + c.amount, 0)
  const recu = calls.reduce((s, c) => s + (c.status === "recu" ? c.amount : 0), 0)

  return (
    <Foldable id="appels-de-fonds" className="mt-6 overflow-hidden scroll-mt-4"
      title="Appels de fonds"
      badge={calls.length > 0 ? (
        <span className="text-xs font-normal" style={{ color: "#66716B" }}>{calls.length}</span>
      ) : undefined}
      summary={calls.length > 0
        ? `${fmtEur(recu)} reçus sur ${fmtEur(promis)} promis`
        : "Qui s’est engagé à verser quoi, à qui, chaque année — et les relances."}
      actions={canManage ? (
        <button type="button" onClick={() => setDialog("create")}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
          style={{ background: "var(--brand-accent,#0E6B5C)" }}>
          <Plus size={14} aria-hidden="true" /> Appel de fonds
        </button>
      ) : undefined}
      rememberKey="appels-de-fonds">
      <p className="px-4 pt-3 text-xs" style={{ color: "#66716B" }}>
        Qui s&apos;est engagé à verser quoi, à qui, chaque année — et les relances.
        Le budget reste la référence, la promesse s&apos;y compare.
      </p>

      {!calls.length && (
        <p className="px-4 pb-4 pt-2 text-sm" style={{ color: "#66716B" }}>
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
    </Foldable>
  )
}
