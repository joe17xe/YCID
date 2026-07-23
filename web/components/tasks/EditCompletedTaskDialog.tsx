"use client"
import { useState, useTransition } from "react"
import { AlertTriangle, Pencil, X } from "lucide-react"
import { TASK_STATUS } from "@/lib/constants"
import type { TaskStatus } from "@/lib/types"
import { updateCompletedTask } from "@/app/(app)/projets/[id]/actions"

interface TaskProps {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  progress: number
  start_date: string | null
  end_date: string | null
  comment: string | null
}

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"

export default function EditCompletedTaskDialog({ task }: { task: TaskProps }) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0) // 0 fermé, 1 avertissement, 2 confirmation finale, 3 formulaire
  const [motif, setMotif] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? "",
    status: task.status as TaskStatus,
    progress: task.progress,
    start_date: task.start_date ?? "",
    end_date: task.end_date ?? "",
    comment: task.comment ?? "",
  })

  function close() {
    setStep(0)
    setMotif("")
    setConfirmation("")
    setError("")
  }

  function submit() {
    setError("")
    startTransition(async () => {
      const res = await updateCompletedTask({
        taskId: task.id,
        confirmation,
        motif,
        ...form,
        progress: Number(form.progress),
      })
      if (res.ok) close()
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <>
      <button
        onClick={() => setStep(1)}
        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium hover:bg-gray-50"
        style={{ borderColor: "#E3E6E2", color: "#66716B" }}
        title="Modifier cette tâche terminée (admin YCID / LEY)"
      >
        <Pencil size={12} /> Modifier
      </button>

      {step > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(23,33,29,0.45)" }} onClick={close}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "#E3E6E2" }}>
              <h3 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
                {step === 3 ? "Modifier la tâche" : "Tâche terminée"}
              </h3>
              <button onClick={close} style={{ color: "#66716B" }}><X size={18} /></button>
            </div>

            {/* Étape 1 : premier avertissement */}
            {step === 1 && (
              <div className="p-5">
                <div className="flex gap-3 rounded-xl p-4 mb-4" style={{ background: "#F7EDDD" }}>
                  <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" style={{ color: "#B4690E" }} />
                  <div className="text-sm" style={{ color: "#17211D" }}>
                    <p className="font-medium mb-1">Cette tâche est marquée comme terminée.</p>
                    <p style={{ color: "#66716B" }}>
                      La modifier revient à revenir en arrière sur une donnée validée. Cette action est
                      réservée aux administrateurs YCID / LEY et sera enregistrée dans le journal d&apos;audit du projet.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={close} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>Annuler</button>
                  <button onClick={() => setStep(2)} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#B4690E" }}>Continuer</button>
                </div>
              </div>
            )}

            {/* Étape 2 : confirmation finale (motif + saisie de MODIFIER) */}
            {step === 2 && (
              <div className="p-5 space-y-4">
                <p className="text-sm" style={{ color: "#66716B" }}>
                  Seconde confirmation requise avant de déverrouiller la tâche <span className="font-medium" style={{ color: "#17211D" }}>« {task.title} »</span>.
                </p>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Motif de la modification *</label>
                  <textarea value={motif} onChange={e => setMotif(e.target.value)} rows={2} required
                    placeholder="Ex. : erreur de saisie sur l'avancement, correction de dates…"
                    className={inputCls} style={{ borderColor: "#E3E6E2" }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>
                    Saisissez <span className="font-mono font-bold" style={{ color: "#A3342C" }}>MODIFIER</span> pour confirmer
                  </label>
                  <input value={confirmation} onChange={e => setConfirmation(e.target.value)}
                    className={inputCls} style={{ borderColor: "#E3E6E2" }} />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={close} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>Annuler</button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={confirmation !== "MODIFIER" || motif.trim().length < 5}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: "#A3342C" }}
                  >
                    Déverrouiller la tâche
                  </button>
                </div>
              </div>
            )}

            {/* Étape 3 : formulaire de modification */}
            {step === 3 && (
              <form className="p-5 space-y-4" onSubmit={e => { e.preventDefault(); submit() }}>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Titre *</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
                    className={inputCls} style={{ borderColor: "#E3E6E2" }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                    className={inputCls} style={{ borderColor: "#E3E6E2" }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Statut</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as TaskStatus })}
                      className={inputCls} style={{ borderColor: "#E3E6E2" }}>
                      {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Avancement (%)</label>
                    <input type="number" min={0} max={100} value={form.progress}
                      onChange={e => setForm({ ...form, progress: Number(e.target.value) })}
                      className={inputCls} style={{ borderColor: "#E3E6E2" }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Début</label>
                    <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                      className={inputCls} style={{ borderColor: "#E3E6E2" }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Fin</label>
                    <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                      className={inputCls} style={{ borderColor: "#E3E6E2" }} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Commentaire</label>
                  <textarea value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} rows={2}
                    className={inputCls} style={{ borderColor: "#E3E6E2" }} />
                </div>
                {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={close} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>Annuler</button>
                  <button type="submit" disabled={pending} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#0E6B5C", opacity: pending ? 0.7 : 1 }}>
                    {pending ? "Enregistrement…" : "Enregistrer les modifications"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
