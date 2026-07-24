"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check } from "lucide-react"
import { PLATFORM_ROLES } from "@/lib/constants"
import { createUser, updateUser } from "@/app/(app)/admin/utilisateurs/user-actions"

const label = "block text-xs font-semibold mb-1 tracking-wider"
const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
const border = { borderColor: "#E3E6E2" }

interface UserData {
  id: string; full_name: string; email: string; platform_role: string; active: boolean
}

export default function UserForm({ user, canCreateAdmin }: { user?: UserData; canCreateAdmin: boolean }) {
  const router = useRouter()
  const isEdit = !!user
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    fullName: user?.full_name ?? "",
    email: user?.email ?? "",
    role: user?.platform_role ?? "admin",
    password: "",
    confirmPassword: "",
    active: user?.active ?? true,
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = isEdit ? await updateUser(user!.id, form) : await createUser(form)
      if (res.ok) router.push("/admin/utilisateurs")
      else setError(res.error ?? "Une erreur est survenue.")
    })
  }

  const roleOptions = Object.entries(PLATFORM_ROLES).filter(([k]) => canCreateAdmin || k !== "admin")

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border p-6 space-y-5 max-w-xl" style={border}>
      <div>
        <label className={label} style={{ color: "#66716B" }}>NOM COMPLET</label>
        <input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required className={inputCls} style={border} />
      </div>
      <div>
        <label className={label} style={{ color: "#66716B" }}>ADRESSE EMAIL</label>
        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className={inputCls} style={border} />
      </div>
      <div>
        <label className={label} style={{ color: "#66716B" }}>RÔLE</label>
        <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={inputCls} style={border}>
          {roleOptions.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <p className="text-xs mt-1" style={{ color: "#66716B" }}>
          Administrateur : accès complet. YCID : accès complet mais ne gère pas les administrateurs. Utilisateur : accès selon ses projets.
        </p>
      </div>
      <div>
        <label className={label} style={{ color: "#66716B" }}>MOT DE PASSE</label>
        <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
          minLength={12} required={!isEdit} autoComplete="new-password" className={inputCls} style={border} />
        <p className="text-xs mt-1" style={{ color: "#66716B" }}>
          {isEdit ? "Laisser vide pour conserver le mot de passe actuel." : "12 caractères minimum."}
        </p>
      </div>
      <div>
        <label className={label} style={{ color: "#66716B" }}>CONFIRMER LE MOT DE PASSE</label>
        <input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
          required={!isEdit || !!form.password} autoComplete="new-password" className={inputCls} style={border} />
      </div>
      <div className="pt-2 border-t" style={border}>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="mt-0.5" />
          <span>
            <span className="text-sm font-medium" style={{ color: "#17211D" }}>Compte actif</span>
            <span className="block text-xs" style={{ color: "#66716B" }}>Un compte désactivé ne peut plus se connecter.</span>
          </span>
        </label>
      </div>
      {error && <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5", color: "#A3342C" }}>{error}</p>}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={pending} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: "#0E6B5C", opacity: pending ? 0.7 : 1 }}>
          <Check size={16} /> {pending ? "…" : "Enregistrer"}
        </button>
        <Link href="/admin/utilisateurs" className="text-sm underline" style={{ color: "#66716B" }}>Annuler</Link>
      </div>
    </form>
  )
}
