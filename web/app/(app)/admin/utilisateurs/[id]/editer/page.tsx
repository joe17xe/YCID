export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { canManageUsers, isUserAdmin } from "@/lib/permissions"
import UserForm from "@/components/admin/UserForm"

export default async function EditerUtilisateurPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const [mayManage, isAdmin, { data: me }, { data: target }, { data: orgs }, { data: myMemberships }] = await Promise.all([
    canManageUsers(supabase, user.id),
    isUserAdmin(supabase, user.id),
    supabase.from("profiles").select("platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email, platform_role, is_platform_admin, active, can_manage_roadmap, can_manage_users").eq("id", id).maybeSingle(),
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("memberships").select("org_id").eq("user_id", id),
  ])
  if (!mayManage) redirect("/dashboard")
  if (!target) notFound()

  const myRole = me?.platform_role ?? "admin"
  const targetRole = target.platform_role ?? (target.is_platform_admin ? "admin" : "user")
  // Un YCID ne peut pas éditer un Administrateur
  if (myRole === "ycid" && targetRole === "admin") redirect("/admin/utilisateurs")
  // Ni un porteur de la capacité « gestion des comptes » (0065). Le
  // formulaire propose un champ « mot de passe » : l'ouvrir sur un
  // compte administrateur reviendrait à proposer d'en prendre la place.
  // L'écran de liste masque déjà « Modifier » ; ceci ferme l'URL saisie
  // à la main, et l'action serveur reste le dernier mot.
  if (!isAdmin && targetRole === "admin") redirect("/admin/utilisateurs")

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <Link href="/admin/utilisateurs" className="inline-flex items-center gap-1 text-sm mb-6" style={{ color: "#66716B" }}>
        <ChevronLeft size={16} /> Retour à la liste
      </Link>
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Modifier l&apos;utilisateur</h1>
      <UserForm
        canCreateAdmin={isAdmin}
        canGrantCapabilities={isAdmin}
        user={{
          id: target.id,
          full_name: target.full_name ?? "",
          email: target.email ?? "",
          platform_role: targetRole,
          active: target.active !== false,
          can_manage_roadmap: target.can_manage_roadmap === true,
          can_manage_users: target.can_manage_users === true,
          organizationIds: (myMemberships ?? []).map((m: { org_id: string }) => m.org_id),
        }}
        organizations={(orgs ?? []) as { id: string; name: string }[]}
      />
    </div>
  )
}
