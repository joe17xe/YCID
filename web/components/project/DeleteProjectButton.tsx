"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2, AlertTriangle, X } from "lucide-react"
import { deleteProject } from "@/app/(app)/projets/[id]/actions"

export default function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const router = useRouter()
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function close() { setStep(0); setConfirmation(""); setError("") }

  function submit() {
    setError("")
    startTransition(async () => {
      const res = await deleteProject({ projectId, confirmation })
      if (res.ok) router.push("/projets")
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <>
      <button onClick={() => setStep(1)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium hover:bg-red-50"
        style={{ borderColor: "#E3E6E2", color: "#A3342C" }}>
        <Trash2 size={14} /> Supprimer
      </button>

      {step > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(23,33,29,0.45)" }} onClick={close}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "#E3E6E2" }}>
              <h3 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Supprimer le projet</h3>
              <button onClick={close} style={{ color: "#66716B" }}><X size={18} /></button>
            </div>

            {step === 1 && (
              <div className="p-5">
                <div className="flex gap-3 rounded-xl p-4 mb-4" style={{ background: "#F6E7E5" }}>
                  <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" style={{ color: "#A3342C" }} />
                  <div className="text-sm" style={{ color: "#17211D" }}>
                    <p className="font-medium mb-1">Suppression définitive et irréversible.</p>
                    <p style={{ color: "#66716B" }}>
                      Tout le projet sera effacé : phases, tâches, budget, indicateurs, réunions, décisions,
                      documents et journal d&apos;audit. Cette action ne peut pas être annulée.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={close} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>Annuler</button>
                  <button onClick={() => setStep(2)} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#B4690E" }}>Continuer</button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="p-5 space-y-4">
                <p className="text-sm" style={{ color: "#66716B" }}>
                  Pour confirmer, saisissez le nom exact du projet : <span className="font-semibold" style={{ color: "#17211D" }}>{projectName}</span>
                </p>
                <input
                  value={confirmation}
                  onChange={e => setConfirmation(e.target.value)}
                  placeholder="Nom du projet"
                  className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  style={{ borderColor: "#E3E6E2" }}
                />
                {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={close} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>Annuler</button>
                  <button
                    onClick={submit}
                    disabled={pending || confirmation.trim() !== projectName.trim()}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: "#A3342C" }}>
                    {pending ? "Suppression…" : "Supprimer définitivement"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
