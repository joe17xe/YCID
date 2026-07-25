"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Paperclip, Upload, Trash2, Download, Check, X as XIcon } from "lucide-react"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { createClient } from "@/lib/supabase/client"
import { BUDGET_DOC_TYPES, DOC_TYPE_LABELS, MAX_DOC_SIZE, buildStoragePath, type DocType } from "@/lib/documents"
import { saveDocument, deleteDocument, getDocumentUrl, decideValidation, setDocumentPaid } from "@/app/(app)/projets/[id]/document-actions"

// ============================================================
// PR 38b — Devis, factures et circuit de validation
// ============================================================
// devis déposé → validé (ou refusé) → facture → payé.
// « engagé » = Σ des devis validés, « payé » = Σ des pièces marquées
// payées. Ce sont les deux sources du réalisé que la PR 39 agrégera par
// phase et par projet.

export interface LineValidation {
  id: string
  decision: "en_attente" | "valide" | "refuse"
  comment: string | null
  orgName: string | null
}

export interface LineDoc {
  id: string
  filename: string
  type: DocType
  amount: number | null
  paid: boolean
  paid_at: string | null
  validations: LineValidation[]
}

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`

// Un devis compte comme engagé dès qu'UNE organisation l'a validé, et
// jamais s'il a été refusé : exiger l'unanimité bloquerait le suivi sur
// une organisation qui ne répond pas.
export function isEngaged(d: LineDoc): boolean {
  if (d.type !== "devis") return false
  if (d.validations.some(v => v.decision === "refuse")) return false
  return d.validations.some(v => v.decision === "valide")
}

export default function BudgetLineDocuments({ projectId, phaseId, lineId, poste, docs, canManage, canDecide }: {
  projectId: string; phaseId: string | null; lineId: string; poste: string
  docs: LineDoc[]; canManage: boolean; canDecide: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<DocType>("devis")
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [payingDoc, setPayingDoc] = useState<LineDoc | null>(null)
  const [payDate, setPayDate] = useState("")
  const [pending, startTransition] = useTransition()

  const engaged = docs.filter(isEngaged).reduce((s, d) => s + (d.amount ?? 0), 0)
  const paid = docs.filter(d => d.paid).reduce((s, d) => s + (d.amount ?? 0), 0)

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!file) { setError("Choisissez un fichier."); return }
    if (file.size > MAX_DOC_SIZE) { setError("Fichier trop lourd (10 Mo maximum)."); return }
    setBusy(true)
    const path = buildStoragePath(projectId, phaseId, file.name)
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file)
    if (upErr) { setError(`Échec de l'envoi : ${upErr.message}`); setBusy(false); return }

    const res = await saveDocument({
      projectId, phaseId, budgetLineId: lineId, type,
      filename: file.name, storagePath: path, amount: amount || null,
    })
    if (!res.ok) {
      await supabase.storage.from("documents").remove([path])
      setError(res.error ?? "Une erreur est survenue."); setBusy(false); return
    }
    setBusy(false); setFile(null); setAmount("")
    router.refresh()
  }

  function decide(validationId: string, decision: "valide" | "refuse") {
    const comment = decision === "refuse"
      ? window.prompt("Motif du refus (facultatif) :") ?? ""
      : ""
    // Purger le message AVANT l'action : sans cela une erreur ancienne
    // restait affichée sous une action qui venait de réussir — on lisait
    // « payé le 20/07 » juste au-dessus de l'échec précédent.
    setError("")
    startTransition(async () => {
      const res = await decideValidation({ validationId, projectId, decision, comment })
      if (!res.ok) setError(res.error ?? "Décision impossible.")
      else router.refresh()
    })
  }

  // Marquer payé passait par window.prompt() : boîte système non
  // stylée, qui BLOQUE le rendu de la page tant qu'elle est ouverte, et
  // n'impose aucun format — une date saisie « 20/07/2026 », ce que fait
  // naturellement un francophone, remontait l'erreur Postgres brute.
  // D'où un champ date natif, qui contraint le format par construction.
  function confirmPaid(d: LineDoc) {
    setError("")
    const today = new Date()
    const p = (n: number) => String(n).padStart(2, "0")
    setPayDate(`${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`)
    setPayingDoc(d)
  }

  function submitPaid(e: React.FormEvent) {
    e.preventDefault()
    if (!payingDoc) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate)) { setError("Date invalide."); return }
    const doc = payingDoc
    setError("")
    startTransition(async () => {
      const res = await setDocumentPaid({ documentId: doc.id, projectId, paid: true, paidAt: payDate })
      if (!res.ok) setError(res.error ?? "Échec.")
      else { setPayingDoc(null); router.refresh() }
    })
  }

  function cancelPaid(d: LineDoc) {
    setError("")
    startTransition(async () => {
      const res = await setDocumentPaid({ documentId: d.id, projectId, paid: false, paidAt: null })
      if (!res.ok) setError(res.error ?? "Échec.")
      else router.refresh()
    })
  }

  function remove(d: LineDoc) {
    if (!window.confirm(`Supprimer définitivement « ${d.filename} » ?`)) return
    setError("")
    startTransition(async () => {
      const res = await deleteDocument(d.id)
      if (!res.ok) setError(res.error ?? "Suppression impossible.")
      else router.refresh()
    })
  }

  async function download(id: string) {
    setError("")
    const res = await getDocumentUrl(id)
    if (res.ok && res.url) window.open(res.url, "_blank", "noopener")
    else setError(res.error ?? "Lien indisponible.")
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs whitespace-nowrap"
        style={{ color: docs.length ? "#66716B" : "#9AA39D" }}
        title={`Pièces justificatives de « ${poste} »`}>
        <Paperclip size={11} aria-hidden="true" />
        {docs.length}
        {engaged > 0 && <span style={{ color: "#3B5488" }}> · eng. {fmtEur(engaged)}</span>}
        {paid > 0 && <span style={{ color: "var(--brand-accent,#0E6B5C)" }}> · payé {fmtEur(paid)}</span>}
      </button>

      {open && (
        <Modal open onClose={() => !busy && setOpen(false)} title={`Pièces — ${poste}`} busy={busy} maxWidth="max-w-2xl">
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <span style={{ color: "#3B5488" }}>Engagé (devis validés) : <strong>{fmtEur(engaged)}</strong></span>
              <span style={{ color: "var(--brand-accent,#0E6B5C)" }}>Payé : <strong>{fmtEur(paid)}</strong></span>
            </div>

            {docs.length === 0 ? (
              <p className="text-sm" style={{ color: "#66716B" }}>Aucune pièce déposée sur cette ligne.</p>
            ) : (
              <ul className="space-y-2">
                {docs.map(d => (
                  <li key={d.id} className="rounded-xl border p-3" style={{ borderColor: "#E3E6E2" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium mr-2"
                          style={{ background: "#EEF0EE", color: "#66716B" }}>
                          {DOC_TYPE_LABELS[d.type] ?? d.type}
                        </span>
                        <button type="button" onClick={() => download(d.id)}
                          className="text-sm underline decoration-dotted" style={{ color: "#17211D" }}>
                          {d.filename}
                        </button>
                        {d.amount != null && (
                          <span className="ml-2 text-sm font-semibold" style={{ color: "#17211D" }}>{fmtEur(d.amount)}</span>
                        )}
                        {d.paid && (
                          <span className="ml-2 text-xs" style={{ color: "var(--brand-accent,#0E6B5C)" }}>
                            payé{d.paid_at ? ` le ${new Date(d.paid_at).toLocaleDateString("fr-FR")}` : ""}
                          </span>
                        )}
                      </div>
                      {canManage && (
                        <button type="button" onClick={() => remove(d)} disabled={pending}
                          className="p-1 rounded hover:bg-gray-100 flex-shrink-0" aria-label={`Supprimer ${d.filename}`}>
                          <Trash2 size={13} style={{ color: "#A3342C" }} aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    {/* Devis : état du circuit, une ligne par organisation sollicitée */}
                    {d.type === "devis" && d.validations.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {d.validations.map(v => (
                          <li key={v.id} className="flex items-center gap-2 text-xs">
                            <span style={{ color: "#66716B" }}>{v.orgName ?? "Organisation"}</span>
                            {v.decision === "en_attente" ? (
                              <>
                                <span style={{ color: "#B4690E" }}>en attente</span>
                                {canDecide && (
                                  <span className="flex gap-1">
                                    <button type="button" onClick={() => decide(v.id, "valide")} disabled={pending}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium"
                                      style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>
                                      <Check size={11} aria-hidden="true" /> Valider
                                    </button>
                                    <button type="button" onClick={() => decide(v.id, "refuse")} disabled={pending}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium"
                                      style={{ background: "#F6E7E5", color: "#A3342C" }}>
                                      <XIcon size={11} aria-hidden="true" /> Refuser
                                    </button>
                                  </span>
                                )}
                              </>
                            ) : (
                              <span style={{ color: v.decision === "valide" ? "var(--brand-accent,#0E6B5C)" : "#A3342C" }}>
                                {v.decision === "valide" ? "validé" : "refusé"}
                                {v.comment ? ` — ${v.comment}` : ""}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Facture, reçu, justificatif : marquer payé */}
                    {canManage && d.type !== "devis" && (
                      payingDoc?.id === d.id ? (
                        <form onSubmit={submitPaid} className="mt-2 flex items-end gap-2 flex-wrap">
                          <div>
                            <label htmlFor={`paid-at-${d.id}`} className="block text-xs mb-1" style={{ color: "#66716B" }}>
                              Date de paiement
                            </label>
                            <input id={`paid-at-${d.id}`} type="date" required value={payDate}
                              onChange={e => setPayDate(e.target.value)}
                              className="px-3 py-1.5 rounded-lg border text-sm" style={{ borderColor: "#E3E6E2" }} />
                          </div>
                          <button type="submit" disabled={pending}
                            className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold"
                            style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.6 : 1 }}>
                            {pending ? "…" : "Confirmer"}
                          </button>
                          <button type="button" onClick={() => setPayingDoc(null)}
                            className="px-3 py-1.5 rounded-lg border text-xs font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
                            Annuler
                          </button>
                        </form>
                      ) : (
                        <button type="button" onClick={() => d.paid ? cancelPaid(d) : confirmPaid(d)} disabled={pending}
                          className="mt-2 text-xs font-medium"
                          style={{ color: d.paid ? "#66716B" : "var(--brand-accent,#0E6B5C)" }}>
                          {d.paid ? "Annuler le paiement" : "Marquer payée"}
                        </button>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canManage && (
              <form onSubmit={upload} className="rounded-xl border p-3 space-y-3" style={{ borderColor: "#E3E6E2" }}>
                <p className="text-sm font-medium" style={{ color: "#17211D" }}>Déposer une pièce</p>
                <input type="file" required onChange={e => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`bl-type-${lineId}`} className="block text-xs mb-1" style={{ color: "#66716B" }}>Nature</label>
                    <select id={`bl-type-${lineId}`} value={type} onChange={e => setType(e.target.value as DocType)}
                      className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }}>
                      {BUDGET_DOC_TYPES.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`bl-amount-${lineId}`} className="block text-xs mb-1" style={{ color: "#66716B" }}>Montant (€)</label>
                    <input id={`bl-amount-${lineId}`} type="number" min={0} step="0.01" value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }} />
                  </div>
                </div>
                {/* Message conditionnel : il ne concerne que le devis, et
                    s'affichait à tort sur Facture ou Reçu. */}
                {type === "devis" ? (
                  <p className="text-xs" style={{ color: "#66716B" }}>
                    Un devis part automatiquement en validation auprès du financeur de la ligne,
                    ou de l&apos;organisation porteuse à défaut.
                  </p>
                ) : (
                  <p className="text-xs" style={{ color: "#66716B" }}>
                    Renseignez le montant pour que cette pièce alimente le « payé » une fois marquée réglée.
                  </p>
                )}
                <div className="flex justify-end">
                  <button type="submit" disabled={busy}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: "var(--brand-accent,#0E6B5C)", opacity: busy ? 0.7 : 1 }}>
                    <Upload size={14} aria-hidden="true" /> {busy ? "Envoi…" : "Déposer"}
                  </button>
                </div>
              </form>
            )}

            <ErrorMessage>{error}</ErrorMessage>
          </div>
        </Modal>
      )}
    </>
  )
}
