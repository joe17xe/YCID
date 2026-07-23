"use client"
import { useState, useTransition } from "react"
import { Plus, Pencil, X } from "lucide-react"
import { savePhase } from "@/app/(app)/projets/[id]/actions"

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"

const PHASE_STATUS_OPTIONS = [
  { value: "a_venir", label: "À venir" },
  { value: "en_cours", label: "En cours" },
  { value: "terminee", label: "Terminée" },
]

interface PhaseData { id: string; name: string; start_date: string | null; end_date: string | null; status: string; budget: number | null }

export default function PhaseDialog({ projectId, phase }: { projectId: string; phase?: PhaseData }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: phase?.name ?? "",
    start_date: phase?.start_date ?? "",
    end_date: phase?.end_date ?? "",
    status: phase?.status ?? "a_venir",
    budget: phase?.budget != null ? String(phase.budget) : "",
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
        <button onClick={() => setOpen(true)} className="p-1.5 rounded-full hover:bg-gray-100" title="Modifier la phase">
          <Pencil size={14} style={{ color: "#66716B" }} />
        </button>
      ) : (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: "#0E6B5C" }}>
          <Plus size={15} /> Ajouter une phase
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(23,33,29,0.45)" }} onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "#E3E6E2" }}>
              <h3 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
                {phase ? "Modifier la phase" : "Nouvelle phase"}
              </h3>
              <button onClick={() => setOpen(false)} style={{ color: "#66716B" }}><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nom *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                  className={inputCls} style={{ borderColor: "#E3E6E2" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Statut</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className={inputCls} style={{ borderColor: "#E3E6E2" }}>
                    {PHASE_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Budget (€)</label>
                  <input type="number" min={0} step="0.01" value={form.budget}
                    onChange={e => setForm({ ...form, budget: e.target.value })}
                    className={inputCls} style={{ borderColor: "#E3E6E2" }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Début</label>
                  <input type="date" value={form.start_date ?? ""} onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className={inputCls} style={{ borderColor: "#E3E6E2" }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Fin</label>
                  <input type="date" value={form.end_date ?? ""} onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className={inputCls} style={{ borderColor: "#E3E6E2" }} />
                </div>
              </div>
              {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>Annuler</button>
                <button type="submit" disabled={pending}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#0E6B5C", opacity: pending ? 0.7 : 1 }}>
                  {pending ? "…" : phase ? "Enregistrer" : "Créer la phase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
