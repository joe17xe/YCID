"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Paperclip, Upload, Trash2, Download, Plus, AlertTriangle } from "lucide-react"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { createClient } from "@/lib/supabase/client"
import { TASK_DOC_TYPES, DOC_TYPE_LABELS, MAX_DOC_SIZE, buildStoragePath, type DocType } from "@/lib/documents"
import { saveDocument, deleteDocument, getDocumentUrl } from "@/app/(app)/projets/[id]/document-actions"

export interface TaskDoc {
  id: string
  filename: string
  type: DocType
  uploaded_at: string
}

// ============================================================
// PR 38a — Pièces jointes d'une tâche
// ============================================================
// Le compteur « 📎 N doc » existait depuis l'origine mais restait
// structurellement à 0 : rien ne permettait de déposer quoi que ce soit.
// Ce composant est le premier usage réel de la table `documents`.

export default function TaskDocuments({ projectId, phaseId, taskId, docs, canUpload, taskDone }: {
  projectId: string; phaseId: string; taskId: string
  docs: TaskDoc[]; canUpload: boolean
  // Une tâche déclarée terminée sans aucune pièce est SIGNALÉE, jamais
  // bloquée (PR 38e) : un blocage dur ferait renoncer à marquer les
  // tâches terminées, et on perdrait l'avancement en plus de la preuve.
  taskDone?: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<DocType>("justificatif")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!file) { setError("Choisissez un fichier."); return }
    if (file.size > MAX_DOC_SIZE) { setError("Fichier trop lourd (10 Mo maximum)."); return }
    setBusy(true)

    // Envoi direct au Storage depuis le navigateur : les policies du
    // bucket appliquent les mêmes droits que la table, et le fichier ne
    // transite pas par le serveur Next (limite de taille des actions).
    const path = buildStoragePath(projectId, phaseId, file.name)
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file)
    if (upErr) { setError(`Échec de l'envoi : ${upErr.message}`); setBusy(false); return }

    const res = await saveDocument({
      projectId, phaseId, taskId, type, filename: file.name, storagePath: path,
    })
    if (!res.ok) {
      // La ligne n'a pas été créée : le fichier déjà envoyé serait
      // invisible et impossible à retrouver — on le retire.
      await supabase.storage.from("documents").remove([path])
      setError(res.error ?? "Une erreur est survenue.")
      setBusy(false)
      return
    }
    setBusy(false); setFile(null); setOpen(false); setExpanded(true)
    router.refresh()
  }

  async function download(id: string) {
    const res = await getDocumentUrl(id)
    if (res.ok && res.url) window.open(res.url, "_blank", "noopener")
    else setError(res.error ?? "Lien indisponible.")
  }

  function remove(id: string, name: string) {
    if (!window.confirm(`Supprimer définitivement « ${name} » ?`)) return
    startTransition(async () => {
      const res = await deleteDocument(id)
      if (!res.ok) setError(res.error ?? "Suppression impossible.")
      else router.refresh()
    })
  }

  return (
    <>
      {/* Deux pastilles, deux natures : le compte de pièces est une
          DONNÉE (fond calme), le dépôt est une ACTION (bord + accent).
          Les libellés nus en couleur se confondaient avec le texte
          alentour — « du texte avec des chiffres », pas des boutons. */}
      <span className="inline-flex items-center gap-1.5">
        <button type="button" onClick={() => setExpanded(v => !v)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg"
          style={{ background: "#F5F6F4", color: docs.length ? "#66716B" : "#9AA39D" }}
          aria-expanded={expanded}
          title={docs.length ? "Afficher les pièces jointes" : "Aucune pièce jointe"}>
          <Paperclip size={11} aria-hidden="true" />
          {docs.length} doc{docs.length > 1 ? "s" : ""}
        </button>
        {canUpload && (
          <button type="button" onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border bg-white font-medium"
            style={{ borderColor: "#E3E6E2", color: "var(--brand-accent,#0E6B5C)" }}>
            <Plus size={11} aria-hidden="true" /> pièce
          </button>
        )}
        {taskDone && docs.length === 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ background: "#F7EDDD", color: "#8A6A1F" }}
            title="Tâche déclarée terminée sans pièce justificative : l'avancement est déclaratif.">
            <AlertTriangle size={10} aria-hidden="true" /> sans justificatif
          </span>
        )}
      </span>

      {expanded && docs.length > 0 && (
        <ul className="mt-1 space-y-1 w-full">
          {docs.map(d => (
            <li key={d.id} className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ background: "#EEF0EE", color: "#66716B" }}>
                {DOC_TYPE_LABELS[d.type] ?? d.type}
              </span>
              <button type="button" onClick={() => download(d.id)}
                className="inline-flex items-center gap-1 underline decoration-dotted truncate"
                style={{ color: "#17211D" }} title={`Télécharger ${d.filename}`}>
                <Download size={11} aria-hidden="true" />
                <span className="truncate">{d.filename}</span>
              </button>
              <button type="button" onClick={() => remove(d.id, d.filename)} disabled={pending}
                className="p-0.5 rounded hover:bg-gray-100 flex-shrink-0"
                aria-label={`Supprimer ${d.filename}`}>
                <Trash2 size={11} style={{ color: "#A3342C" }} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && !open && <p className="text-xs mt-1" style={{ color: "#A3342C" }}>{error}</p>}

      {open && (
        <Modal open onClose={() => !busy && setOpen(false)} title="Ajouter une pièce" busy={busy} maxWidth="max-w-md">
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label htmlFor="doc-file" className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Fichier *</label>
              <input id="doc-file" type="file" required
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm" />
              <p className="text-xs mt-1" style={{ color: "#66716B" }}>10 Mo maximum · le fichier n&apos;est visible que des membres du projet</p>
            </div>
            <div>
              <label htmlFor="doc-type" className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nature</label>
              <select id="doc-type" value={type} onChange={e => setType(e.target.value as DocType)}
                className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }}>
                {TASK_DOC_TYPES.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
              </select>
              {/* Devis, factures et reçus n'apparaissent volontairement
                  pas ici : sans ligne budgétaire à créditer, leur montant
                  ne compterait nulle part et leur validation resterait
                  invisible. */}
              <p className="text-xs mt-1" style={{ color: "#66716B" }}>
                Un devis, une facture ou un reçu se déposent sur la <strong>ligne budgétaire</strong>
                {" "}(onglet Budget) : c&apos;est là qu&apos;ils portent un montant et partent en validation.
              </p>
            </div>
            <ErrorMessage>{error}</ErrorMessage>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} disabled={busy}
                className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
                Annuler
              </button>
              <button type="submit" disabled={busy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: "var(--brand-accent,#0E6B5C)", opacity: busy ? 0.7 : 1 }}>
                <Upload size={14} aria-hidden="true" /> {busy ? "Envoi…" : "Déposer"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
