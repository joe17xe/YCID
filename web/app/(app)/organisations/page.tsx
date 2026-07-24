export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ORG_TYPES } from "@/lib/constants"
import { isUserAdmin } from "@/lib/permissions"
import { OrgDialog, DeleteOrgButton, CreateUserButton, type OrgData } from "@/components/org/OrgDialogs"

export default async function OrganisationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const [{ data: orgs }, canManage] = await Promise.all([
    supabase.from("organizations").select("*").order("name"),
    isUserAdmin(supabase, user.id),
  ])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Organisations</h1>
          <p className="mt-1 text-sm" style={{ color: "#66716B" }}>{(orgs ?? []).length} organisation{(orgs ?? []).length !== 1 ? "s" : ""}</p>
        </div>
        {canManage && <OrgDialog />}
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
              {["Nom", "Type", "Pays", "Email", "Statut"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>{h}</th>
              ))}
              {canManage && <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {(orgs ?? []).map((org: any, i: number) => {
              const data: OrgData = { id: org.id, name: org.name, type: org.type, country: org.country, email: org.email ?? null, status: org.status }
              return (
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
                  {canManage && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {org.email && <CreateUserButton email={org.email} orgName={org.name} />}
                        <OrgDialog org={data} />
                        <DeleteOrgButton org={data} />
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {!(orgs ?? []).length && (
          <div className="p-12 text-center text-sm" style={{ color: "#66716B" }}>Aucune organisation</div>
        )}
      </div>

      {canManage && (
        <p className="mt-3 text-xs" style={{ color: "#66716B" }}>
          L&apos;icône <span style={{ color: "#0E6B5C" }}>＋ personne</span> crée un compte utilisateur à partir de l&apos;email de l&apos;organisation (mot de passe temporaire affiché, sans email d&apos;invitation).
        </p>
      )}
    </div>
  )
}
