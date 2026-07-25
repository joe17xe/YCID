"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { deleteTask } from "@/app/(app)/projets/[id]/actions"

// Suppression d'une tâche. Confirmation en dialogue plutôt qu'en
// window.confirm() : la conséquence sur le budget et les pièces jointes
// mérite d'être lue, pas expédiée dans une boîte système.
export default function DeleteTaskButton({ taskId, projectId, title, budget, docCount }: {
  taskId: string; projectId: string; title: string; budget: number; docCount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function submit() {
    setError("")
    startTransition(async () => {
      const res = await deleteTask({ taskId, projectId })
      if (!res.ok) setError(res.error ?? "Suppression impossible.")
      else { setOpen(false); router.refresh() }
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="p-1 rounded-full hover:bg-red-50"
        aria-label={`Supprimer la tâche ${title}`} title="Supprimer la tâche">
        <Trash2 size={13} style={{ color: "#A3342C" }} aria-hidden="true" />
      </button>

      {open && (
        <Modal open onClose={() => !pending && setOpen(false)} title="Supprimer la tâche" busy={pending} maxWidth="max-w-md">
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "#17211D" }}>
              Supprimer définitivement <strong>{title}</strong> ?
            </p>

            {/* Dire ce que la suppression emporte : un montant qui
                « disparaît » sans explication ferait douter du budget. */}
            {(budget > 0 || docCount > 0) && (
              <ul className="text-xs space-y-1 rounded-xl p-3" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
                {budget > 0 && (
                  <li>
                    {Math.round(budget).toLocaleString("fr-FR")} € lui sont affectés : ce montant
                    redeviendra « non affecté » sur sa ligne budgétaire. Il n&apos;est pas perdu.
                  </li>
                )}
                {docCount > 0 && (
                  <li>
                    {docCount} pièce{docCount > 1 ? "s" : ""} jointe{docCount > 1 ? "s" : ""} : le
                    fichier est conservé mais perd son rattachement à cette tâche. Il restera
                    visible dans l&apos;onglet Documents.
                  </li>
                )}
              </ul>
            )}

            <ErrorMessage>{error}</ErrorMessage>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} disabled={pending}
                className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
                Annuler
              </button>
              <button type="button" onClick={submit} disabled={pending}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: "#A3342C", opacity: pending ? 0.6 : 1 }}>
                {pending ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
