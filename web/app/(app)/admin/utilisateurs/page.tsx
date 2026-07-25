export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, Upload } from "lucide-react"
import { isUserAdmin } from "@/lib/permissions"
import UsersTable, { type AdminUserRow } from "@/components/admin/UsersTable"

export default async function AdminUtilisateursPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")
  if (!(await isUserAdmin(supabase, user.id))) redirect("/dashboard")

  const [{ data: me }, { data: profiles, error }] = await Promise.all([
    supabase.from("profiles").select("platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email, platform_role, is_platform_admin, active").order("full_name"),
  ])
  const myRole = me?.platform_role ?? "admin"

  type RawProfile = {
    id: string; full_name: string | null; email: string | null
    platform_role: string | null; is_platform_admin: boolean | null; active: boolean | null
  }
  const users: AdminUserRow[] = (profiles ?? []).map((p: RawProfile) => {
    const role = p.platform_role ?? (p.is_platform_admin ? "admin" : "user")
    // Un YCID ne peut pas supprimer un Administrateur
    const canDelete = !(myRole === "ycid" && role === "admin")
    return {
      id: p.id,
      full_name: p.full_name ?? "",
      email: p.email ?? "",
      platform_role: role,
      active: p.active !== false,
      isSelf: p.id === user.id,
      canDelete,
    }
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Utilisateurs</h1>
          <p className="mt-1 text-sm" style={{ color: "#66716B" }}>
            {users.length} compte{users.length !== 1 ? "s" : ""} · gestion réservée aux administrateurs
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/utilisateurs/import" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium" style={{ borderColor: "#E3E6E2", color: "#17211D" }}>
            <Upload size={16} /> Import en masse
          </Link>
          <Link href="/admin/utilisateurs/creer" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
            <Plus size={16} /> Nouvel utilisateur
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl px-4 py-3 text-sm" style={{ background: "#F6E7E5", color: "#A3342C" }}>
          Impossible de charger les utilisateurs : {error.message}. Vérifiez que la migration 0017 a été appliquée.
        </div>
      )}

      <UsersTable users={users} />
    </div>
  )
}
