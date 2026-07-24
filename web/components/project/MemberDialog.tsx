"use client"
import { useState, useTransition } from "react"
import { UserPlus, X, UserMinus, Sparkles, Copy, Check } from "lucide-react"
import { ACCESS_ROLES } from "@/lib/constants"
import { addProjectMember, removeProjectMember, createProjectUser } from "@/app/(app)/projets/[id]/actions"

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
        style={{ ...border, color: "var(--brand-accent,#0E6B5C)" }}>
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
                Pour un compte existant. Pour créer un nouveau compte rattaché à ce projet,
                utilisez « Inviter ». Le rôle détermine les droits sur ce projet (voir Accès &amp; rôles).
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
                  style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending || !form.userId ? 0.6 : 1 }}>
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

// PR 29 — Délégation : le chef de projet crée un compte Utilisateur
// rattaché à SON projet uniquement (jamais admin). Le mot de passe
// temporaire n'est montré qu'une seule fois.
export function InviteUserDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({ fullName: "", email: "", role: "contributeur" })
  const [tempPassword, setTempPassword] = useState("")
  const [copied, setCopied] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await createProjectUser({ projectId, ...form })
      if (res.ok && res.tempPassword) setTempPassword(res.tempPassword)
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  async function copyCreds() {
    await navigator.clipboard.writeText(`Identifiant : ${form.email}\nMot de passe temporaire : ${tempPassword}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function close() {
    setOpen(false)
    setForm({ fullName: "", email: "", role: "contributeur" })
    setTempPassword("")
    setError("")
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium hover:bg-gray-50"
        style={{ ...border, color: "var(--brand-accent,#0E6B5C)" }}>
        <Sparkles size={12} /> Inviter
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(23,33,29,0.45)" }} onClick={close}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b" style={border}>
              <h3 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Inviter un nouvel utilisateur</h3>
              <button onClick={close} style={{ color: "#66716B" }}><X size={18} /></button>
            </div>
            {tempPassword ? (
              <div className="p-5 space-y-3">
                <p className="text-sm" style={{ color: "#17211D" }}>
                  ✅ Compte créé et ajouté au projet. Transmettez ces identifiants de façon
                  sécurisée — le mot de passe <strong>ne sera plus jamais affiché</strong> :
                </p>
                <div className="rounded-xl border p-3 text-sm font-mono" style={{ ...border, background: "#FAFBFA", color: "#17211D" }}>
                  <div>{form.email}</div>
                  <div>{tempPassword}</div>
                </div>
                <p className="text-xs" style={{ color: "#66716B" }}>
                  L&apos;utilisateur pourra changer son mot de passe dans ses Préférences.
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={copyCreds} className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#17211D" }}>
                    {copied ? <Check size={14} style={{ color: "var(--brand-accent,#0E6B5C)" }} /> : <Copy size={14} />} {copied ? "Copié" : "Copier les identifiants"}
                  </button>
                  <button onClick={close} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="p-5 space-y-3">
                <p className="text-xs" style={{ color: "#66716B" }}>
                  Crée un compte <strong>Utilisateur</strong> rattaché à ce projet uniquement.
                </p>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nom complet *</label>
                  <input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required className={inputCls} style={border} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Adresse email *</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className={inputCls} style={border} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Rôle sur le projet *</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={inputCls} style={border}>
                    {Object.entries(ACCESS_ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={close} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
                  <button type="submit" disabled={pending}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: "var(--brand-accent,#0E6B5C)", opacity: pending ? 0.6 : 1 }}>
                    {pending ? "…" : "Créer le compte"}
                  </button>
                </div>
              </form>
            )}
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
