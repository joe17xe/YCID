"use client"
import { useId, useState, useTransition } from "react"
import { Plus, Pencil, X } from "lucide-react"
import BaseModal, { ErrorMessage } from "@/components/ui/Modal"
import { LINE_CATEGORIES, LINE_STATUS, IND_KINDS, MEETING_KINDS, DECISION_STATUS } from "@/lib/constants"
import {
  saveBudgetLine, createIndicator, addMeasure, createMeeting, saveDecision,
  type BudgetLineInput, type IndicatorInput, type MeasureInput, type MeetingInput, type DecisionInput,
} from "@/app/(app)/projets/[id]/actions"

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

export interface Option { id: string; name: string }
// Une tâche porte sa phase : le sélecteur de tâche se restreint à la
// phase choisie, et choisir une tâche suffit à situer la ligne.
export interface TaskOption extends Option { phase_id: string }

// Dialogue accessible (RGAA) : le composant partagé gère role="dialog",
// le piège de focus, Échap et la restitution du focus. Ici on ne monte le
// dialogue que lorsqu'il est ouvert, d'où `open` toujours vrai.
function Modal({ title, onClose, busy, children }: { title: string; onClose: () => void; busy?: boolean; children: React.ReactNode }) {
  return <BaseModal open onClose={onClose} title={title} busy={busy} maxWidth="max-w-lg">{children}</BaseModal>
}

// Champ étiqueté : l'identifiant est généré pour que <label for> pointe
// bien sur le contrôle (RGAA 11.1), même si le dialogue est instancié
// plusieurs fois dans la page.
function Field({ label, className, children }: {
  label: React.ReactNode
  className?: string
  children: (id: string) => React.ReactNode
}) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>{label}</label>
      {children(id)}
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
      <button type="submit" disabled={pending} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
        {pending ? "…" : label}
      </button>
    </div>
  )
}

/* ============ Ligne budgétaire ============ */
export function BudgetLineDialog({ projectId, orgs, phases, tasks = [], line }: {
  projectId: string; orgs: Option[]; phases: Option[]; tasks?: TaskOption[]
  line?: Omit<BudgetLineInput, "projectId" | "lineId"> & { id: string }
}) {
  const [form, setForm] = useState({
    poste: line?.poste ?? "", description: line?.description ?? "", category: line?.category ?? "autre",
    funder_org_id: line?.funder_org_id ?? "", owner_org_id: line?.owner_org_id ?? "", phase_id: line?.phase_id ?? "",
    allocations: line?.allocations ?? [],
    year: line?.year ?? "", planned_amount: line?.planned_amount ?? "", is_valorisation: line?.is_valorisation ?? false,
    status: line?.status ?? "prevue", comment: line?.comment ?? "",
  })
  const d = useDialog(() => saveBudgetLine({ projectId, lineId: line?.id, ...form }))

  // Tant qu'aucune phase n'est choisie, on propose toutes les tâches :
  // en sélectionner une renseigne la phase, plutôt que d'imposer deux
  // choix dans un ordre précis.
  const visibleTasks = form.phase_id ? tasks.filter(t => t.phase_id === form.phase_id) : tasks

  // Répartition : le total affecté ne peut pas dépasser le montant de la
  // ligne, qui reste la vérité de la convention. Le reste est affiché
  // plutôt que déduit de tête.
  const lineAmount = Number(String(form.planned_amount ?? "").replace(",", ".") || "0")
  const allocated = form.allocations.reduce((s, a) => s + Number(String(a.amount ?? "").replace(",", ".") || "0"), 0)
  const rest = (Number.isFinite(lineAmount) ? lineAmount : 0) - allocated
  const overAllocated = rest < -0.005

  // Changer de phase invalide les affectations sorties de la phase —
  // sinon le trigger de cohérence rejetterait l'enregistrement.
  function selectPhase(phase_id: string) {
    setForm(f => ({
      ...f,
      phase_id,
      allocations: f.allocations.filter(a => tasks.some(t => t.id === a.task_id && t.phase_id === phase_id)),
    }))
  }
  function addAllocation() {
    setForm(f => ({ ...f, allocations: [...f.allocations, { task_id: "", amount: "" }] }))
  }
  function removeAllocation(i: number) {
    setForm(f => ({ ...f, allocations: f.allocations.filter((_, j) => j !== i) }))
  }
  // Choisir une tâche alors qu'aucune phase n'est fixée renseigne la
  // phase : la ligne se situe d'elle-même.
  function setAllocation(i: number, patch: { task_id?: string; amount?: string }) {
    setForm(f => {
      const allocations = f.allocations.map((a, j) => (j === i ? { ...a, ...patch } : a))
      const t = patch.task_id ? tasks.find(x => x.id === patch.task_id) : undefined
      return { ...f, allocations, phase_id: !f.phase_id && t ? t.phase_id : f.phase_id }
    })
  }
  return (
    <>
      {line ? (
        <button onClick={() => d.setOpen(true)} className="p-1 rounded-full hover:bg-gray-100"
          aria-label={`Modifier la ligne budgétaire ${line.poste}`} title="Modifier la ligne">
          <Pencil size={13} style={{ color: "#66716B" }} aria-hidden="true" />
        </button>
      ) : (
        <button onClick={() => d.setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
          <Plus size={15} aria-hidden="true" /> Ligne budgétaire
        </button>
      )}
      {d.open && (
        <Modal title={line ? "Modifier la ligne" : "Nouvelle ligne budgétaire"} busy={d.pending} onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="space-y-3">
            <Field label="Poste *">{id => (
              <input id={id} value={form.poste} onChange={e => setForm({ ...form, poste: e.target.value })} required className={inputCls} style={border} />
            )}</Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Catégorie">{id => (
                <select id={id} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(LINE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              )}</Field>
              <Field label="Montant prévisionnel (€) *">{id => (
                <input id={id} type="number" min={0} step="0.01" value={form.planned_amount} onChange={e => setForm({ ...form, planned_amount: e.target.value })} required className={inputCls} style={border} />
              )}</Field>
              <Field label="Financeur">{id => (
                <select id={id} value={form.funder_org_id} onChange={e => setForm({ ...form, funder_org_id: e.target.value })} className={inputCls} style={border}>
                  <option value="">—</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              )}</Field>
              <Field label="Org. responsable">{id => (
                <select id={id} value={form.owner_org_id} onChange={e => setForm({ ...form, owner_org_id: e.target.value })} className={inputCls} style={border}>
                  <option value="">—</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              )}</Field>
              <Field label="Phase">{id => (
                <select id={id} value={form.phase_id} onChange={e => selectPhase(e.target.value)} className={inputCls} style={border}>
                  <option value="">—</option>
                  {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}</Field>
              <Field label="Année">{id => (
                <input id={id} type="number" min={2000} max={2100} value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} className={inputCls} style={border} />
              )}</Field>
              <Field label="Statut">{id => (
                <select id={id} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(LINE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              )}</Field>
              <label className="flex items-center gap-2 text-sm mt-6" style={{ color: "#17211D" }}>
                <input type="checkbox" checked={form.is_valorisation} onChange={e => setForm({ ...form, is_valorisation: e.target.checked })} />
                Valorisation (apport non financier)
              </label>
            </div>
            {/* Répartition sur les tâches : le montant de la ligne reste
                celui de la convention, la répartition vient par-dessus. */}
            <fieldset className="rounded-xl border p-3" style={border}>
              <legend className="px-1 text-sm font-medium" style={{ color: "#17211D" }}>Tâches financées</legend>
              {form.allocations.length === 0 && (
                <p className="text-xs" style={{ color: "#66716B" }}>
                  Aucune tâche affectée. Laissez ainsi pour les valorisations et les frais de structure.
                </p>
              )}
              <div className="space-y-2">
                {form.allocations.map((a, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-xs mb-1" style={{ color: "#66716B" }} htmlFor={`alloc-task-${i}`}>Tâche</label>
                      <select id={`alloc-task-${i}`} value={a.task_id} required
                        onChange={e => setAllocation(i, { task_id: e.target.value })} className={inputCls} style={border}>
                        <option value="">— choisir</option>
                        {visibleTasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="w-32">
                      <label className="block text-xs mb-1" style={{ color: "#66716B" }} htmlFor={`alloc-amount-${i}`}>Montant (€)</label>
                      <input id={`alloc-amount-${i}`} type="number" min={0} step="0.01" value={a.amount}
                        onChange={e => setAllocation(i, { amount: e.target.value })} className={inputCls} style={border} />
                    </div>
                    <button type="button" onClick={() => removeAllocation(i)}
                      className="p-2 rounded-lg hover:bg-gray-100" aria-label={`Retirer la tâche ${i + 1} de la répartition`}>
                      <X size={15} style={{ color: "#66716B" }} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 mt-2">
                <button type="button" onClick={addAllocation}
                  className="flex items-center gap-1 text-sm font-medium" style={{ color: "var(--brand-accent,#0E6B5C)" }}>
                  <Plus size={14} aria-hidden="true" /> Ajouter une tâche
                </button>
                {form.allocations.length > 0 && (
                  <span className="text-xs" style={{ color: overAllocated ? "#A3342C" : "#66716B" }}>
                    Réparti {allocated.toLocaleString("fr-FR")} € · reste {rest.toLocaleString("fr-FR")} €
                  </span>
                )}
              </div>
              <p className="text-xs mt-2" style={{ color: "#66716B" }}>
                Une ligne peut se répartir sur plusieurs tâches (40 000 € = 10 000 € + 30 000 €),
                et plusieurs lignes peuvent financer la même tâche (co-financement).
              </p>
              {overAllocated && (
                <p className="text-xs mt-1" style={{ color: "#A3342C" }}>
                  La répartition dépasse le montant de la ligne.
                </p>
              )}
            </fieldset>
            <Field label="Commentaire">{id => (
              <input id={id} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} className={inputCls} style={border} />
            )}</Field>
            <ErrorMessage>{d.error}</ErrorMessage>
            <Actions pending={d.pending || overAllocated} onClose={() => d.setOpen(false)} label={line ? "Enregistrer" : "Créer la ligne"} />
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
      <button onClick={() => d.setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
        <Plus size={15} aria-hidden="true" /> Indicateur
      </button>
      {d.open && (
        <Modal title="Nouvel indicateur" busy={d.pending} onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="space-y-3">
            <Field label="Nom *">{id => (
              <input id={id} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputCls} style={border} />
            )}</Field>
            <Field label="Description">{id => (
              <input id={id} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} style={border} />
            )}</Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Type">{id => (
                <select id={id} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(IND_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              )}</Field>
              <Field label="Unité">{id => (
                <input id={id} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="jeunes, km…" className={inputCls} style={border} />
              )}</Field>
              <Field label="Cible *">{id => (
                <input id={id} type="number" step="0.01" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} required className={inputCls} style={border} />
              )}</Field>
              <Field label="Valeur initiale">{id => (
                <input id={id} type="number" step="0.01" value={form.baseline} onChange={e => setForm({ ...form, baseline: e.target.value })} className={inputCls} style={border} />
              )}</Field>
              <Field label="Phase (optionnel)" className="col-span-2">{id => (
                <select id={id} value={form.phase_id} onChange={e => setForm({ ...form, phase_id: e.target.value })} className={inputCls} style={border}>
                  <option value="">—</option>
                  {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}</Field>
            </div>
            <ErrorMessage>{d.error}</ErrorMessage>
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
      <button onClick={() => d.setOpen(true)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium hover:bg-gray-50" style={{ ...border, color: "var(--brand-accent,#0E6B5C)" }}
        aria-label={`Ajouter une mesure pour ${indicatorName}`}>
        <Plus size={12} aria-hidden="true" /> Mesure
      </button>
      {d.open && (
        <Modal title={`Nouvelle mesure — ${indicatorName}`} busy={d.pending} onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Période *">{id => (
                <input id={id} value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} required placeholder="2026-T3" className={inputCls} style={border} />
              )}</Field>
              <Field label={`Valeur * ${unit ? `(${unit})` : ""}`}>{id => (
                <input id={id} type="number" step="0.01" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} required className={inputCls} style={border} />
              )}</Field>
            </div>
            <Field label="Commentaire">{id => (
              <input id={id} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} className={inputCls} style={border} />
            )}</Field>
            <ErrorMessage>{d.error}</ErrorMessage>
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
      <button onClick={() => d.setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
        <Plus size={15} aria-hidden="true" /> Réunion
      </button>
      {d.open && (
        <Modal title="Nouvelle réunion" busy={d.pending} onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="space-y-3">
            <Field label="Titre *">{id => (
              <input id={id} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className={inputCls} style={border} />
            )}</Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Type">{id => (
                <select id={id} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(MEETING_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              )}</Field>
              <Field label="Date *">{id => (
                <input id={id} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required className={inputCls} style={border} />
              )}</Field>
            </div>
            <Field label="Compte rendu">{id => (
              <textarea id={id} value={form.minutes} onChange={e => setForm({ ...form, minutes: e.target.value })} rows={3} className={inputCls} style={border} />
            )}</Field>
            <ErrorMessage>{d.error}</ErrorMessage>
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
        <button onClick={() => d.setOpen(true)} className="p-1 rounded-full hover:bg-gray-100"
          aria-label="Modifier la décision" title="Modifier la décision">
          <Pencil size={12} style={{ color: "#66716B" }} aria-hidden="true" />
        </button>
      ) : (
        <button onClick={() => d.setOpen(true)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium hover:bg-gray-50" style={{ ...border, color: "var(--brand-accent,#0E6B5C)" }}>
          <Plus size={12} aria-hidden="true" /> Décision
        </button>
      )}
      {d.open && (
        <Modal title={decision ? "Modifier la décision" : "Nouvelle décision"} busy={d.pending} onClose={() => d.setOpen(false)}>
          <form onSubmit={d.submit} className="space-y-3">
            <Field label="Décision *">{id => (
              <textarea id={id} value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} rows={2} required className={inputCls} style={border} />
            )}</Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Responsable">{id => (
                <select id={id} value={form.owner_user_id} onChange={e => setForm({ ...form, owner_user_id: e.target.value })} className={inputCls} style={border}>
                  <option value="">—</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}</Field>
              <Field label="Échéance">{id => (
                <input id={id} type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className={inputCls} style={border} />
              )}</Field>
              <Field label="Statut">{id => (
                <select id={id} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(DECISION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              )}</Field>
            </div>
            <ErrorMessage>{d.error}</ErrorMessage>
            <Actions pending={d.pending} onClose={() => d.setOpen(false)} label={decision ? "Enregistrer" : "Ajouter la décision"} />
          </form>
        </Modal>
      )}
    </>
  )
}
