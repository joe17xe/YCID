export const dynamic = 'force-dynamic'
import Sidebar from "@/components/layout/Sidebar"
import MobileNav from "@/components/layout/MobileNav"
import Header, { type HeaderRole } from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { isUserAdmin } from "@/lib/permissions"
import { getPlatformSettings } from "@/lib/settings"
import { ACCESS_ROLES } from "@/lib/constants"
import WelcomeTour from "@/components/onboarding/WelcomeTour"
import { buildTourSteps, type TourStep } from "@/lib/tour"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const [{ data: { user } }, settings] = await Promise.all([
    supabase.auth.getUser(),
    getPlatformSettings(),
  ])

  let showAdmin = false
  let name = ""
  let email = ""
  let avatarUrl: string | null = null
  let roles: HeaderRole[] = []
  // Visite guidée : construite UNIQUEMENT tant qu'elle n'a pas été vue —
  // le cas nominal (visite vue) ne coûte aucune requête de plus.
  let tourSteps: TourStep[] | null = null

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
    if (profile && !profile.tour_seen_at) {
      tourSteps = await buildTourSteps(supabase, user.id)
    }
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
      {/* Lien d'évitement (RGAA 12.7) : première tabulation de la page */}
      <a href="#contenu-principal" className="skip-link">Aller au contenu principal</a>
      <Sidebar showAdmin={showAdmin} brandName={settings.brandName} logoUrl={settings.logoUrl} />
      <div className="flex-1 flex flex-col overflow-auto min-w-0" style={{ background: "#F5F6F4" }}>
        <MobileNav showAdmin={showAdmin} brandName={settings.brandName} logoUrl={settings.logoUrl}
          name={name} email={email} avatarUrl={avatarUrl} />
        <Header name={name} email={email} avatarUrl={avatarUrl} roles={roles} isAdmin={showAdmin} />
        <main id="contenu-principal" tabIndex={-1} className="flex-1">{children}</main>
        {/* Première connexion : la visite s'ouvre d'elle-même, une fois,
            quelle que soit la page d'atterrissage. */}
        {user && tourSteps && <WelcomeTour userId={user.id} steps={tourSteps} mode="auto" />}
        <Footer brandName={settings.brandName} />
      </div>
    </div>
  )
}
