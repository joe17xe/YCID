"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Camera, Upload, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { createClient } from "@/lib/supabase/client"
import { DOC_MOMENTS, DOC_MOMENT_LABELS, MAX_DOC_SIZE, buildStoragePath, type DocMoment } from "@/lib/documents"
import { saveDocument, deleteDocument } from "@/app/(app)/projets/[id]/document-actions"

// ============================================================
// PR 38c — Photos avant / pendant / après d'une phase
// ============================================================
// Une photo de chantier ne vaut que rapprochée de son état initial.
// D'où la présentation en colonnes par moment plutôt qu'en liste
// chronologique : c'est la comparaison qui porte l'information, pour un
// COPIL comme pour un support de communication.

export interface PhasePhoto {
  id: string
  filename: string
  moment: DocMoment | null
  url: string | null
}

export default function PhasePhotos({ projectId, phaseId, photos, canUpload }: {
  projectId: string; phaseId: string; photos: PhasePhoto[]; canUpload: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [moment, setMoment] = useState<DocMoment>("avant")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  const byMoment = (m: DocMoment) => photos.filter(p => p.moment === m)
  // Les photos sans moment (déposées avant la 38c, ou par l'API) ne
  // doivent pas disparaître de l'écran sous prétexte qu'elles ne rentrent
  // dans aucune colonne.
  const unclassified = photos.filter(p => !p.moment)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!file) { setError("Choisissez une photo."); return }
    if (file.size > MAX_DOC_SIZE) { setError("Photo trop lourde (10 Mo maximum)."); return }
    setBusy(true)
    const path = buildStoragePath(projectId, phaseId, file.name)
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file)
    if (upErr) { setError(`Échec de l'envoi : ${upErr.message}`); setBusy(false); return }

    // phaseId sans taskId : la photo appartient à la phase, pas à une
    // tâche — c'est ce qui la fait apparaître dans cette galerie.
    const res = await saveDocument({
      projectId, phaseId, type: "photo", moment,
      filename: file.name, storagePath: path,
    })
    if (!res.ok) {
      await supabase.storage.from("documents").remove([path])
      setError(res.error ?? "Une erreur est survenue."); setBusy(false); return
    }
    setBusy(false); setFile(null); setOpen(false); setExpanded(true)
    router.refresh()
  }

  function remove(p: PhasePhoto) {
    if (!window.confirm(`Supprimer définitivement « ${p.filename} » ?`)) return
    startTransition(async () => {
      const res = await deleteDocument(p.id)
      if (!res.ok) setError(res.error ?? "Suppression impossible.")
      else router.refresh()
    })
  }

  const counts = DOC_MOMENTS.map(m => `${byMoment(m).length} ${DOC_MOMENT_LABELS[m].toLowerCase()}`).join(" · ")

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3 text-xs">
        <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}
          className="inline-flex items-center gap-1" style={{ color: photos.length ? "#66716B" : "#9AA39D" }}>
          {expanded ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
          <Camera size={12} aria-hidden="true" />
          {photos.length === 0 ? "Aucune photo" : `${photos.length} photo${photos.length > 1 ? "s" : ""} — ${counts}`}
        </button>
        {canUpload && (
          <button type="button" onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--brand-accent,#0E6B5C)" }}>
            <Upload size={11} aria-hidden="true" /> Ajouter une photo
          </button>
        )}
      </div>

      {expanded && photos.length > 0 && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DOC_MOMENTS.map(m => (
            <div key={m}>
              <p className="text-xs font-semibold mb-1" style={{ color: "#17211D" }}>{DOC_MOMENT_LABELS[m]}</p>
              {byMoment(m).length === 0 ? (
                <p className="text-xs" style={{ color: "#9AA39D" }}>—</p>
              ) : (
                <ul className="grid grid-cols-2 gap-2">
                  {byMoment(m).map(p => <Thumb key={p.id} photo={p} canUpload={canUpload} pending={pending} onRemove={remove} />)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {expanded && unclassified.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold mb-1" style={{ color: "#66716B" }}>Sans moment renseigné</p>
          <ul className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {unclassified.map(p => <Thumb key={p.id} photo={p} canUpload={canUpload} pending={pending} onRemove={remove} />)}
          </ul>
        </div>
      )}

      {error && !open && <p className="text-xs mt-1" style={{ color: "#A3342C" }}>{error}</p>}

      {open && (
        <Modal open onClose={() => !busy && setOpen(false)} title="Ajouter une photo" busy={busy} maxWidth="max-w-md">
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label htmlFor={`photo-file-${phaseId}`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Photo *</label>
              <input id={`photo-file-${phaseId}`} type="file" accept="image/*" required
                onChange={e => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
              <p className="text-xs mt-1" style={{ color: "#66716B" }}>10 Mo maximum · formats photo, HEIC compris</p>
            </div>
            <div>
              <label htmlFor={`photo-moment-${phaseId}`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Moment</label>
              <select id={`photo-moment-${phaseId}`} value={moment} onChange={e => setMoment(e.target.value as DocMoment)}
                className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "#E3E6E2" }}>
                {DOC_MOMENTS.map(m => <option key={m} value={m}>{DOC_MOMENT_LABELS[m]}</option>)}
              </select>
              <p className="text-xs mt-1" style={{ color: "#66716B" }}>
                C&apos;est la comparaison avant / après qui fait la preuve : une photo non qualifiée
                ne se rapproche de rien.
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
    </div>
  )
}

function Thumb({ photo, canUpload, pending, onRemove }: {
  photo: PhasePhoto; canUpload: boolean; pending: boolean; onRemove: (p: PhasePhoto) => void
}) {
  return (
    <li className="relative group">
      {photo.url ? (
        <a href={photo.url} target="_blank" rel="noopener noreferrer" title={photo.filename}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={photo.filename} loading="lazy"
            className="w-full h-20 object-cover rounded-lg border" style={{ borderColor: "#E3E6E2" }} />
        </a>
      ) : (
        <div className="w-full h-20 rounded-lg border flex items-center justify-center text-xs"
          style={{ borderColor: "#E3E6E2", color: "#9AA39D" }}>indisponible</div>
      )}
      {canUpload && (
        <button type="button" onClick={() => onRemove(photo)} disabled={pending}
          className="absolute top-1 right-1 p-1 rounded-full bg-white/90 opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label={`Supprimer ${photo.filename}`}>
          <Trash2 size={11} style={{ color: "#A3342C" }} aria-hidden="true" />
        </button>
      )}
    </li>
  )
}
