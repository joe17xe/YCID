export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { isUserAdmin } from "@/lib/permissions"
import UserForm from "@/components/admin/UserForm"

export default async function CreerUtilisateurPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")
  if (!(await isUserAdmin(supabase, user.id))) redirect("/dashboard")

  const { data: me } = await supabase.from("profiles").select("platform_role").eq("id", user.id).maybeSingle()
  const canCreateAdmin = (me?.platform_role ?? "admin") === "admin"

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/admin/utilisateurs" className="inline-flex items-center gap-1 text-sm mb-6" style={{ color: "#66716B" }}>
        <ChevronLeft size={16} /> Retour à la liste
      </Link>
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Nouvel utilisateur</h1>
      <UserForm canCreateAdmin={canCreateAdmin} />
    </div>
  )
}
