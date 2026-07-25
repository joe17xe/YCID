"use client"
import { useId, useState, useTransition } from "react"
import { Plus, Pencil } from "lucide-react"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { savePhase } from "@/app/(app)/projets/[id]/actions"

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"

const PHASE_STATUS_OPTIONS = [
  { value: "a_venir", label: "À venir" },
  { value: "en_cours", label: "En cours" },
  { value: "terminee", label: "Terminée" },
]

interface PhaseData { id: string; name: string; start_date: string | null; end_date: string | null; status: string }

export default function PhaseDialog({ projectId, phase }: { projectId: string; phase?: PhaseData }) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: phase?.name ?? "",
    start_date: phase?.start_date ?? "",
    end_date: phase?.end_date ?? "",
    status: phase?.status ?? "a_venir",
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await savePhase({ projectId, phaseId: phase?.id, ...form })
      if (res.ok) setOpen(false)
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <>
      {phase ? (
        <button onClick={() => setOpen(true)} className="p-1.5 rounded-full hover:bg-gray-100"
          aria-label={`Modifier la phase ${phase.name}`} title="Modifier la phase">
          <Pencil size={14} style={{ color: "#66716B" }} aria-hidden="true" />
        </button>
      ) : (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: "var(--brand-accent,#0E6B5C)" }}>
          <Plus size={15} /> Ajouter une phase
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} busy={pending} maxWidth="max-w-md"
        title={phase ? "Modifier la phase" : "Nouvelle phase"}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor={`${uid}-name`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nom *</label>
            <input id={`${uid}-name`} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
              className={inputCls} style={{ borderColor: "#E3E6E2" }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-status`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Statut</label>
              <select id={`${uid}-status`} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className={inputCls} style={{ borderColor: "#E3E6E2" }}>
                {PHASE_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {/* Le budget de phase n'est plus saisi (PR 39) : il est la
                somme des lignes qui lui sont rattachées. Deux montants
                modifiables pour la même chose ne fabriquaient que des
                divergences. */}
            <div>
              <label htmlFor={`${uid}-start`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Début</label>
              <input id={`${uid}-start`} type="date" value={form.start_date ?? ""} onChange={e => setForm({ ...form, start_date: e.target.value })}
                className={inputCls} style={{ borderColor: "#E3E6E2" }} />
            </div>
            <div>
              <label htmlFor={`${uid}-end`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Fin</label>
              <input id={`${uid}-end`} type="date" value={form.end_date ?? ""} onChange={e => setForm({ ...form, end_date: e.target.value })}
                className={inputCls} style={{ borderColor: "#E3E6E2" }} />
            </div>
          </div>
          <ErrorMessage>{error}</ErrorMessage>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>Annuler</button>
            <button type="submit" disabled={pending}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
              {pending ? "…" : phase ? "Enregistrer" : "Créer la phase"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
