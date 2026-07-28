export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { PROJECT_STATUS, TASK_STATUS, fmtDate } from "@/lib/constants"
import { AlertTriangle, CalendarClock } from "lucide-react"
import { StatTile, AlertStatTile } from "@/components/ui/StatTile"
import InterventionMap, { type MapCity } from "@/components/pilotage/InterventionMap"

const PERIODS: Record<string, { label: string; days: number | null }> = {
  semaine: { label: "Semaine", days: 7 },
  mois: { label: "Mois", days: 30 },
  trimestre: { label: "Trimestre", days: 92 },
  tout: { label: "Tout", days: null },
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const { periode = "mois" } = await searchParams
  const period = PERIODS[periode] ?? PERIODS.mois

  const [{ data: projects, error: projectsError }, { data: profile }, { data: openDecisions }, citiesRes, linksRes] = await Promise.all([
    supabase
      .from("projects")
      .select("*, project_organizations(org_id, role, organizations(name)), phases(id, name, status, tasks(id, status, progress, end_date, title))")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("decisions").select("id, due_date").neq("status", "fait"),
    // Carte des villes (0050). Requêtes TOLÉRANTES : tant que la
    // migration n'est pas passée elles échouent, et la carte retombe
    // sur le mode « un repère par projet » (lat/lng du lot 3).
    supabase.from("cities").select("id, name, country, lat, lng"),
    supabase.from("project_cities").select("project_id, city_id"),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const horizon = period.days
    ? new Date(Date.now() + period.days * 86400000).toISOString().slice(0, 10)
    : null

  const allTasks = (projects ?? []).flatMap((p: any) =>
    (p.phases ?? []).flatMap((ph: any) => (ph.tasks ?? []).map((t: any) => ({ ...t, projectName: p.name, projectId: p.id })))
  )
  const lateTasks = allTasks.filter((t: any) => t.end_date && t.end_date < today && t.status !== "terminee")
  const dueSoon = allTasks.filter((t: any) =>
    t.status !== "terminee" && t.end_date && t.end_date >= today && (!horizon || t.end_date <= horizon)
  )
  const upcomingTasks = [...dueSoon]
    .sort((a: any, b: any) => a.end_date.localeCompare(b.end_date))
    .slice(0, 5)
  const lateDecisions = (openDecisions ?? []).filter((d: any) => d.due_date && d.due_date < today)

  // Repères de la carte (0050) : chaque ville porte le nombre TOTAL de
  // projets qui l'impliquent (le lien project_cities est lisible par
  // tous — des identifiants opaques) et la liste des projets que MES
  // policies me laissent voir. La différence s'affiche « sans accès »,
  // jamais nommée — visualiser sans accéder.
  let mapCities: MapCity[] | null = null
  let unlinkedCount = 0
  let cityPairs: { a: string; b: string }[] = []
  if (!citiesRes.error && !linksRes.error) {
    const visibleName = new Map<string, string>((projects ?? []).map((p: { id: string; name: string }) => [p.id, p.name]))
    const byCity = new Map<string, { total: number; accessible: { id: string; name: string }[] }>()
    for (const l of linksRes.data ?? []) {
      const entry = byCity.get(l.city_id) ?? { total: 0, accessible: [] }
      entry.total++
      const name = visibleName.get(l.project_id)
      if (name) entry.accessible.push({ id: l.project_id, name })
      byCity.set(l.city_id, entry)
    }
    mapCities = (citiesRes.data ?? []).map(c => {
      const entry = byCity.get(c.id) ?? { total: 0, accessible: [] }
      return {
        id: c.id, name: c.name, country: c.country ?? null,
        lat: Number(c.lat), lng: Number(c.lng),
        total: entry.total,
        accessible: [...entry.accessible].sort((a, b) => a.name.localeCompare(b.name, "fr")),
      }
    })
    const linked = new Set((linksRes.data ?? []).map(l => l.project_id))
    unlinkedCount = (projects ?? []).filter((p: { id: string }) => !linked.has(p.id)).length

    // Paires de villes reliées par un même projet — les traits
    // pointillés de la carte. Dédupliquées (deux triades sur le même
    // couple = un seul trait) et anonymes : la paire ne dit jamais
    // QUEL projet relie, seulement qu'un lien existe.
    const byProject = new Map<string, string[]>()
    for (const l of linksRes.data ?? []) {
      byProject.set(l.project_id, [...(byProject.get(l.project_id) ?? []), l.city_id])
    }
    const pairKeys = new Set<string>()
    for (const ids of byProject.values()) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          pairKeys.add([ids[i], ids[j]].sort().join("|"))
        }
      }
    }
    cityPairs = [...pairKeys].map(k => {
      const [a, b] = k.split("|")
      return { a, b }
    })
  }

  function projectProgress(p: any): number {
    const tasks = (p.phases ?? []).flatMap((ph: any) => ph.tasks ?? [])
    if (!tasks.length) return 0
    return Math.round(tasks.reduce((s: number, t: any) => s + (t.progress ?? 0), 0) / tasks.length)
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>
          Bonjour{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#66716B" }}>Tableau de bord — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      {projectsError && (
        <div className="mb-6 rounded-xl px-4 py-3 text-sm" style={{ background: "#F6E7E5", color: "#A3342C" }}>
          Impossible de charger les projets : {projectsError.message}
        </div>
      )}

      {/* Sélecteur de période */}
      <div className="flex items-center gap-1 mb-6 bg-white rounded-2xl border p-1 w-fit" style={{ borderColor: "#E3E6E2" }}>
        {Object.entries(PERIODS).map(([key, p]) => (
          <Link
            key={key}
            href={`/dashboard?periode=${key}`}
            className="px-4 py-1.5 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: (periode === key || (!PERIODS[periode] && key === "mois")) ? "var(--brand-accent,#0E6B5C)" : "transparent",
              color: (periode === key || (!PERIODS[periode] && key === "mois")) ? "#fff" : "#66716B",
            }}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* KPI cards */}
      {/* Même anatomie de tuile que le pouls d'un projet (StatTile) :
          un chiffre se lit pareil partout. Un écran de veille garde sa
          grille STABLE — les alertes à zéro ne disparaissent pas, elles
          s'éteignent en tuile neutre : la place reste, la couleur ne
          crie que quand il y a quelque chose à crier. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-8">
        <StatTile label="Projets actifs" mark="var(--brand-accent,#0E6B5C)"
          value={(projects ?? []).filter((p: any) => p.status === "en_cours").length} />
        <StatTile label="Tâches en cours" mark="#3B5488"
          value={allTasks.filter((t: any) => t.status === "en_cours").length} />
        {lateTasks.length > 0
          ? <AlertStatTile tone="danger" icon={<AlertTriangle size={13} aria-hidden="true" />}
              label="Tâches en retard" value={lateTasks.length} sub="échéance dépassée" />
          : <StatTile label="Tâches en retard" mark="#9AA39D" value={0} sub="rien ne glisse" />}
        {dueSoon.length > 0
          ? <AlertStatTile tone="warning" icon={<CalendarClock size={13} aria-hidden="true" />}
              label={`Échéances (${period.label.toLowerCase()})`} value={dueSoon.length} sub="à tenir sur la période" />
          : <StatTile label={`Échéances (${period.label.toLowerCase()})`} mark="#9AA39D" value={0} />}
        {lateDecisions.length > 0
          ? <AlertStatTile tone="danger" icon={<AlertTriangle size={13} aria-hidden="true" />}
              label="Décisions en retard" value={lateDecisions.length} sub="COPIL à relancer" />
          : <StatTile label="Décisions en retard" mark="#9AA39D" value={0} />}
      </div>

      {/* Carte des interventions : un repère par VILLE (0050) — le
          travail est entre des villes, une triade apparaît sur les
          deux panneaux. Cliquer une ville liste les projets
          accessibles ; les autres sont comptés, jamais nommés. Avant
          la migration : repli sur un repère par projet (lat/lng). */}
      <div className="mb-8">
        <InterventionMap
          projects={(projects ?? []).map(p => ({
            id: p.id, name: p.name, country: p.country ?? null,
            lat: p.lat ?? null, lng: p.lng ?? null,
          }))}
          cities={mapCities}
          unlinkedCount={unlinkedCount}
          cityPairs={cityPairs}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Projets */}
        <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Projets</h2>
            <Link href="/projets" className="text-sm" style={{ color: "var(--brand-accent,#0E6B5C)" }}>Voir tout →</Link>
          </div>
          <div className="space-y-3">
            {(projects ?? []).slice(0, 4).map((p: any) => {
              const s = PROJECT_STATUS[p.status] ?? { label: p.status, fg: "#66716B", bg: "#EEF0EE" }
              const prog = projectProgress(p)
              return (
                <Link key={p.id} href={`/projets/${p.id}`} className="block rounded-xl p-3 hover:bg-gray-50 transition-colors border" style={{ borderColor: "#E3E6E2" }}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium" style={{ color: "#17211D", fontFamily: "var(--font-inter)" }}>{p.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#E3E6E2" }}>
                    <div className="h-full rounded-full" style={{ width: `${prog}%`, background: "var(--brand-accent,#0E6B5C)" }} />
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "#66716B" }}>{prog}% d&apos;avancement</div>
                </Link>
              )
            })}
            {!(projects ?? []).length && <p className="text-sm text-center py-4" style={{ color: "#66716B" }}>Aucun projet</p>}
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
            <h2 className="font-semibold mb-3" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Échéances — {period.label.toLowerCase() === "tout" ? "toutes" : period.label.toLowerCase()}</h2>
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
