export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { isUserAdmin } from "@/lib/permissions"
import { RBAC_MATRIX, ROLE_COLUMNS } from "@/lib/rbac"
import { Check } from "lucide-react"

export default async function AdminAccesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")
  if (!(await isUserAdmin(supabase, user.id))) redirect("/dashboard")

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Accès & rôles</h1>
        <p className="mt-1 text-sm" style={{ color: "#66716B" }}>
          Contrôle d&apos;accès (RBAC) : qui accède à quoi. Les droits sont appliqués en base de données (RLS Supabase) et re-vérifiés côté serveur.
        </p>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
                <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>Permission</th>
                <th className="text-center px-3 py-3 text-xs font-semibold" style={{ color: "#0E6B5C" }}>Admin YCID/LEY</th>
                {ROLE_COLUMNS.map(r => (
                  <th key={r.key} className="text-center px-3 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RBAC_MATRIX.map((p, i) => (
                <tr key={p.key} style={{ borderBottom: "1px solid #E3E6E2", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  <td className="px-5 py-3">
                    <div className="font-medium" style={{ color: "#17211D" }}>{p.label}</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: "#66716B" }}>{p.key}</div>
                    {p.note && <div className="text-xs mt-0.5" style={{ color: "#B4690E" }}>{p.note}</div>}
                  </td>
                  <td className="text-center px-3 py-3">
                    {p.admin ? <Check size={16} className="inline" style={{ color: "#0E6B5C" }} /> : <span style={{ color: "#66716B" }}>—</span>}
                  </td>
                  {ROLE_COLUMNS.map(r => (
                    <td key={r.key} className="text-center px-3 py-3">
                      {p.roles.includes(r.key)
                        ? <Check size={16} className="inline" style={{ color: "#0E6B5C" }} />
                        : <span style={{ color: "#66716B" }}>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs" style={{ color: "#66716B" }}>
        Matrice en lecture seule — les règles vivent dans les migrations SQL (`supabase/migrations/`) et dans `lib/rbac.ts`.
        Un rôle non listé ici n&apos;a aucun accès : les projets ne sont visibles que par leurs membres et les admins.
      </p>
    </div>
  )
}
