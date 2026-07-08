export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PROJECT_STATUS, fmtEur } from "@/lib/constants"
import Link from "next/link"

export default async function PilotagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const [{ data: projects }, { data: decisions }] = await Promise.all([
    supabase.from("projects").select("*, phases(tasks(id, progress, status, end_date)), budget_lines(planned_amount, is_valorisation)").order("name"),
    supabase.from("decisions").select("*, project:project_id(name), owner:owner_user_id(full_name)").neq("status", "fait").order("due_date"),
  ])

  function progress(p: any): number {
    const tasks = (p.phases ?? []).flatMap((ph: any) => ph.tasks ?? [])
    if (!tasks.length) return 0
    return Math.round(tasks.reduce((s: number, t: any) => s + t.progress, 0) / tasks.length)
  }

  const today = new Date().toISOString().slice(0, 10)
  const overdueDecisions = (decisions ?? []).filter((d: any) => d.due_date && d.due_date < today)
  const totalBudget = (projects ?? []).reduce((s: number, p: any) => s + (p.budget ?? 0), 0)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Pilotage — Portefeuille</h1>
        <p className="mt-1 text-sm" style={{ color: "#66716B" }}>{(projects ?? []).length} projets · {(projects ?? []).filter((p: any) => p.status === "en_cours").length} en cours</p>
      </div>

      {/* KPI globaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Budget total portefeuille", value: fmtEur(totalBudget), color: "#0E6B5C", bg: "#E4F0EC" },
          { label: "Projets en cours", value: (projects ?? []).filter((p: any) => p.status === "en_cours").length, color: "#3B5488", bg: "#E8ECF5" },
          { label: "Décisions ouvertes", value: (decisions ?? []).length, color: "#B4690E", bg: "#F7EDDD" },
          { label: "Décisions en retard", value: overdueDecisions.length, color: "#A3342C", bg: "#F6E7E5" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border p-5" style={{ borderColor: "#E3E6E2" }}>
            <div className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-sora)", color }}>{value}</div>
            <div className="text-xs" style={{ color: "#66716B" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tableau projets */}
      <div className="bg-white rounded-2xl border overflow-hidden mb-6" style={{ borderColor: "#E3E6E2" }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: "#E3E6E2" }}>
          <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Projets</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
              {["Projet", "Statut", "Avancement", "Budget", "Tâches en retard"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(projects ?? []).map((p: any) => {
              const s = PROJECT_STATUS[p.status] ?? { label: p.status, fg: "#66716B", bg: "#EEF0EE" }
              const prog = progress(p)
              const allTasks = (p.phases ?? []).flatMap((ph: any) => ph.tasks ?? [])
              const lateTasks = allTasks.filter((t: any) => t.end_date && t.end_date < today && t.status !== "terminee")
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #E3E6E2" }}>
                  <td className="px-5 py-3">
                    <Link href={`/projets/${p.id}`} className="font-medium hover:underline" style={{ color: "#0E6B5C" }}>{p.name}</Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
                  </td>
                  <td className="px-5 py-3 w-40">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#E3E6E2" }}>
                        <div className="h-full rounded-full" style={{ width: `${prog}%`, background: "#0E6B5C" }} />
                      </div>
                      <span className="text-xs w-8" style={{ color: "#66716B" }}>{prog}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3" style={{ color: "#17211D" }}>{fmtEur(p.budget)}</td>
                  <td className="px-5 py-3">
                    {lateTasks.length > 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#F6E7E5", color: "#A3342C" }}>
                        {lateTasks.length} en retard
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "#66716B" }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Décisions ouvertes */}
      {(decisions ?? []).length > 0 && (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
          <div className="px-6 py-4 border-b" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Décisions ouvertes ({decisions?.length})</h2>
          </div>
          <div className="divide-y" style={{ borderColor: "#E3E6E2" }}>
            {(decisions ?? []).slice(0, 10).map((d: any) => {
              const isLate = d.due_date && d.due_date < today
              return (
                <div key={d.id} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "#17211D" }}>{d.text}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#66716B" }}>
                      {d.project?.name} · {d.owner?.full_name ?? "Sans responsable"}
                    </div>
                  </div>
                  {d.due_date && (
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{
                      background: isLate ? "#F6E7E5" : "#EEF0EE",
                      color: isLate ? "#A3342C" : "#66716B"
                    }}>
                      {isLate ? "⚠ " : ""}Échéance {new Date(d.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
