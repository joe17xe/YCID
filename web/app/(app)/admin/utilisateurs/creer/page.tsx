export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { canManageUsers, isUserAdmin } from "@/lib/permissions"
import UserForm from "@/components/admin/UserForm"

export default async function CreerUtilisateurPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")
  // La capacité « gestion des comptes » (0057) ouvre cet écran ; le
  // rôle plateforme décide de ce qu'on peut y accorder.
  const [mayManage, isAdmin] = await Promise.all([
    canManageUsers(supabase, user.id),
    isUserAdmin(supabase, user.id),
  ])
  if (!mayManage) redirect("/dashboard")

  const { data: orgs } = await supabase.from("organizations").select("id, name").order("name")

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <Link href="/admin/utilisateurs" className="inline-flex items-center gap-1 text-sm mb-6" style={{ color: "#66716B" }}>
        <ChevronLeft size={16} /> Retour à la liste
      </Link>
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Nouvel utilisateur</h1>
      <UserForm canCreateAdmin={isAdmin} canGrantCapabilities={isAdmin} organizations={(orgs ?? []) as { id: string; name: string }[]} />
    </div>
  )
}
