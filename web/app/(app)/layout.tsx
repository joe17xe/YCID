export const dynamic = 'force-dynamic'
import Sidebar from "@/components/layout/Sidebar"
import Header, { type HeaderRole } from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { isUserAdmin } from "@/lib/permissions"
import { ACCESS_ROLES } from "@/lib/constants"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let showAdmin = false
  let name = ""
  let email = ""
  let avatarUrl: string | null = null
  let roles: HeaderRole[] = []

  if (user) {
    const [{ data: profile }, { data: memberRoles }, admin] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("project_members").select("role, projects:project_id(name)").eq("user_id", user.id),
      isUserAdmin(supabase, user.id),
    ])
    // Un compte désactivé ne peut plus utiliser l'application
    if (profile && profile.active === false) {
      await supabase.auth.signOut()
      redirect("/?error=compte_desactive")
    }
    showAdmin = admin
    name = profile?.full_name ?? ""
    email = profile?.email ?? user.email ?? ""
    avatarUrl = profile?.avatar_url ?? null
    roles = (memberRoles ?? []).map((m: { role: string; projects: { name: string } | { name: string }[] | null }) => {
      const project = Array.isArray(m.projects) ? m.projects[0] : m.projects
      return {
        label: ACCESS_ROLES[m.role]?.short ?? m.role,
        project: String(project?.name ?? ""),
      }
    })
  }

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar showAdmin={showAdmin} />
      <div className="flex-1 flex flex-col overflow-auto" style={{ background: "#F5F6F4" }}>
        <Header name={name} email={email} avatarUrl={avatarUrl} roles={roles} isAdmin={showAdmin} />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </div>
  )
}
