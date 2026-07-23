export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { PROJECT_STATUS, TASK_STATUS, fmtDate } from "@/lib/constants"
import { getProjectsOverview, avgProgress } from "@/lib/data"
import { getCurrentProfile } from "@/lib/permissions"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const [{ projects, error: projectsError }, profile] = await Promise.all([
    getProjectsOverview(supabase),
    getCurrentProfile(supabase, user.id),
  ])

  const allTasks = projects.flatMap((p) =>
    p.phases.flatMap((ph) => ph.tasks.map((t) => ({ ...t, projectName: p.name, projectId: p.id })))
  )
  const today = new Date().toISOString().slice(0, 10)
  const lateTasks = allTasks.filter((t) => t.end_date && t.end_date < today && t.status !== "terminee")
  const upcomingTasks = allTasks
    .filter((t) => t.status !== "terminee" && t.end_date)
    .sort((a, b) => String(a.end_date).localeCompare(String(b.end_date)))
    .slice(0, 5)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
          Bonjour{profile?.name ? `, ${String(profile.name).split(" ")[0]}` : ""} 👋
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#66716B" }}>Tableau de bord — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      {projectsError && (
        <div className="mb-6 rounded-xl px-4 py-3 text-sm" style={{ background: "#F6E7E5", color: "#A3342C" }}>
          Impossible de charger les projets : {projectsError}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Projets actifs", value: projects.filter((p) => p.status === "en_cours").length, color: "#0E6B5C", bg: "#E4F0EC" },
          { label: "Tâches en cours", value: allTasks.filter((t) => t.status === "en_cours").length, color: "#3B5488", bg: "#E8ECF5" },
          { label: "Tâches en retard", value: lateTasks.length, color: "#A3342C", bg: "#F6E7E5" },
          { label: "Tâches terminées", value: allTasks.filter((t) => t.status === "terminee").length, color: "#66716B", bg: "#EEF0EE" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border" style={{ borderColor: "#E3E6E2" }}>
            <div className="text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-sora)", color }}>{value}</div>
            <div className="text-sm" style={{ color: "#66716B", fontFamily: "var(--font-inter)" }}>{label}</div>
            <div className="mt-2 h-1 rounded-full" style={{ background: bg }} />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Projets */}
        <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Projets</h2>
            <Link href="/projets" className="text-sm" style={{ color: "#0E6B5C" }}>Voir tout →</Link>
          </div>
          <div className="space-y-3">
            {projects.slice(0, 4).map((p) => {
              const s = PROJECT_STATUS[p.status] ?? { label: p.status, fg: "#66716B", bg: "#EEF0EE" }
              const prog = avgProgress(p.phases.flatMap((ph) => ph.tasks))
              return (
                <Link key={p.id} href={`/projets/${p.id}`} className="block rounded-xl p-3 hover:bg-gray-50 transition-colors border" style={{ borderColor: "#E3E6E2" }}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium" style={{ color: "#17211D", fontFamily: "var(--font-inter)" }}>{p.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#E3E6E2" }}>
                    <div className="h-full rounded-full" style={{ width: `${prog}%`, background: "#0E6B5C" }} />
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "#66716B" }}>{prog}% d&apos;avancement</div>
                </Link>
              )
            })}
            {!projects.length && <p className="text-sm text-center py-4" style={{ color: "#66716B" }}>Aucun projet</p>}
          </div>
        </div>

        {/* Tâches */}
        <div className="space-y-6">
          {lateTasks.length > 0 && (
            <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
              <h2 className="font-semibold mb-3" style={{ fontFamily: "var(--font-sora)", color: "#A3342C" }}>
                ⚠ {lateTasks.length} tâche{lateTasks.length > 1 ? "s" : ""} en retard
              </h2>
              <div className="space-y-2">
                {lateTasks.slice(0, 4).map((t: any) => (
                  <div key={t.id} className="text-sm rounded-lg px-3 py-2" style={{ background: "#F6E7E5" }}>
                    <div className="font-medium" style={{ color: "#A3342C" }}>{t.title}</div>
                    <div style={{ color: "#66716B" }}>{t.projectName} · échéance {fmtDate(t.end_date)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold mb-3" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Prochaines échéances</h2>
            <div className="space-y-2">
              {upcomingTasks.map((t: any) => {
                const s = TASK_STATUS[t.status] ?? { label: t.status, fg: "#66716B", bg: "#EEF0EE" }
                return (
                  <div key={t.id} className="flex items-center justify-between text-sm border-b pb-2" style={{ borderColor: "#E3E6E2" }}>
                    <div>
                      <div className="font-medium" style={{ color: "#17211D", fontFamily: "var(--font-inter)" }}>{t.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#66716B" }}>{t.projectName}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
                      <span className="text-xs" style={{ color: "#66716B" }}>{fmtDate(t.end_date)}</span>
                    </div>
                  </div>
                )
              })}
              {!upcomingTasks.length && <p className="text-sm text-center py-2" style={{ color: "#66716B" }}>Aucune tâche à venir</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
