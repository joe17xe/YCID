"use client"
import { useState, useTransition } from "react"
import { Plus, Pencil, X } from "lucide-react"
import { LINE_CATEGORIES, LINE_STATUS, IND_KINDS, MEETING_KINDS, DECISION_STATUS } from "@/lib/constants"
import {
  saveBudgetLine, createIndicator, addMeasure, createMeeting, saveDecision,
  type BudgetLineInput, type IndicatorInput, type MeasureInput, type MeetingInput, type DecisionInput,
} from "@/app/(app)/projets/[id]/actions"

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

export interface Option { id: string; name: string }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(23,33,29,0.45)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={border}>
          <h3 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{title}</h3>
          <button onClick={onClose} style={{ color: "#66716B" }} aria-label="Fermer"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function useDialog(action: () => Promise<{ ok: boolean; error?: string }>) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await action()
      if (res.ok) setOpen(false)
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }
  return { open, setOpen, error, pending, submit }
}

function Actions({ pending, onClose, label }: { pending: boolean; onClose: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
      <button type="submit" disabled={pending} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#0E6B5C", opacity: pending ? 0.7 : 1 }}>
        {pending ? "…" : label}
      </button>
    </div>
  )
}

function ErrorMsg({ error }: { error: string }) {
  return error ? <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p> : null
}

/* ============ Ligne budgétaire ============ */
export function BudgetLineDialog({ projectId, orgs, phases, line }: {
  projectId: string; orgs: Option[]; phases: Option[]
  line?: Omit<BudgetLineInput, "projectId" | "lineId"> & { id: string }
}) {
  const [form, setForm] = useState({
    poste: line?.poste ?? "", description: line?.description ?? "", category: line?.category ?? "autre",
    funder_org_id: line?.funder_org_id ?? "", owner_org_id: line?.owner_org_id ?? "", phase_id: line?.phase_id ?? "",
    year: line?.year ?? "", planned_amount: line?.planned_amount ?? "", is_valorisation: line?.is_valorisation ?? false,
    status: line?.status ?? "prevue", comment: line?.comment ?? "",
  })
  const d = useDialog(() => saveBudgetLine({ projectId, lineId: line?.id, ...form }))
  return (
    <>
      {line ? (
        <button onClick={() => d.setOpen(true)} className="p-1 rounded-full hover:bg-gray-100" title="Modifier la ligne"><Pencil size={13} style={{ color: "#66716B" }} /></button>
      ) : (
        <button onClick={() => d.setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "#0E6B5C" }}>
          <Plus size={15} /> Ligne budgétaire
        </button>
      )}
      {d.open && (
        <Modal title={line ? "Modifier la ligne" : "Nouvelle ligne budgétaire"} onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="p-5 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Poste *</label>
              <input value={form.poste} onChange={e => setForm({ ...form, poste: e.target.value })} required className={inputCls} style={border} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Catégorie</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(LINE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Montant prévisionnel (€) *</label>
                <input type="number" min={0} step="0.01" value={form.planned_amount} onChange={e => setForm({ ...form, planned_amount: e.target.value })} required className={inputCls} style={border} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Financeur</label>
                <select value={form.funder_org_id} onChange={e => setForm({ ...form, funder_org_id: e.target.value })} className={inputCls} style={border}>
                  <option value="">—</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Org. responsable</label>
                <select value={form.owner_org_id} onChange={e => setForm({ ...form, owner_org_id: e.target.value })} className={inputCls} style={border}>
                  <option value="">—</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Phase</label>
                <select value={form.phase_id} onChange={e => setForm({ ...form, phase_id: e.target.value })} className={inputCls} style={border}>
                  <option value="">—</option>
                  {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Année</label>
                <input type="number" min={2000} max={2100} value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} className={inputCls} style={border} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Statut</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(LINE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm mt-6" style={{ color: "#17211D" }}>
                <input type="checkbox" checked={form.is_valorisation} onChange={e => setForm({ ...form, is_valorisation: e.target.checked })} />
                Valorisation (apport non financier)
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Commentaire</label>
              <input value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} className={inputCls} style={border} />
            </div>
            <ErrorMsg error={d.error} />
            <Actions pending={d.pending} onClose={() => d.setOpen(false)} label={line ? "Enregistrer" : "Créer la ligne"} />
          </form>
        </Modal>
      )}
    </>
  )
}

/* ============ Indicateur ============ */
export function IndicatorDialog({ projectId, phases }: { projectId: string; phases: Option[] }) {
  const [form, setForm] = useState<Omit<IndicatorInput, "projectId">>({
    name: "", description: "", kind: "quantitatif", unit: "", target: "", baseline: "", phase_id: "",
  })
  const d = useDialog(() => createIndicator({ projectId, ...form }))
  return (
    <>
      <button onClick={() => d.setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "#0E6B5C" }}>
        <Plus size={15} /> Indicateur
      </button>
      {d.open && (
        <Modal title="Nouvel indicateur" onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="p-5 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nom *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputCls} style={border} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Description</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} style={border} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Type</label>
                <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(IND_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Unité</label>
                <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="jeunes, km…" className={inputCls} style={border} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Cible *</label>
                <input type="number" step="0.01" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} required className={inputCls} style={border} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Valeur initiale</label>
                <input type="number" step="0.01" value={form.baseline} onChange={e => setForm({ ...form, baseline: e.target.value })} className={inputCls} style={border} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Phase (optionnel)</label>
                <select value={form.phase_id} onChange={e => setForm({ ...form, phase_id: e.target.value })} className={inputCls} style={border}>
                  <option value="">—</option>
                  {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <ErrorMsg error={d.error} />
            <Actions pending={d.pending} onClose={() => d.setOpen(false)} label="Créer l'indicateur" />
          </form>
        </Modal>
      )}
    </>
  )
}

/* ============ Mesure d'indicateur ============ */
export function MeasureDialog({ indicatorId, indicatorName, unit }: { indicatorId: string; indicatorName: string; unit?: string }) {
  const [form, setForm] = useState<Omit<MeasureInput, "indicatorId">>({ period: "", value: "", comment: "" })
  const d = useDialog(() => addMeasure({ indicatorId, ...form }))
  return (
    <>
      <button onClick={() => d.setOpen(true)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium hover:bg-gray-50" style={{ ...border, color: "#0E6B5C" }}>
        <Plus size={12} /> Mesure
      </button>
      {d.open && (
        <Modal title={`Nouvelle mesure — ${indicatorName}`} onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Période *</label>
                <input value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} required placeholder="2026-T3" className={inputCls} style={border} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Valeur * {unit ? `(${unit})` : ""}</label>
                <input type="number" step="0.01" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} required className={inputCls} style={border} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Commentaire</label>
              <input value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} className={inputCls} style={border} />
            </div>
            <ErrorMsg error={d.error} />
            <Actions pending={d.pending} onClose={() => d.setOpen(false)} label="Enregistrer la mesure" />
          </form>
        </Modal>
      )}
    </>
  )
}

/* ============ Réunion ============ */
export function MeetingDialog({ projectId }: { projectId: string }) {
  const [form, setForm] = useState<Omit<MeetingInput, "projectId">>({ title: "", kind: "copil", date: "", minutes: "" })
  const d = useDialog(() => createMeeting({ projectId, ...form }))
  return (
    <>
      <button onClick={() => d.setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "#0E6B5C" }}>
        <Plus size={15} /> Réunion
      </button>
      {d.open && (
        <Modal title="Nouvelle réunion" onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="p-5 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Titre *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className={inputCls} style={border} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Type</label>
                <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(MEETING_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required className={inputCls} style={border} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Compte rendu</label>
              <textarea value={form.minutes} onChange={e => setForm({ ...form, minutes: e.target.value })} rows={3} className={inputCls} style={border} />
            </div>
            <ErrorMsg error={d.error} />
            <Actions pending={d.pending} onClose={() => d.setOpen(false)} label="Créer la réunion" />
          </form>
        </Modal>
      )}
    </>
  )
}

/* ============ Décision ============ */
export function DecisionDialog({ projectId, meetingId, members, decision }: {
  projectId: string; meetingId: string; members: Option[]
  decision?: { id: string; text: string; owner_user_id: string; due_date: string; status: string }
}) {
  const [form, setForm] = useState({
    text: decision?.text ?? "", owner_user_id: decision?.owner_user_id ?? "",
    due_date: decision?.due_date ?? "", status: decision?.status ?? "a_faire",
  })
  const d = useDialog(() => saveDecision({ projectId, meetingId, decisionId: decision?.id, ...form } as DecisionInput))
  return (
    <>
      {decision ? (
        <button onClick={() => d.setOpen(true)} className="p-1 rounded-full hover:bg-gray-100" title="Modifier la décision"><Pencil size={12} style={{ color: "#66716B" }} /></button>
      ) : (
        <button onClick={() => d.setOpen(true)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium hover:bg-gray-50" style={{ ...border, color: "#0E6B5C" }}>
          <Plus size={12} /> Décision
        </button>
      )}
      {d.open && (
        <Modal title={decision ? "Modifier la décision" : "Nouvelle décision"} onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="p-5 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Décision *</label>
              <textarea value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} rows={2} required className={inputCls} style={border} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Responsable</label>
                <select value={form.owner_user_id} onChange={e => setForm({ ...form, owner_user_id: e.target.value })} className={inputCls} style={border}>
                  <option value="">—</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Échéance</label>
                <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className={inputCls} style={border} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Statut</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(DECISION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <ErrorMsg error={d.error} />
            <Actions pending={d.pending} onClose={() => d.setOpen(false)} label={decision ? "Enregistrer" : "Ajouter la décision"} />
          </form>
        </Modal>
      )}
    </>
  )
}
