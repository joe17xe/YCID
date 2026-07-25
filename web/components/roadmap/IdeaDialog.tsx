"use client"
import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Lightbulb, Pencil } from "lucide-react"
import Modal, { ErrorMessage } from "@/components/ui/Modal"
import { proposeIdea, updateIdea } from "@/app/(app)/roadmap/actions"

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

export default function IdeaDialog({ idea }: { idea?: { id: string; title: string; description: string; tags: string } }) {
  const router = useRouter()
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    title: idea?.title ?? "", description: idea?.description ?? "", tags: idea?.tags ?? "",
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = idea
        ? await updateIdea({ ideaId: idea.id, ...form })
        : await proposeIdea(form)
      if (res.ok) {
        setOpen(false)
        if (!idea && res.id) router.push(`/roadmap/${res.id}`)
      } else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <>
      {idea ? (
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium hover:bg-gray-50" style={{ ...border, color: "#66716B" }}>
          <Pencil size={13} /> Modifier
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
          <Lightbulb size={15} /> Proposer une idée
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} busy={pending} maxWidth="max-w-lg"
        title={idea ? "Modifier l'idée" : "Proposer une idée"}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor={`${uid}-title`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Titre *</label>
            <input id={`${uid}-title`} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className={inputCls} style={border} />
          </div>
          <div>
            <label htmlFor={`${uid}-desc`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Description</label>
            <textarea id={`${uid}-desc`} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4}
              placeholder="Décrivez le besoin, le contexte, ce que ça changerait…" className={inputCls} style={border} />
          </div>
          <div>
            <label htmlFor={`${uid}-tags`} className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Tags (séparés par des virgules)</label>
            <input id={`${uid}-tags`} value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
              placeholder="Rapports, Amélioration UX…" className={inputCls} style={border} />
          </div>
          <ErrorMessage>{error}</ErrorMessage>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
            <button type="submit" disabled={pending} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.7 : 1 }}>
              {pending ? "…" : idea ? "Enregistrer" : "Publier l'idée"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
