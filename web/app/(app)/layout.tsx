export const dynamic = 'force-dynamic'
import Sidebar from "@/components/layout/Sidebar"
import MobileNav from "@/components/layout/MobileNav"
import Header, { type HeaderRole } from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { canManageUsers, isUserAdmin } from "@/lib/permissions"
import { adminNavKeysFor, type AdminNavKey } from "@/lib/admin-nav"
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

  // Deux réponses distinctes, et c'est le changement de la 0065 :
  //   · `isAdmin` — administre-t-on l'outil ? Sert au badge du Header ;
  //   · `adminNav` — QUELLES entrées d'administration s'affichent. Un
  //     porteur de la capacité « gestion des comptes » n'en voit qu'une.
  // Le bloc entier était jusqu'ici commandé par un seul booléen : lui
  // ouvrir aurait donné Configuration, Stockage et Accès & rôles, dont
  // les pages le renverraient au tableau de bord — trois boutons morts.
  let isAdmin = false
  let adminNav: AdminNavKey[] = []
  let name = ""
  let email = ""
  let avatarUrl: string | null = null
  let roles: HeaderRole[] = []
  // Visite guidée : construite UNIQUEMENT tant qu'elle n'a pas été vue —
  // le cas nominal (visite vue) ne coûte aucune requête de plus.
  let tourSteps: TourStep[] | null = null

  if (user) {
    const [{ data: profile }, { data: memberRoles }, admin, manageUsers] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("project_members").select("role, projects:project_id(name)").eq("user_id", user.id),
      isUserAdmin(supabase, user.id),
      canManageUsers(supabase, user.id),
    ])
    // Un compte désactivé ne peut plus utiliser l'application
    if (profile && profile.active === false) {
      await supabase.auth.signOut()
      redirect("/?error=compte_desactive")
    }
    isAdmin = admin
    adminNav = adminNavKeysFor({ isAdmin: admin, canManageUsers: manageUsers })
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
      <Sidebar adminNav={adminNav} brandName={settings.brandName} logoUrl={settings.logoUrl} />
      <div className="flex-1 flex flex-col overflow-auto min-w-0" style={{ background: "#F5F6F4" }}>
        <MobileNav adminNav={adminNav} brandName={settings.brandName} logoUrl={settings.logoUrl}
          name={name} email={email} avatarUrl={avatarUrl} />
        {/* Le badge « Admin YCID/LEY » du menu de compte reste réservé
            au rôle plateforme : porter la capacité ne fait pas de
            quelqu'un un administrateur, et l'annoncer serait faux. */}
        <Header name={name} email={email} avatarUrl={avatarUrl} roles={roles} isAdmin={isAdmin} />
        <main id="contenu-principal" tabIndex={-1} className="flex-1">{children}</main>
        {/* Première connexion : la visite s'ouvre d'elle-même, une fois,
            quelle que soit la page d'atterrissage. */}
        {user && tourSteps && <WelcomeTour userId={user.id} steps={tourSteps} mode="auto" />}
        <Footer brandName={settings.brandName} />
      </div>
    </div>
  )
}
