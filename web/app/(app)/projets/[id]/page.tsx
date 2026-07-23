export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { PROJECT_STATUS, PROJECT_ROLES, TASK_STATUS, REVIEW_STATES, fmtEur, fmtDate, LINE_STATUS, LINE_CATEGORIES, IND_KINDS, DECISION_STATUS, MEETING_KINDS } from "@/lib/constants"
import { canEditCompletedTasks } from "@/lib/permissions"
import EditCompletedTaskDialog from "@/components/tasks/EditCompletedTaskDialog"
import { ChevronLeft } from "lucide-react"

function Badge({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: fg, background: bg }}>{label}</span>
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#E3E6E2" }}>
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: "#0E6B5C" }} />
    </div>
  )
}

export default async function ProjetDetailPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params
  const { tab = "apercu" } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  // Schéma réel : jointures faites en JS sur les ids texte.
  const [{ data: project }, { data: rawPhases }, { data: budgetLinesRaw }, { data: indicatorsRaw }, { data: measures }, { data: meetingsRaw }, { data: decisions }, { data: audit }, { data: orgsAll }, { data: profilesAll }, { data: members }, canEditCompleted] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("phases").select("*").eq("project_id", id),
    supabase.from("budget_lines").select("*").eq("project_id", id),
    supabase.from("indicators").select("*").eq("project_id", id),
    supabase.from("indicator_measures").select("*"),
    supabase.from("meetings").select("*").eq("project_id", id),
    supabase.from("decisions").select("*").eq("project_id", id),
    supabase.from("audit_log").select("*").eq("project_id", id),
    supabase.from("organizations").select("id, name, type"),
    supabase.from("profiles").select("id, name, email"),
    supabase.from("project_members").select("project_id, user_id, role").eq("project_id", id),
    canEditCompletedTasks(supabase, user.id),
  ])

  if (!project) notFound()

  const orgMap = new Map((orgsAll ?? []).map((o: any) => [o.id, o]))
  const profMap = new Map((profilesAll ?? []).map((p: any) => [p.id, p]))

  // Organisations du projet (jsonb projects.orgs)
  const projectOrgs = (Array.isArray(project.orgs) ? project.orgs : []).map((o: any) => ({
    org_id: o.orgId, role: o.role, name: orgMap.get(o.orgId)?.name,
  }))
  // Membres du projet
  const projectMembers = (members ?? []).map((m: any) => ({
    user_id: m.user_id, role: m.role, name: profMap.get(m.user_id)?.name, email: profMap.get(m.user_id)?.email,
  }))

  const phaseIds = new Set((rawPhases ?? []).map((ph: any) => ph.id))
  // Documents rattachés aux tâches — récupérés séparément
  const { data: docsAll } = await supabase.from("documents").select("*")
  const docsByTask = new Map<string, any[]>()
  for (const d of docsAll ?? []) {
    if (!d.task_id) continue
    const arr = docsByTask.get(d.task_id) ?? []; arr.push(d); docsByTask.set(d.task_id, arr)
  }
  const { data: tasksRaw } = await supabase.from("tasks").select("*")
  const phases = (rawPhases ?? []).map((ph: any) => ({
    ...ph,
    tasks: (tasksRaw ?? [])
      .filter((t: any) => t.phase_id === ph.id)
      .map((t: any) => ({ ...t, assigneeName: profMap.get(t.assignee_id)?.name, documents: docsByTask.get(t.id) ?? [] })),
  })).filter((ph: any) => phaseIds.has(ph.id))

  // Lignes budgétaires enrichies (planned / valorisation, financeur, phase)
  const phaseNameMap = new Map((rawPhases ?? []).map((ph: any) => [ph.id, ph.name]))
  const budgetLines = (budgetLinesRaw ?? []).map((l: any) => ({
    ...l,
    funderName: orgMap.get(l.funder_org_id)?.name,
    phaseName: phaseNameMap.get(l.phase_id),
  }))

  // Indicateurs + mesures
  const indicators = (indicatorsRaw ?? []).map((ind: any) => ({
    ...ind, measures: (measures ?? []).filter((m: any) => m.indicator_id === ind.id),
  }))

  // Réunions + décisions (owner résolu)
  const meetings = (meetingsRaw ?? []).map((m: any) => ({
    ...m,
    decisions: (decisions ?? [])
      .filter((d: any) => d.meeting_id === m.id)
      .map((d: any) => ({ ...d, ownerName: profMap.get(d.owner_id)?.name })),
  })).sort((a: any, b: any) => String(b.date ?? "").localeCompare(String(a.date ?? "")))

  const auditRows = (audit ?? [])
    .map((a: any) => ({ ...a, byName: profMap.get(a.by)?.name }))
    .sort((a: any, b: any) => String(b.at ?? "").localeCompare(String(a.at ?? "")))
    .slice(0, 20)

  const allTasks = phases.flatMap((ph: any) => ph.tasks ?? [])
  const projectProgress = allTasks.length ? Math.round(allTasks.reduce((s: number, t: any) => s + (t.progress ?? 0), 0) / allTasks.length) : 0
  const s = PROJECT_STATUS[project.status] ?? { label: project.status, fg: "#66716B", bg: "#EEF0EE" }

  const totalPlanned = budgetLines.filter((l: any) => !l.valorisation).reduce((s: number, l: any) => s + (l.planned ?? 0), 0)
  const totalValorisation = budgetLines.filter((l: any) => l.valorisation).reduce((s: number, l: any) => s + (l.planned ?? 0), 0)

  const TABS = [
    { key: "apercu", label: "Aperçu" },
    { key: "taches", label: `Tâches (${allTasks.length})` },
    { key: "budget", label: "Budget" },
    { key: "impact", label: "Impact" },
    { key: "copil", label: "COPIL" },
    { key: "audit", label: "Journal" },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/projets" className="inline-flex items-center gap-1 text-sm mb-6" style={{ color: "#66716B" }}>
        <ChevronLeft size={16} /> Projets
      </Link>

      <div className="flex flex-wrap items-start gap-4 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{project.name}</h1>
            <Badge label={s.label} fg={s.fg} bg={s.bg} />
          </div>
          {project.description && <p className="text-sm" style={{ color: "#66716B" }}>{project.description}</p>}
        </div>
        <div className="text-right text-sm" style={{ color: "#66716B" }}>
          {project.country && <div>📍 {project.country}{project.zone ? ` — ${project.zone}` : ""}</div>}
          {project.start_date && <div>{fmtDate(project.start_date)} → {fmtDate(project.end_date)}</div>}
          {project.budget && <div className="font-semibold" style={{ color: "#17211D" }}>{fmtEur(project.budget)}</div>}
        </div>
      </div>

      {/* Progress global */}
      <div className="bg-white rounded-2xl border p-5 mb-6" style={{ borderColor: "#E3E6E2" }}>
        <div className="flex justify-between text-sm mb-2" style={{ color: "#66716B" }}>
          <span>Avancement global</span>
          <span className="font-semibold" style={{ color: "#17211D" }}>{projectProgress}%</span>
        </div>
        <ProgressBar value={projectProgress} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "#E3E6E2" }}>
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={`/projets/${id}?tab=${key}`}
            className="px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px"
            style={{
              borderColor: tab === key ? "#0E6B5C" : "transparent",
              color: tab === key ? "#0E6B5C" : "#66716B",
              fontFamily: "var(--font-inter)",
            }}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* ===== APERÇU ===== */}
      {tab === "apercu" && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Organisations */}
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Organisations ({projectOrgs.length})</h2>
            <div className="space-y-2">
              {projectOrgs.map((po: any) => {
                const r = PROJECT_ROLES[po.role] ?? { label: po.role, fg: "#66716B", bg: "#EEF0EE" }
                return (
                  <div key={po.org_id} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: "#17211D", fontFamily: "var(--font-inter)" }}>{po.name}</span>
                    <Badge label={r.label} fg={r.fg} bg={r.bg} />
                  </div>
                )
              })}
            </div>
          </div>
          {/* Membres */}
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Membres ({projectMembers.length})</h2>
            <div className="space-y-2">
              {projectMembers.map((pm: any) => {
                const r = { label: pm.role.replace("_", " "), fg: "#66716B", bg: "#EEF0EE" }
                return (
                  <div key={pm.user_id} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium" style={{ color: "#17211D" }}>{pm.name}</div>
                      <div className="text-xs" style={{ color: "#66716B" }}>{pm.email}</div>
                    </div>
                    <Badge label={pm.role.replace(/_/g, " ")} fg={r.fg} bg={r.bg} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== TÂCHES ===== */}
      {tab === "taches" && (
        <div className="space-y-4">
          {(phases ?? []).map((ph: any) => {
            const phaseTasks = ph.tasks ?? []
            const phProg = phaseTasks.length ? Math.round(phaseTasks.reduce((s: number, t: any) => s + t.progress, 0) / phaseTasks.length) : 0
            return (
              <div key={ph.id} className="bg-white rounded-2xl border" style={{ borderColor: "#E3E6E2" }}>
                <div className="p-4 border-b" style={{ borderColor: "#E3E6E2" }}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{ph.name}</h3>
                    <div className="flex items-center gap-3 text-sm" style={{ color: "#66716B" }}>
                      {ph.budget && <span>{fmtEur(ph.budget)}</span>}
                      <span>{phProg}%</span>
                    </div>
                  </div>
                  <div className="mt-2"><ProgressBar value={phProg} /></div>
                </div>
                <div className="divide-y" style={{ borderColor: "#E3E6E2" }}>
                  {phaseTasks.map((t: any) => {
                    const ts = TASK_STATUS[t.status] ?? { label: t.status, fg: "#66716B", bg: "#EEF0EE" }
                    const rv = t.review ? (REVIEW_STATES[t.review] ?? null) : null
                    return (
                      <div key={t.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="text-sm font-medium" style={{ color: "#17211D" }}>{t.title}</div>
                            {t.description && <div className="text-xs mt-0.5" style={{ color: "#66716B" }}>{t.description}</div>}
                            <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "#66716B" }}>
                              {t.assigneeName && <span>👤 {t.assigneeName}</span>}
                              {t.end_date && <span>📅 {fmtDate(t.end_date)}</span>}
                              {(t.documents ?? []).length > 0 && <span>📎 {t.documents.length} doc</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge label={ts.label} fg={ts.fg} bg={ts.bg} />
                            {rv && <Badge label={rv.label} fg={rv.fg} bg={rv.bg} />}
                            {t.status === "terminee" && canEditCompleted && (
                              <EditCompletedTaskDialog task={{
                                id: t.id,
                                title: t.title,
                                description: t.description ?? null,
                                status: t.status,
                                progress: t.progress,
                                start_date: t.start_date ?? null,
                                end_date: t.end_date ?? null,
                                comment: t.comment ?? null,
                              }} />
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex-1"><ProgressBar value={t.progress} /></div>
                          <span className="text-xs w-8 text-right" style={{ color: "#66716B" }}>{t.progress}%</span>
                        </div>
                      </div>
                    )
                  })}
                  {!phaseTasks.length && <div className="p-4 text-sm text-center" style={{ color: "#66716B" }}>Aucune tâche</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===== BUDGET ===== */}
      {tab === "budget" && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Prévisionnel (hors valorisation)", value: fmtEur(totalPlanned), color: "#0E6B5C", bg: "#E4F0EC" },
              { label: "Valorisations", value: fmtEur(totalValorisation), color: "#8A6A1F", bg: "#F5EFE2" },
              { label: "Lignes actives", value: (budgetLines ?? []).filter((l: any) => l.status === "active").length, color: "#3B5488", bg: "#E8ECF5" },
              { label: "Lignes prévues", value: (budgetLines ?? []).filter((l: any) => l.status === "prevue").length, color: "#66716B", bg: "#EEF0EE" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl border p-4" style={{ borderColor: "#E3E6E2" }}>
                <div className="text-xl font-bold" style={{ fontFamily: "var(--font-sora)", color }}>{value}</div>
                <div className="text-xs mt-1" style={{ color: "#66716B" }}>{label}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
                  {["Poste", "Catégorie", "Financeur", "Phase", "Année", "Prévisionnel", "Statut"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(budgetLines ?? []).map((l: any, i: number) => {
                  const ls = LINE_STATUS[l.status] ?? { label: l.status, fg: "#66716B", bg: "#EEF0EE" }
                  const lc = LINE_CATEGORIES[l.category] ?? { label: l.category, fg: "#66716B", bg: "#EEF0EE" }
                  return (
                    <tr key={l.id} style={{ borderBottom: "1px solid #E3E6E2", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                      <td className="px-4 py-3 font-medium" style={{ color: "#17211D" }}>
                        {l.poste}
                        {l.valorisation && <span className="ml-1 text-xs px-1.5 py-0.5 rounded" style={{ background: "#F5EFE2", color: "#8A6A1F" }}>Valorisation</span>}
                      </td>
                      <td className="px-4 py-3"><Badge label={lc.label} fg={lc.fg} bg={lc.bg} /></td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#66716B" }}>{l.funderName ?? "—"}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#66716B" }}>{l.phaseName ?? "—"}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#66716B" }}>{l.year ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "#17211D" }}>{fmtEur(l.planned)}</td>
                      <td className="px-4 py-3"><Badge label={ls.label} fg={ls.fg} bg={ls.bg} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!(budgetLines ?? []).length && <div className="p-8 text-center text-sm" style={{ color: "#66716B" }}>Aucune ligne budgétaire</div>}
          </div>
        </div>
      )}

      {/* ===== IMPACT ===== */}
      {tab === "impact" && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(indicators ?? []).map((ind: any) => {
            const measures = ind.measures ?? []
            const lastMeasure = measures.length ? measures.sort((a: any, b: any) => b.at.localeCompare(a.at))[0] : null
            const baseline = ind.baseline ?? 0
            const pct = lastMeasure && ind.target !== baseline
              ? Math.round(Math.max(0, Math.min(100, ((lastMeasure.value - baseline) / (ind.target - baseline)) * 100)))
              : 0
            const ik = IND_KINDS[ind.kind] ?? { label: ind.kind, fg: "#66716B", bg: "#EEF0EE" }
            return (
              <div key={ind.id} className="bg-white rounded-2xl border p-5" style={{ borderColor: "#E3E6E2" }}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{ind.name}</h3>
                  <Badge label={ik.label} fg={ik.fg} bg={ik.bg} />
                </div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-3xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#0E6B5C" }}>
                    {lastMeasure ? lastMeasure.value : baseline}
                  </span>
                  <span className="text-sm mb-1" style={{ color: "#66716B" }}>{ind.unit}</span>
                  <span className="text-sm mb-1 ml-1" style={{ color: "#66716B" }}>/ {ind.target}</span>
                </div>
                <div className="mb-2"><ProgressBar value={pct} /></div>
                <div className="flex justify-between text-xs" style={{ color: "#66716B" }}>
                  <span>{pct}% atteint</span>
                  {lastMeasure && <span>{lastMeasure.period}</span>}
                </div>
                {measures.length === 0 && <p className="text-xs mt-2" style={{ color: "#B4690E" }}>Aucune mesure saisie</p>}
              </div>
            )
          })}
          {!(indicators ?? []).length && <div className="col-span-3 text-center py-12 text-sm" style={{ color: "#66716B" }}>Aucun indicateur défini</div>}
        </div>
      )}

      {/* ===== COPIL ===== */}
      {tab === "copil" && (
        <div className="space-y-4">
          {(meetings ?? []).map((m: any) => {
            const mk = MEETING_KINDS[m.kind] ?? { label: m.kind, fg: "#66716B", bg: "#EEF0EE" }
            return (
              <div key={m.id} className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
                <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "#E3E6E2" }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge label={mk.label} fg={mk.fg} bg={mk.bg} />
                      <span className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{m.title}</span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: "#66716B" }}>{fmtDate(m.date)}</div>
                  </div>
                  {(m.decisions ?? []).length > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#E8ECF5", color: "#3B5488" }}>
                      {m.decisions.length} décision{m.decisions.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {m.minutes && <p className="px-5 py-3 text-sm" style={{ color: "#66716B" }}>{m.minutes}</p>}
                {(m.decisions ?? []).length > 0 && (
                  <div className="px-5 pb-4 space-y-2">
                    {m.decisions.map((d: any) => {
                      const ds = DECISION_STATUS[d.status] ?? { label: d.status, fg: "#66716B", bg: "#EEF0EE" }
                      return (
                        <div key={d.id} className="flex items-center justify-between gap-3 text-sm">
                          <span style={{ color: "#17211D" }}>{d.text}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {d.ownerName && <span className="text-xs" style={{ color: "#66716B" }}>{d.ownerName}</span>}
                            {d.due && <span className="text-xs" style={{ color: "#66716B" }}>{fmtDate(d.due)}</span>}
                            <Badge label={ds.label} fg={ds.fg} bg={ds.bg} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          {!(meetings ?? []).length && <div className="text-center py-12 text-sm" style={{ color: "#66716B" }}>Aucune réunion enregistrée</div>}
        </div>
      )}

      {/* ===== AUDIT ===== */}
      {tab === "audit" && (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
          <div className="divide-y" style={{ borderColor: "#E3E6E2" }}>
            {auditRows.map((a: any) => (
              <div key={a.id} className="px-5 py-3 flex items-start gap-4">
                <div className="flex-shrink-0 w-16 text-xs text-right" style={{ color: "#66716B" }}>
                  {a.at ? new Date(a.at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "—"}
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: "#E4F0EC", color: "#0E6B5C" }}>{a.action}</span>
                  {" "}
                  <span className="text-sm" style={{ color: "#17211D" }}>{a.label}</span>
                  {a.comment && <span className="text-xs ml-2" style={{ color: "#66716B" }}>· {a.comment}</span>}
                  <div className="text-xs mt-0.5" style={{ color: "#66716B" }}>par {a.byName ?? "—"}</div>
                </div>
              </div>
            ))}
            {!auditRows.length && <div className="p-8 text-center text-sm" style={{ color: "#66716B" }}>Aucun événement enregistré</div>}
          </div>
        </div>
      )}
    </div>
  )
}
