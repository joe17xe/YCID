export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { canManageUsers, isUserAdmin } from "@/lib/permissions"
import BulkImportForm from "@/components/admin/BulkImportForm"

export default async function ImportUtilisateursPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")
  const [mayManage, isAdmin] = await Promise.all([
    canManageUsers(supabase, user.id),
    isUserAdmin(supabase, user.id),
  ])
  if (!mayManage) redirect("/dashboard")

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <Link href="/admin/utilisateurs" className="inline-flex items-center gap-1 text-sm mb-6" style={{ color: "#66716B" }}>
        <ChevronLeft size={16} /> Retour à la liste
      </Link>
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
        Import d&apos;utilisateurs
      </h1>
      <p className="text-sm mb-6" style={{ color: "#66716B" }}>
        Collez une liste d&apos;adresses — en-tête de courriel, liste de diffusion, tableau.
        Les adresses sont extraites automatiquement, quels que soient les séparateurs.
      </p>
      <BulkImportForm canCreateAdmin={isAdmin} />
    </div>
  )
}
