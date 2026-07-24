"use client"
import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, X, UserPlus, Copy, Check } from "lucide-react"
import { ORG_TYPES } from "@/lib/constants"
import { saveOrganization, deleteOrganization, createUserAccount } from "@/app/(app)/organisations/actions"

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

export interface OrgData {
  id: string; name: string; type: string; country: string; email: string | null; status: string
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(23,33,29,0.45)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={border}>
          <h3 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{title}</h3>
          <button onClick={onClose} style={{ color: "#66716B" }} aria-label="Fermer"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function OrgDialog({ org }: { org?: OrgData }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: org?.name ?? "", type: org?.type ?? "association", country: org?.country ?? "France",
    email: org?.email ?? "", status: org?.status ?? "active",
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await saveOrganization({ orgId: org?.id, ...form })
      if (res.ok) setOpen(false)
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  return (
    <>
      {org ? (
        <button onClick={() => setOpen(true)} className="p-1.5 rounded-full hover:bg-gray-100" title="Modifier"><Pencil size={14} style={{ color: "#66716B" }} /></button>
      ) : (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: "#0E6B5C" }}>
          <Plus size={16} /> Nouvelle organisation
        </button>
      )}
      {open && (
        <Modal title={org ? "Modifier l'organisation" : "Nouvelle organisation"} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="p-5 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nom *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputCls} style={border} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputCls} style={border}>
                  {Object.entries(ORG_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Pays</label>
                <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className={inputCls} style={border} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} style={border} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Statut</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls} style={border}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
              <button type="submit" disabled={pending} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#0E6B5C", opacity: pending ? 0.7 : 1 }}>
                {pending ? "…" : org ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

export function DeleteOrgButton({ org }: { org: OrgData }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  return (
    <>
      <button onClick={() => setOpen(true)} className="p-1.5 rounded-full hover:bg-red-50" title="Supprimer"><Trash2 size={14} style={{ color: "#A3342C" }} /></button>
      {open && (
        <Modal title="Supprimer l'organisation" onClose={() => setOpen(false)}>
          <div className="p-5">
            <p className="text-sm mb-4" style={{ color: "#17211D" }}>
              Supprimer <span className="font-semibold">« {org.name} »</span> ? Cette action est définitive.
            </p>
            {error && <p className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
              <button
                onClick={() => startTransition(async () => { const r = await deleteOrganization(org.id); if (r.ok) setOpen(false); else setError(r.error ?? "Erreur") })}
                disabled={pending}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#A3342C", opacity: pending ? 0.7 : 1 }}>
                {pending ? "…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// Crée un compte utilisateur à partir de l'email de l'organisation
export function CreateUserButton({ email, orgName }: { email: string; orgName: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [password, setPassword] = useState("")
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()
  const [fullName, setFullName] = useState(orgName)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await createUserAccount({ email, fullName })
      if (res.ok && res.password) setPassword(res.password)
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  function close() { setOpen(false); setPassword(""); setError(""); setCopied(false); setFullName(orgName) }

  return (
    <>
      <button onClick={() => setOpen(true)} className="p-1.5 rounded-full hover:bg-gray-100" title={`Créer un compte pour ${email}`}>
        <UserPlus size={14} style={{ color: "#0E6B5C" }} />
      </button>
      {open && (
        <Modal title="Créer un compte utilisateur" onClose={close}>
          {password ? (
            <div className="p-5">
              <p className="text-sm mb-3" style={{ color: "#17211D" }}>
                Compte créé pour <span className="font-mono">{email}</span>. Communiquez ce mot de passe temporaire à la personne — elle pourra le changer dans ses Préférences.
              </p>
              <div className="flex items-center gap-2 rounded-xl p-3 mb-4" style={{ background: "#F5F6F4" }}>
                <span className="font-mono text-sm flex-1" style={{ color: "#17211D" }}>{password}</span>
                <button onClick={() => { navigator.clipboard.writeText(password); setCopied(true) }} className="p-1.5 rounded hover:bg-gray-200" title="Copier">
                  {copied ? <Check size={15} style={{ color: "#0E6B5C" }} /> : <Copy size={15} style={{ color: "#66716B" }} />}
                </button>
              </div>
              <div className="flex justify-end">
                <button onClick={close} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#0E6B5C" }}>Terminé</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="p-5 space-y-3">
              <p className="text-xs" style={{ color: "#66716B" }}>
                Crée un accès directement (sans email d&apos;invitation). Un mot de passe temporaire vous sera affiché à transmettre.
              </p>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Email</label>
                <input value={email} readOnly className={inputCls} style={{ ...border, background: "#F5F6F4" }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#17211D" }}>Nom de la personne *</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} required className={inputCls} style={border} />
              </div>
              {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={close} className="px-4 py-2 rounded-xl border text-sm font-medium" style={{ ...border, color: "#66716B" }}>Annuler</button>
                <button type="submit" disabled={pending} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#0E6B5C", opacity: pending ? 0.7 : 1 }}>
                  {pending ? "…" : "Créer le compte"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  )
}
