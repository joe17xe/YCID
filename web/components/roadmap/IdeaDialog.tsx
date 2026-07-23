"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Lightbulb, Pencil, X } from "lucide-react"
import { proposeIdea, updateIdea } from "@/app/(app)/roadmap/actions"

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

export default function IdeaDialog({ idea }: { idea?: { id: string; title: string; description: string; tags: string } }) {
  const router = useRouter()
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
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: "#0E6B5C" }}>
          <Lightbulb size={15} /> Proposer une idée
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(23,33,29,0.45)" }} onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b" style={border}>
              <h3 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
                {idea ? "Modifier l'idée" : "Proposer une idée"}
              </h3>
              <button onClick={() => setOpen(false)} style={{ color: "#66716B" }}><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Titre *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className={inputCls} style={border} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4}
                  placeholder="Décrivez le besoin, le contexte, ce que ça changerait…" className={inputCls} style={border} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Tags (séparés par des virgules)</label>
                <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                  placeholder="Rapports, Amélioration UX…" className={inputCls} style={border} />
              </div>
              {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
                <button type="submit" disabled={pending} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#0E6B5C", opacity: pending ? 0.7 : 1 }}>
                  {pending ? "…" : idea ? "Enregistrer" : "Publier l'idée"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
