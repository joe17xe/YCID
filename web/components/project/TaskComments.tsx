"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MessageSquare, Send, Trash2, HelpCircle, Check } from "lucide-react"
import { addTaskComment, deleteTaskComment, setQuestionAnswered } from "@/app/(app)/projets/[id]/comment-actions"
import { MAX_COMMENT } from "@/lib/constants"

export interface TaskComment {
  id: string
  body: string
  created_at: string
  author_id: string | null
  author: { full_name: string | null } | null
  // 0068 — une demande adressée à quelqu'un, et son état.
  addressed_to: string | null
  addressee: { full_name: string | null } | null
  answered_at: string | null
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

export default function TaskComments({ projectId, taskId, taskTitle, comments, meId, members }: {
  projectId: string
  taskId: string
  taskTitle: string
  comments: TaskComment[]
  // Qui je suis : sert à n'afficher la corbeille que sur ses propres
  // commentaires, et le bouton « c'est fait » sur les demandes qui me
  // reviennent. La vérité reste en base.
  meId: string
  // Les membres du projet — ceux à qui on peut adresser une demande. Un
  // non-membre ne verrait ni la tâche ni la demande.
  members: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState("")
  const [addressedTo, setAddressedTo] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  // Les demandes qui attendent encore. C'est le seul chiffre qui mérite
  // d'être visible sans déplier : un fil de bavardage peut attendre, une
  // facture qu'on réclame depuis trois semaines, non.
  const enAttente = comments.filter(c => c.addressed_to && !c.answered_at)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const text = body.trim()
    if (!text) { setError("Écrivez quelque chose avant d'envoyer."); return }
    startTransition(async () => {
      const res = await addTaskComment({ projectId, taskId, taskTitle, body: text, addressedTo: addressedTo || null })
      if (!res.ok) { setError(res.error ?? "Une erreur est survenue."); return }
      setBody(""); setAddressedTo("")
      router.refresh()
    })
  }

  function toggleAnswered(id: string, answered: boolean) {
    startTransition(async () => {
      const res = await setQuestionAnswered({ commentId: id, projectId, answered })
      if (!res.ok) setError(res.error ?? "Opération impossible.")
      else router.refresh()
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
      {/* Une demande en attente ne se découvre pas en dépliant : elle se
          voit sur la tâche, en rouge, comme un retard. C'est la seule
          chose du fil qui appelle un geste de quelqu'un. */}
      {enAttente.length > 0 && (
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-semibold"
          style={{ background: "#FBEAEA", color: "#A3342C" }}
          title={enAttente.map(c => `Demande à ${c.addressee?.full_name ?? "un membre"} : ${c.body}`).join(" · ")}>
          <HelpCircle size={11} aria-hidden="true" />
          {enAttente.length} demande{enAttente.length > 1 ? "s" : ""} en attente
        </button>
      )}

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
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xs font-semibold" style={{ color: "#17211D" }}>
                    {c.author?.full_name ?? "Compte supprimé"}
                  </span>
                  {c.addressed_to && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={c.answered_at
                        ? { background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }
                        : { background: "#FBEAEA", color: "#A3342C" }}>
                      {c.answered_at ? "réglé" : "demande"} · {c.addressee?.full_name ?? "un membre"}
                    </span>
                  )}
                  <span className="text-[11px]" style={{ color: "#9AA39D" }}>{timeAgo(c.created_at)}</span>
                  {/* Solder : le destinataire (il a fait la chose) ou
                      l'auteur (il a obtenu ce qu'il voulait, parfois par
                      un autre canal). « Déposez la facture » se règle en
                      déposant la facture, pas en écrivant une réponse —
                      c'est pourquoi le geste est explicite. */}
                  {c.addressed_to && !c.answered_at && (c.addressed_to === meId || c.author_id === meId) && (
                    <button type="button" onClick={() => toggleAnswered(c.id, true)} disabled={pending}
                      className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-white"
                      style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
                      <Check size={10} aria-hidden="true" /> C&apos;est fait
                    </button>
                  )}
                  {c.addressed_to && c.answered_at && (c.addressed_to === meId || c.author_id === meId) && (
                    <button type="button" onClick={() => toggleAnswered(c.id, false)} disabled={pending}
                      className="ml-auto text-[10px] underline" style={{ color: "#66716B" }}>
                      rouvrir
                    </button>
                  )}
                  {c.author_id === meId && (
                    <button type="button" onClick={() => remove(c.id)} disabled={pending}
                      className={c.addressed_to ? "p-0.5 rounded hover:bg-gray-100" : "ml-auto p-0.5 rounded hover:bg-gray-100"}
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
              placeholder={addressedTo
                ? "Ce que vous demandez — « merci de déposer le devis et la facture »…"
                : "Écrire un commentaire…"}
              className="w-full px-3 py-2 rounded-xl border text-xs"
              style={{ borderColor: "#E3E6E2" }} />
            {/* Le champ qui transforme une remarque en demande. Vide, le
                commentaire reste un commentaire — on ne force personne à
                désigner quelqu'un pour dire quelque chose. */}
            <div className="flex items-center gap-2 flex-wrap">
              <label htmlFor={`ask-${taskId}`} className="text-[11px]" style={{ color: "#66716B" }}>
                Demander à
              </label>
              <select id={`ask-${taskId}`} value={addressedTo} onChange={e => setAddressedTo(e.target.value)}
                className="px-2 py-1 rounded-lg border text-xs" style={{ borderColor: "#E3E6E2" }}>
                <option value="">personne en particulier</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {addressedTo && (
                <span className="text-[11px]" style={{ color: "#A3342C" }}>
                  signalé « en attente » sur la tâche jusqu&apos;à ce que ce soit réglé
                </span>
              )}
            </div>
            {error && <p className="text-xs" style={{ color: "#A3342C" }}>{error}</p>}
            <div className="flex items-center justify-between gap-2">
              {/* Dire à qui part le message AVANT de l'envoyer : un
                  commentaire qui prévient la direction du programme
                  n'est pas le même geste qu'une note pour soi. */}
              <span className="text-[11px]" style={{ color: "#66716B" }}>
                {addressedTo
                  ? "La personne reçoit une demande ; YCID / LEY et la direction sont en copie."
                  : "YCID / LEY et la direction du programme sont prévenus."}
              </span>
              <button type="submit" disabled={pending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex-shrink-0"
                style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
                <Send size={12} aria-hidden="true" /> {pending ? "Envoi…" : addressedTo ? "Demander" : "Commenter"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
