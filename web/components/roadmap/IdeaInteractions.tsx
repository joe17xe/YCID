"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowUp, Trash2, Send } from "lucide-react"
import { IDEA_STATUS, IDEA_PRIORITY } from "@/lib/constants"
import { toggleVote, manageIdea, deleteIdea, addComment, deleteComment } from "@/app/(app)/roadmap/actions"

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

export function VoteButton({ ideaId, votes, hasVoted }: { ideaId: string; votes: number; hasVoted: boolean }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => startTransition(async () => { await toggleVote(ideaId) })}
        disabled={pending}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition-colors"
        style={{
          background: hasVoted ? "#0E6B5C" : "#fff",
          borderColor: hasVoted ? "#0E6B5C" : "#E3E6E2",
          color: hasVoted ? "#fff" : "#0E6B5C",
          opacity: pending ? 0.7 : 1,
        }}
      >
        <ArrowUp size={15} /> {hasVoted ? "Voté" : "Voter"}
      </button>
      <span className="text-sm" style={{ color: "#66716B" }}>
        <span className="font-semibold" style={{ color: "#17211D" }}>{votes}</span> vote{votes !== 1 ? "s" : ""} de l&apos;équipe
      </span>
    </div>
  )
}

export function AdminPanel({ ideaId, status, priority, difficulty }: { ideaId: string; status: string; priority: string; difficulty: number | null }) {
  const [form, setForm] = useState({ status, priority, difficulty: difficulty ? String(difficulty) : "" })
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setSaved(false)
    startTransition(async () => {
      const res = await manageIdea({ ideaId, ...form })
      if (res.ok) setSaved(true)
      else setError(res.error ?? "Erreur")
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="block text-xs font-semibold mb-1 tracking-wider" style={{ color: "#66716B" }}>STATUT</label>
        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls} style={border}>
          {Object.entries(IDEA_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1 tracking-wider" style={{ color: "#66716B" }}>PRIORITÉ</label>
        <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className={inputCls} style={border}>
          {Object.entries(IDEA_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1 tracking-wider" style={{ color: "#66716B" }}>DIFFICULTÉ (1-5)</label>
        <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} className={inputCls} style={border}>
          <option value="">Non évaluée</option>
          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}/5</option>)}
        </select>
      </div>
      {error && <p className="text-xs rounded px-2 py-1" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
      {saved && <p className="text-xs rounded px-2 py-1" style={{ background: "#E4F0EC", color: "#0E6B5C" }}>Enregistré.</p>}
      <button type="submit" disabled={pending} className="w-full py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#0E6B5C", opacity: pending ? 0.7 : 1 }}>
        {pending ? "…" : "Enregistrer"}
      </button>
    </form>
  )
}

export function DeleteIdeaButton({ ideaId }: { ideaId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium hover:bg-red-50" style={{ ...border, color: "#A3342C" }}>
        <Trash2 size={13} /> Supprimer
      </button>
    )
  }
  return (
    <span className="flex items-center gap-2">
      <button
        onClick={() => startTransition(async () => { const r = await deleteIdea(ideaId); if (r.ok) router.push("/roadmap") })}
        disabled={pending}
        className="px-3 py-1.5 rounded-xl text-sm font-semibold text-white" style={{ background: "#A3342C", opacity: pending ? 0.7 : 1 }}>
        {pending ? "…" : "Confirmer la suppression"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-sm" style={{ color: "#66716B" }}>Annuler</button>
    </span>
  )
}

interface CommentRow { id: string; body: string; authorName: string; createdAt: string; canDelete: boolean }

export function Comments({ ideaId, comments }: { ideaId: string; comments: CommentRow[] }) {
  const [body, setBody] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await addComment({ ideaId, body })
      if (res.ok) setBody("")
      else setError(res.error ?? "Erreur")
    })
  }

  return (
    <div>
      <div className="space-y-3 mb-4">
        {comments.map(c => (
          <div key={c.id} className="flex items-start justify-between gap-3 rounded-xl p-3" style={{ background: "#F5F6F4" }}>
            <div>
              <div className="text-xs mb-0.5" style={{ color: "#66716B" }}>
                <span className="font-semibold" style={{ color: "#17211D" }}>{c.authorName}</span>
                {" · "}{new Date(c.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
              <p className="text-sm" style={{ color: "#17211D" }}>{c.body}</p>
            </div>
            {c.canDelete && (
              <button
                onClick={() => startTransition(async () => { await deleteComment({ commentId: c.id, ideaId }) })}
                className="p-1 rounded hover:bg-red-50 flex-shrink-0" title="Supprimer">
                <Trash2 size={13} style={{ color: "#A3342C" }} />
              </button>
            )}
          </div>
        ))}
        {!comments.length && <p className="text-sm" style={{ color: "#66716B" }}>Aucun commentaire pour l&apos;instant.</p>}
      </div>
      <form onSubmit={submit}>
        <label className="block text-xs font-semibold mb-1 tracking-wider" style={{ color: "#66716B" }}>AJOUTER UN COMMENTAIRE</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Votre commentaire…"
          className={inputCls} style={border} />
        {error && <p className="text-xs mt-1 rounded px-2 py-1" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
        <button type="submit" disabled={pending || !body.trim()}
          className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "#0E6B5C", opacity: pending || !body.trim() ? 0.6 : 1 }}>
          <Send size={13} /> Publier
        </button>
      </form>
    </div>
  )
}
