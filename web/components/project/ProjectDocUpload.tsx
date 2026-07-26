"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, Paperclip } from "lucide-react"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { createClient } from "@/lib/supabase/client"
import { DOC_TYPE_LABELS, MAX_DOC_SIZE, buildStoragePath, type DocType } from "@/lib/documents"
import { saveDocument } from "@/app/(app)/projets/[id]/document-actions"

// ============================================================
// Dépôt d'une pièce au niveau du PROJET (J4)
// ============================================================
// La 38a avait élargi le rattachement d'un document — `project_id` et
// `phase_id` en plus de la tâche et de la ligne budgétaire — mais
// l'interface n'offrait le dépôt que sur une tâche, une ligne ou une
// photo de phase.
//
// Conséquence : la CONVENTION DE FINANCEMENT, pièce fondatrice du
// projet, n'avait nulle part où aller. Ni sur une tâche, à laquelle elle
// ne se rattache pas, ni sur une ligne budgétaire, puisqu'elle les
// couvre toutes. Elle finissait donc hors de l'outil — c'est-à-dire
// nulle part le jour d'un contrôle.
//
// Les types proposés ici sont ceux qui portent sur le projet entier.
// Devis et factures restent sur leur ligne budgétaire : les déposer au
// niveau projet les sortirait du circuit de validation et du calcul de
// l'engagé.
const PROJECT_DOC_TYPES: DocType[] = ['convention', 'rapport', 'etude', 'note', 'justificatif']

export default function ProjectDocUpload({ projectId, phases }: {
  projectId: string
  phases: { id: string; name: string }[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<DocType>("convention")
  const [phaseId, setPhaseId] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!file) { setError("Choisissez un fichier."); return }
    if (file.size > MAX_DOC_SIZE) { setError("Fichier trop lourd (10 Mo maximum)."); return }
    setBusy(true)

    const path = buildStoragePath(projectId, phaseId || null, file.name)
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file)
    if (upErr) { setError(`Échec de l'envoi : ${upErr.message}`); setBusy(false); return }

    const res = await saveDocument({
      projectId, phaseId: phaseId || null, type,
      filename: file.name, storagePath: path, amount: null,
    })
    if (!res.ok) {
      // Le fichier envoyé mais non enregistré deviendrait un orphelin
      // dans le Storage : on le retire.
      await supabase.storage.from("documents").remove([path])
      setError(res.error ?? "Une erreur est survenue."); setBusy(false); return
    }
    setBusy(false); setFile(null); setPhaseId(""); setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-semibold"
        style={{ background: "var(--brand-accent,#0E6B5C)" }}>
        <Paperclip size={14} aria-hidden="true" /> Déposer une pièce
      </button>

      <Modal open={open} onClose={() => setOpen(false)} busy={busy} maxWidth="max-w-md"
        title="Déposer une pièce du projet">
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs" style={{ color: "#66716B" }}>
            Pour les pièces qui portent sur le projet entier — convention de financement,
            rapport, étude. Les devis et factures se déposent sur leur ligne budgétaire,
            pour rester dans le circuit de validation.
          </p>
          <input type="file" required onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm" />
          <div>
            <label htmlFor="pdu-type" className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nature *</label>
            <select id="pdu-type" value={type} onChange={e => setType(e.target.value as DocType)}
              className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }}>
              {PROJECT_DOC_TYPES.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pdu-phase" className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Phase concernée</label>
            <select id="pdu-phase" value={phaseId} onChange={e => setPhaseId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }}>
              <option value="">Tout le projet</option>
              {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <p className="text-xs mt-1" style={{ color: "#66716B" }}>
              Facultatif. « Tout le projet » convient à une convention.
            </p>
          </div>
          <ErrorMessage>{error}</ErrorMessage>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
              Annuler
            </button>
            <button type="submit" disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "var(--brand-accent,#0E6B5C)", opacity: busy ? 0.7 : 1 }}>
              <Upload size={14} /> {busy ? "Envoi…" : "Déposer"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
