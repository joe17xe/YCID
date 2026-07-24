export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { isUserAdmin } from "@/lib/permissions"
import UserForm from "@/components/admin/UserForm"

export default async function EditerUtilisateurPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")
  if (!(await isUserAdmin(supabase, user.id))) redirect("/dashboard")

  const [{ data: me }, { data: target }] = await Promise.all([
    supabase.from("profiles").select("platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email, platform_role, is_platform_admin, active").eq("id", id).maybeSingle(),
  ])
  if (!target) notFound()

  const myRole = me?.platform_role ?? "admin"
  const targetRole = target.platform_role ?? (target.is_platform_admin ? "admin" : "user")
  // Un YCID ne peut pas éditer un Administrateur
  if (myRole === "ycid" && targetRole === "admin") redirect("/admin/utilisateurs")

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/admin/utilisateurs" className="inline-flex items-center gap-1 text-sm mb-6" style={{ color: "#66716B" }}>
        <ChevronLeft size={16} /> Retour à la liste
      </Link>
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Modifier l&apos;utilisateur</h1>
      <UserForm
        canCreateAdmin={myRole === "admin"}
        user={{
          id: target.id,
          full_name: target.full_name ?? "",
          email: target.email ?? "",
          platform_role: targetRole,
          active: target.active !== false,
        }}
      />
    </div>
  )
}
