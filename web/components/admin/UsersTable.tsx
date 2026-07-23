"use client"
import { useState } from "react"
import { Search } from "lucide-react"

export interface AdminUserRow {
  id: string
  email: string
  full_name: string
  is_platform_admin: boolean
  created_at: string
  orgs: { name: string; role: string }[]
}

export default function UsersTable({ users, currentUserId }: { users: AdminUserRow[]; currentUserId: string }) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const filtered = q
    ? users.filter(u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : users

  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
      <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: "#E3E6E2" }}>
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#66716B" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher par nom ou email…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            style={{ borderColor: "#E3E6E2" }}
          />
        </div>
        <span className="text-sm" style={{ color: "#66716B" }}>{filtered.length} / {users.length}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
            {["Nom", "Email", "Organisations", "Rôle plateforme"].map(h => (
              <th key={h} className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((u, i) => (
            <tr key={u.id} style={{ borderBottom: "1px solid #E3E6E2", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
              <td className="px-5 py-3 font-medium" style={{ color: "#17211D" }}>
                {u.full_name || "—"}
                {u.id === currentUserId && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#E4F0EC", color: "#0E6B5C" }}>Vous</span>
                )}
              </td>
              <td className="px-5 py-3" style={{ color: "#66716B" }}>{u.email}</td>
              <td className="px-5 py-3">
                <div className="flex flex-wrap gap-1">
                  {u.orgs.map((o, j) => (
                    <span key={j} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#E8ECF5", color: "#3B5488" }}>
                      {o.name}{o.role === "admin_org" ? " · admin" : ""}
                    </span>
                  ))}
                  {!u.orgs.length && <span className="text-xs" style={{ color: "#66716B" }}>—</span>}
                </div>
              </td>
              <td className="px-5 py-3">
                {u.is_platform_admin ? (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#F0E9F5", color: "#6B4A8C" }}>Admin plateforme</span>
                ) : (
                  <span className="text-xs" style={{ color: "#66716B" }}>Utilisateur</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!filtered.length && (
        <div className="p-10 text-center text-sm" style={{ color: "#66716B" }}>Aucun utilisateur trouvé</div>
      )}
    </div>
  )
}
