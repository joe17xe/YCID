export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { isUserAdmin } from "@/lib/permissions"
import ProgrammesClient, { type ProgrammeRow } from "@/components/admin/ProgrammesClient"

// ============================================================
// Admin ▸ Programmes (0055)
// ============================================================
// Le niveau au-dessus des projets : d'autres programmes CEM viendront,
// sur d'autres villes, avec d'autres directeurs — chacun chez soi.
// Même dégradation douce que les villes et les réunions : tant que la
// migration n'est pas passée, l'écran le dit au lieu de casser.

export default async function ProgrammesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")
  if (!(await isUserAdmin(supabase, user.id))) redirect("/dashboard")

  const [{ data: programmes, error: pErr }, { data: dirs }, { data: projs }, { data: profiles }] = await Promise.all([
    supabase.from("programmes").select("id, name, description").order("name"),
    supabase.from("programme_directors").select("programme_id, user_id"),
    supabase.from("projects").select("id, name, programme_id").order("name"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ])

  const nameOf = new Map<string, string>((profiles ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, p.full_name ?? p.email ?? "—"]))
  const rows: ProgrammeRow[] = (programmes ?? []).map((pr: { id: string; name: string; description: string | null }) => ({
    id: pr.id,
    name: pr.name,
    description: pr.description,
    directors: (dirs ?? []).filter(d => d.programme_id === pr.id)
      .map(d => ({ id: d.user_id, name: nameOf.get(d.user_id) ?? "—" }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    projects: (projs ?? []).filter((p: { programme_id: string | null }) => p.programme_id === pr.id).map((p: { name: string }) => p.name),
  }))
  const unassigned = (projs ?? []).filter((p: { programme_id: string | null }) => !p.programme_id)

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
        Programmes
      </h1>
      <p className="text-sm mb-6" style={{ color: "#66716B" }}>
        Le niveau au-dessus des projets : chaque programme a ses projets et ses directeurs —
        un directeur a tous les droits opérationnels sur les projets de son programme, y compris futurs.
      </p>

      {pErr ? (
        <p className="text-sm rounded-xl px-4 py-3" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
          Programmes non activés : appliquez la migration <strong>0055_programmes.sql</strong> dans le SQL Editor Supabase.
        </p>
      ) : (
        <>
          <ProgrammesClient programmes={rows}
            profiles={(profiles ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => ({ id: p.id, name: p.full_name ?? p.email ?? "—" }))} />
          {unassigned.length > 0 && (
            <p className="text-xs mt-4" style={{ color: "#66716B" }}>
              Hors programme : {unassigned.map((p: { name: string }) => p.name).join(" · ")} —
              rattachement sur la fiche du projet, bouton « Modifier ».
            </p>
          )}
        </>
      )}
    </div>
  )
}
