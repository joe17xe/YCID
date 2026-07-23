export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { isUserAdmin } from "@/lib/permissions"
import UsersTable, { type AdminUserRow } from "@/components/admin/UsersTable"
import InviteUserForm from "@/components/admin/InviteUserForm"

export default async function AdminUtilisateursPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const allowed = await isUserAdmin(supabase, user.id)
  if (!allowed) redirect("/dashboard")

  // Schéma réel : profiles porte org_id + is_org_admin (pas de table memberships,
  // pas de is_platform_admin). L'organisation est résolue via profiles.org_id.
  const [{ data: profiles, error: profilesError }, { data: orgsAll }] = await Promise.all([
    supabase.from("profiles").select("id, email, name, org_id, is_org_admin"),
    supabase.from("organizations").select("id, name"),
  ])

  const orgMap = new Map((orgsAll ?? []).map((o: any) => [o.id, o.name]))
  const users: AdminUserRow[] = (profiles ?? [])
    .map((p: any) => ({
      id: p.id,
      email: p.email ?? "",
      full_name: p.name ?? "",
      is_platform_admin: false,
      created_at: "",
      orgs: p.org_id && orgMap.get(p.org_id)
        ? [{ name: String(orgMap.get(p.org_id)), role: p.is_org_admin ? "admin_org" : "membre" }]
        : [],
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "fr"))

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Utilisateurs</h1>
        <p className="mt-1 text-sm" style={{ color: "#66716B" }}>
          {users.length} compte{users.length !== 1 ? "s" : ""} · accès sur invitation, réservé aux administrateurs YCID / LEY
        </p>
      </div>

      {profilesError && (
        <div className="mb-6 rounded-xl px-4 py-3 text-sm" style={{ background: "#F6E7E5", color: "#A3342C" }}>
          Impossible de charger les utilisateurs : {profilesError.message}.
          Vérifiez que la migration 0007_admin_users.sql a été appliquée.
        </div>
      )}

      <div className="space-y-6">
        <InviteUserForm />
        <UsersTable users={users} currentUserId={user.id} />
      </div>
    </div>
  )
}
