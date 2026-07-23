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

  const [{ data: profiles, error: profilesError }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, is_platform_admin, created_at").order("full_name"),
    supabase.from("memberships").select("user_id, role, organizations:org_id(name)"),
  ])

  const orgsByUser = new Map<string, { name: string; role: string }[]>()
  for (const m of memberships ?? []) {
    const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations
    if (!org?.name) continue
    const list = orgsByUser.get(m.user_id) ?? []
    list.push({ name: String(org.name), role: String(m.role) })
    orgsByUser.set(m.user_id, list)
  }
  const users: AdminUserRow[] = (profiles ?? []).map(p => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name ?? "",
    is_platform_admin: !!p.is_platform_admin,
    created_at: p.created_at,
    orgs: orgsByUser.get(p.id) ?? [],
  }))

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
