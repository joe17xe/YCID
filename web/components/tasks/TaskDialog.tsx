"use client"
import { useState, useTransition } from "react"
import { Plus, Pencil, X } from "lucide-react"
import { TASK_STATUS } from "@/lib/constants"
import type { TaskStatus } from "@/lib/types"
import { saveTask } from "@/app/(app)/projets/[id]/actions"

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"

interface TaskData {
  id: string
  title: string
  description: string | null
  assignee_id: string | null
  start_date: string | null
  end_date: string | null
  status: TaskStatus
  progress: number
}

export default function TaskDialog({ phaseId, members, task }: {
  phaseId: string
  members: { id: string; name: string }[]
  task?: TaskData
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    assignee_id: task?.assignee_id ?? "",
    start_date: task?.start_date ?? "",
    end_date: task?.end_date ?? "",
    status: (task?.status ?? "a_faire") as TaskStatus,
    progress: task?.progress ?? 0,
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await saveTask({ phaseId, taskId: task?.id, ...form, progress: Number(form.progress) })
      if (res.ok) setOpen(false)
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <>
      {task ? (
        <button onClick={() => setOpen(true)} className="p-1.5 rounded-full hover:bg-gray-100" title="Modifier la tâche">
          <Pencil size={13} style={{ color: "#66716B" }} />
        </button>
      ) : (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium hover:bg-gray-50"
          style={{ borderColor: "#E3E6E2", color: "#0E6B5C" }}>
          <Plus size={12} /> Tâche
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(23,33,29,0.45)" }} onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "#E3E6E2" }}>
              <h3 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
                {task ? "Modifier la tâche" : "Nouvelle tâche"}
              </h3>
              <button onClick={() => setOpen(false)} style={{ color: "#66716B" }}><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Titre *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
                  className={inputCls} style={{ borderColor: "#E3E6E2" }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Description</label>
                <textarea value={form.description ?? ""} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                  className={inputCls} style={{ borderColor: "#E3E6E2" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Responsable</label>
                  <select value={form.assignee_id ?? ""} onChange={e => setForm({ ...form, assignee_id: e.target.value })}
                    className={inputCls} style={{ borderColor: "#E3E6E2" }}>
                    <option value="">Non assignée</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Statut</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as TaskStatus })}
                    className={inputCls} style={{ borderColor: "#E3E6E2" }}>
                    {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
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
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Avancement (%)</label>
                <input type="number" min={0} max={100} value={form.progress}
                  onChange={e => setForm({ ...form, progress: Number(e.target.value) })}
                  className={inputCls} style={{ borderColor: "#E3E6E2" }} />
              </div>
              {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>Annuler</button>
                <button type="submit" disabled={pending}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#0E6B5C", opacity: pending ? 0.7 : 1 }}>
                  {pending ? "…" : task ? "Enregistrer" : "Créer la tâche"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
