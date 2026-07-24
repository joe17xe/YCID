"use client"
import { useState, useTransition } from "react"
import { UserPlus, X, UserMinus } from "lucide-react"
import { ACCESS_ROLES } from "@/lib/constants"
import { addProjectMember, removeProjectMember } from "@/app/(app)/projets/[id]/actions"

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

export function MemberDialog({ projectId, candidates }: {
  projectId: string
  candidates: { id: string; name: string; email: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({ userId: "", role: "contributeur" })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await addProjectMember({ projectId, ...form })
      if (res.ok) { setOpen(false); setForm({ userId: "", role: "contributeur" }) }
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium hover:bg-gray-50"
        style={{ ...border, color: "#0E6B5C" }}>
        <UserPlus size={12} /> Membre
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(23,33,29,0.45)" }} onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b" style={border}>
              <h3 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Ajouter un membre</h3>
              <button onClick={() => setOpen(false)} style={{ color: "#66716B" }}><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-3">
              <p className="text-xs" style={{ color: "#66716B" }}>
                L&apos;utilisateur doit déjà avoir un compte (invitez-le d&apos;abord depuis Administration &gt; Utilisateurs).
                Son rôle détermine ses droits sur ce projet (voir Accès &amp; rôles).
              </p>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Utilisateur *</label>
                <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} required
                  className={inputCls} style={border}>
                  <option value="">Choisir…</option>
                  {candidates.map(c => <option key={c.id} value={c.id}>{c.name || c.email}</option>)}
                </select>
                {!candidates.length && (
                  <p className="text-xs mt-1" style={{ color: "#B4690E" }}>
                    Tous les comptes existants sont déjà membres — invitez d&apos;abord un nouvel utilisateur.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Rôle sur le projet *</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  className={inputCls} style={border}>
                  {Object.entries(ACCESS_ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
                <button type="submit" disabled={pending || !form.userId}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "#0E6B5C", opacity: pending || !form.userId ? 0.6 : 1 }}>
                  {pending ? "…" : "Ajouter au projet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export function RemoveMemberButton({ projectId, userId, name }: { projectId: string; userId: string; name: string }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="p-1 rounded-full hover:bg-red-50" title={`Retirer ${name} du projet`}>
        <UserMinus size={13} style={{ color: "#A3342C" }} />
      </button>
    )
  }
  return (
    <span className="flex items-center gap-1.5">
      {error && <span className="text-xs" style={{ color: "#A3342C" }}>{error}</span>}
      <button
        onClick={() => startTransition(async () => {
          const res = await removeProjectMember({ projectId, userId })
          if (!res.ok) setError(res.error ?? "Erreur")
        })}
        disabled={pending}
        className="text-xs px-2 py-0.5 rounded-full font-semibold text-white"
        style={{ background: "#A3342C", opacity: pending ? 0.7 : 1 }}>
        {pending ? "…" : "Retirer"}
      </button>
      <button onClick={() => { setConfirming(false); setError("") }} className="text-xs" style={{ color: "#66716B" }}>Annuler</button>
    </span>
  )
}
