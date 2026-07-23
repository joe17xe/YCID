export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { PROJECT_STATUS, fmtEur, fmtDate } from "@/lib/constants"
import { Plus } from "lucide-react"

export default async function ProjetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const { data: projects } = await supabase
    .from("projects")
    .select("*, project_organizations(org_id, role, organizations(name, type)), phases(id, tasks(id, progress, status))")
    .order("created_at", { ascending: false })

  function progress(p: any): number {
    const tasks = (p.phases ?? []).flatMap((ph: any) => ph.tasks ?? [])
    if (!tasks.length) return 0
    return Math.round(tasks.reduce((s: number, t: any) => s + (t.progress ?? 0), 0) / tasks.length)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Projets</h1>
          <p className="mt-1 text-sm" style={{ color: "#66716B" }}>{(projects ?? []).length} projet{(projects ?? []).length !== 1 ? "s" : ""}</p>
        </div>
        <span
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-not-allowed"
          style={{ background: "#EEF0EE", color: "#66716B", fontFamily: "var(--font-sora)" }}
          title="Création de projet en cours de développement"
        >
          <Plus size={16} /> Nouveau projet
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#E8ECF5", color: "#3B5488" }}>Bientôt</span>
        </span>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(projects ?? []).map((p: any) => {
          const s = PROJECT_STATUS[p.status] ?? { label: p.status, fg: "#66716B", bg: "#EEF0EE" }
          const prog = progress(p)
          const porteur = (p.project_organizations ?? []).find((o: any) => o.role === "porteur")
          const taskCount = (p.phases ?? []).flatMap((ph: any) => ph.tasks ?? []).length
          return (
            <Link
              key={p.id}
              href={`/projets/${p.id}`}
              className="block bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow"
              style={{ borderColor: "#E3E6E2" }}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold leading-snug" style={{ color: "#17211D", fontFamily: "var(--font-sora)" }}>{p.name}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
              </div>

              {p.description && (
                <p className="text-xs mb-3 line-clamp-2" style={{ color: "#66716B", fontFamily: "var(--font-inter)" }}>{p.description}</p>
              )}

              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1" style={{ color: "#66716B" }}>
                  <span>Avancement global</span>
                  <span className="font-medium">{prog}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#E3E6E2" }}>
                  <div className="h-full rounded-full" style={{ width: `${prog}%`, background: "#0E6B5C" }} />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs" style={{ color: "#66716B", fontFamily: "var(--font-inter)" }}>
                <div className="flex items-center gap-3">
                  {p.country && <span>📍 {p.country}</span>}
                  {taskCount > 0 && <span>{taskCount} tâche{taskCount > 1 ? "s" : ""}</span>}
                </div>
                {p.budget && <span className="font-medium">{fmtEur(p.budget)}</span>}
              </div>

              {porteur?.organizations && (
                <div className="mt-2 pt-2 border-t text-xs" style={{ borderColor: "#E3E6E2", color: "#0E6B5C" }}>
                  Porteur : {porteur.organizations.name}
                </div>
              )}

              {(p.end_date) && (
                <div className="mt-1 text-xs" style={{ color: "#66716B" }}>Fin prévue : {fmtDate(p.end_date)}</div>
              )}
            </Link>
          )
        })}
        {!(projects ?? []).length && (
          <div className="col-span-3 text-center py-16" style={{ color: "#66716B" }}>
            <p className="text-lg font-medium mb-2" style={{ fontFamily: "var(--font-sora)" }}>Aucun projet</p>
            <p className="text-sm">Créez votre premier projet pour commencer.</p>
          </div>
        )}
      </div>
    </div>
  )
}
