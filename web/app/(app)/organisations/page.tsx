export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ORG_TYPES } from "@/lib/constants"
import { Plus } from "lucide-react"

export default async function OrganisationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const { data: orgs } = await supabase
    .from("organizations")
    .select("*")
    .order("name")

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Organisations</h1>
          <p className="mt-1 text-sm" style={{ color: "#66716B" }}>{(orgs ?? []).length} organisation{(orgs ?? []).length !== 1 ? "s" : ""}</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
          style={{ background: "#0E6B5C" }}
        >
          <Plus size={16} /> Nouvelle organisation
        </button>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
              {["Nom", "Type", "Pays", "Email", "Statut"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(orgs ?? []).map((org: any, i: number) => (
              <tr key={org.id} style={{ borderBottom: "1px solid #E3E6E2", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                <td className="px-5 py-3 font-medium" style={{ color: "#17211D" }}>{org.name}</td>
                <td className="px-5 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#E8ECF5", color: "#3B5488" }}>
                    {ORG_TYPES[org.type] ?? org.type}
                  </span>
                </td>
                <td className="px-5 py-3" style={{ color: "#66716B" }}>{org.country}</td>
                <td className="px-5 py-3" style={{ color: "#66716B" }}>{org.email ?? "—"}</td>
                <td className="px-5 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{
                    background: org.status === "active" ? "#E4F0EC" : "#EEF0EE",
                    color: org.status === "active" ? "#0E6B5C" : "#66716B",
                  }}>
                    {org.status === "active" ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!(orgs ?? []).length && (
          <div className="p-12 text-center text-sm" style={{ color: "#66716B" }}>Aucune organisation</div>
        )}
      </div>
    </div>
  )
}
