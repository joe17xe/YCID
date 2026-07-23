export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { canCreateProjects } from "@/lib/permissions"
import NewProjectForm from "@/components/projects/NewProjectForm"

export default async function NouveauProjetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")
  if (!(await canCreateProjects(supabase, user.id))) redirect("/projets")

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("status", "active")
    .order("name")

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/projets" className="inline-flex items-center gap-1 text-sm mb-6" style={{ color: "#66716B" }}>
        <ChevronLeft size={16} /> Projets
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Nouveau projet</h1>
        <p className="mt-1 text-sm" style={{ color: "#66716B" }}>
          Vous serez enregistré comme chef de projet ; l&apos;organisation porteuse sera rattachée automatiquement.
        </p>
      </div>
      <NewProjectForm orgs={(orgs ?? []).map(o => ({ id: o.id, name: o.name }))} />
    </div>
  )
}
