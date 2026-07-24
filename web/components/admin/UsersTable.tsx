"use client"
import { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import { Search, Settings, Trash2 } from "lucide-react"
import { PLATFORM_ROLES } from "@/lib/constants"
import { deleteUser } from "@/app/(app)/admin/utilisateurs/user-actions"

export interface AdminUserRow {
  id: string
  full_name: string
  email: string
  platform_role: string
  active: boolean
  isSelf: boolean
  canDelete: boolean
}

function DeleteButton({ user }: { user: AdminUserRow }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium hover:bg-red-50"
        style={{ borderColor: "#E3E6E2", color: "#A3342C" }}>
        <Trash2 size={13} /> Supprimer
      </button>
    )
  }
  return (
    <span className="flex items-center gap-1.5">
      {error && <span className="text-xs" style={{ color: "#A3342C" }}>{error}</span>}
      <button onClick={() => startTransition(async () => { const r = await deleteUser(user.id); if (!r.ok) { setError(r.error ?? "Erreur"); setConfirming(false) } })}
        disabled={pending} className="text-xs px-2 py-1 rounded-lg font-semibold text-white" style={{ background: "#A3342C", opacity: pending ? 0.7 : 1 }}>
        {pending ? "…" : "Confirmer"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-xs" style={{ color: "#66716B" }}>Annuler</button>
    </span>
  )
}

export default function UsersTable({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState("")
  const [role, setRole] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users
      .filter(u => !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .filter(u => !role || u.platform_role === role)
  }, [users, query, role])

  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
      <div className="p-4 border-b flex flex-wrap items-center gap-3" style={{ borderColor: "#E3E6E2" }}>
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#66716B" }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un nom, un email…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" style={{ borderColor: "#E3E6E2" }} />
        </div>
        <select value={role} onChange={e => setRole(e.target.value)} className="px-3 py-2 rounded-xl border text-sm focus:outline-none" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
          <option value="">Tous les rôles</option>
          {Object.entries(PLATFORM_ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="text-sm" style={{ color: "#66716B" }}>{filtered.length} / {users.length}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
            <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>NOM</th>
            <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>EMAIL</th>
            <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>RÔLE</th>
            <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>STATUT</th>
            <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u, i) => {
            const r = PLATFORM_ROLES[u.platform_role] ?? PLATFORM_ROLES.user
            return (
              <tr key={u.id} style={{ borderBottom: "1px solid #E3E6E2", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                <td className="px-5 py-3 font-medium" style={{ color: "#17211D" }}>
                  {u.full_name || "—"}
                  {u.isSelf && <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#E4F0EC", color: "#0E6B5C" }}>Vous</span>}
                </td>
                <td className="px-5 py-3 font-mono text-xs" style={{ color: "#66716B" }}>{u.email}</td>
                <td className="px-5 py-3"><span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: r.bg, color: r.fg }}>{r.label}</span></td>
                <td className="px-5 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: u.active ? "#E4F0EC" : "#F6E7E5", color: u.active ? "#0E6B5C" : "#A3342C" }}>
                    {u.active ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/admin/utilisateurs/${u.id}/editer`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium hover:bg-gray-50" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
                      <Settings size={13} /> Modifier
                    </Link>
                    {u.canDelete && !u.isSelf && <DeleteButton user={u} />}
                  </div>
                </td>
              </tr>
            )
          })}
          {!filtered.length && (
            <tr><td colSpan={5} className="px-5 py-10 text-center text-sm" style={{ color: "#66716B" }}>Aucun utilisateur trouvé</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
