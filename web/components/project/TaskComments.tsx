"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MessageSquare, Send, Trash2 } from "lucide-react"
import { addTaskComment, deleteTaskComment } from "@/app/(app)/projets/[id]/comment-actions"
import { MAX_COMMENT } from "@/lib/constants"

export interface TaskComment {
  id: string
  body: string
  created_at: string
  author_id: string | null
  author: { full_name: string | null } | null
}

// ============================================================
// 0067 — Le fil de commentaires d'une tâche
// ============================================================
// Replié par défaut, comme les pièces jointes : une phase de dix tâches
// dépliées ne se lit plus. La pastille porte le COMPTE — c'est ce qui
// donne envie d'ouvrir, et ce qui signale qu'il se passe quelque chose
// sur une tâche sans avoir à l'ouvrir.
//
// Rien n'est modifiable : un commentaire se corrige en en écrivant un
// autre. Supprimer reste possible pour son auteur (et un
// administrateur), et c'est la RLS qui tranche — le bouton n'est caché
// que par courtoisie.

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "à l'instant"
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? "hier" : `il y a ${d} j`
}

export default function TaskComments({ projectId, taskId, taskTitle, comments, meId }: {
  projectId: string
  taskId: string
  taskTitle: string
  comments: TaskComment[]
  // Qui je suis : sert à n'afficher la corbeille que sur ses propres
  // commentaires. La vérité reste en base.
  meId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const text = body.trim()
    if (!text) { setError("Écrivez quelque chose avant d'envoyer."); return }
    startTransition(async () => {
      const res = await addTaskComment({ projectId, taskId, taskTitle, body: text })
      if (!res.ok) { setError(res.error ?? "Une erreur est survenue."); return }
      setBody("")
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!window.confirm("Supprimer définitivement ce commentaire ?")) return
    startTransition(async () => {
      const res = await deleteTaskComment({ commentId: id, projectId })
      if (!res.ok) setError(res.error ?? "Suppression impossible.")
      else router.refresh()
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg"
        style={{ background: "#F5F6F4", color: comments.length ? "#66716B" : "#9AA39D" }}
        aria-expanded={open}
        title={comments.length ? "Afficher les commentaires" : "Aucun commentaire — en ajouter un"}>
        <MessageSquare size={11} aria-hidden="true" />
        {comments.length} commentaire{comments.length > 1 ? "s" : ""}
      </button>

      {open && (
        <div className="w-full mt-2 rounded-xl border p-3" style={{ borderColor: "#E3E6E2", background: "#FBFCFB" }}>
          {comments.length === 0 && (
            <p className="text-xs mb-2" style={{ color: "#66716B" }}>
              Aucun commentaire pour l&apos;instant.
            </p>
          )}
          <ul className="space-y-2 mb-3">
            {comments.map(c => (
              <li key={c.id} className="rounded-lg bg-white border p-2" style={{ borderColor: "#EEF0EE" }}>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold" style={{ color: "#17211D" }}>
                    {c.author?.full_name ?? "Compte supprimé"}
                  </span>
                  <span className="text-[11px]" style={{ color: "#9AA39D" }}>{timeAgo(c.created_at)}</span>
                  {c.author_id === meId && (
                    <button type="button" onClick={() => remove(c.id)} disabled={pending}
                      className="ml-auto p-0.5 rounded hover:bg-gray-100"
                      aria-label="Supprimer mon commentaire">
                      <Trash2 size={11} style={{ color: "#A3342C" }} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {/* `whitespace-pre-wrap` : les retours à la ligne saisis
                    sont ceux qu'on relit. Aucun HTML n'est interprété —
                    React échappe le texte. */}
                <p className="text-xs mt-1 whitespace-pre-wrap break-words" style={{ color: "#17211D" }}>{c.body}</p>
              </li>
            ))}
          </ul>

          <form onSubmit={submit} className="space-y-2">
            <label htmlFor={`comment-${taskId}`} className="sr-only">
              Commenter la tâche {taskTitle}
            </label>
            <textarea id={`comment-${taskId}`} rows={2} value={body} maxLength={MAX_COMMENT}
              onChange={e => setBody(e.target.value)}
              placeholder="Écrire un commentaire…"
              className="w-full px-3 py-2 rounded-xl border text-xs"
              style={{ borderColor: "#E3E6E2" }} />
            {error && <p className="text-xs" style={{ color: "#A3342C" }}>{error}</p>}
            <div className="flex items-center justify-between gap-2">
              {/* Dire à qui part le message AVANT de l'envoyer : un
                  commentaire qui prévient la direction du programme
                  n'est pas le même geste qu'une note pour soi. */}
              <span className="text-[11px]" style={{ color: "#66716B" }}>
                YCID / LEY et la direction du programme sont prévenus.
              </span>
              <button type="submit" disabled={pending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex-shrink-0"
                style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
                <Send size={12} aria-hidden="true" /> {pending ? "Envoi…" : "Commenter"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
