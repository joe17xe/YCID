export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { PROJECT_STATUS, PROJECT_ROLES, ACCESS_ROLES, TASK_STATUS, REVIEW_STATES, fmtEur, fmtDate, LINE_STATUS, LINE_CATEGORIES, IND_KINDS, DECISION_STATUS, MEETING_KINDS } from "@/lib/constants"
import { canEditCompletedTasks, getProjectRole } from "@/lib/permissions"
import { can } from "@/lib/rbac"
import { TAB_HELP } from "@/lib/help-content"
import EditCompletedTaskDialog from "@/components/tasks/EditCompletedTaskDialog"
import PhaseDialog from "@/components/tasks/PhaseDialog"
import TaskDialog from "@/components/tasks/TaskDialog"
import { BudgetLineDialog, CreateTaskFromLineButton, IndicatorDialog, MeasureDialog, MeetingDialog, DecisionDialog } from "@/components/project/ProjectDataDialogs"
import TaskDocuments from "@/components/project/TaskDocuments"
import DeleteTaskButton from "@/components/tasks/DeleteTaskButton"
import BudgetLineDocuments from "@/components/project/BudgetLineDocuments"
import PhasePhotos, { type PhasePhoto } from "@/components/project/PhasePhotos"
import DocumentsPanel, { type ProjectDoc } from "@/components/project/DocumentsPanel"
import { GALLERY_URL_TTL, type DocMoment } from "@/lib/documents"
import { financialsFor, sumFinancials, gap, fmtSignedEur, type Financials } from "@/lib/budget"

const EMPTY_FIN: Financials = { planned: 0, engaged: 0, paid: 0, remainingToCommit: 0, remainingToPay: 0 }
import { MemberDialog, InviteUserDialog, RemoveMemberButton, MemberRoleSelect } from "@/components/project/MemberDialog"
import HelpDialog from "@/components/help/HelpDialog"
import DeleteProjectButton from "@/components/project/DeleteProjectButton"
import ExpertReportDialog from "@/components/project/ExpertReportDialog"
import CommPanel, { type Campaign } from "@/components/project/CommPanel"
import PublicPageDialog from "@/components/project/PublicPageDialog"
import ProjectEditDialog from "@/components/project/ProjectEditDialog"
import ProjectDocUpload from "@/components/project/ProjectDocUpload"
import { ChevronLeft } from "lucide-react"

function Badge({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: fg, background: bg }}>{label}</span>
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#E3E6E2" }}>
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: "var(--brand-accent,#0E6B5C)" }} />
    </div>
  )
}

export default async function ProjetDetailPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params
  // Un onglet inconnu (?tab=journal au lieu de ?tab=audit, lien périmé,
  // faute de frappe) affichait une page entièrement vide : aucune
  // section ne correspondait, et rien ne le disait. On retombe sur
  // l'aperçu, comportement attendu d'une URL qui ne mène nulle part.
  const VALID_TABS = ["apercu", "taches", "budget", "documents", "impact", "copil", "comm", "audit"]
  const { tab: rawTab } = await searchParams
  const tab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : "apercu"
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const [{ data: project }, { data: phases }, { data: budgetLines }, { data: indicators }, { data: meetings }, { data: audit }, { data: phasePhotos }, { data: allDocs }, canEditCompleted] = await Promise.all([
    supabase.from("projects").select("*, project_organizations(org_id, role, organizations(id, name, type)), project_members(user_id, role, profiles(id, full_name, email)), validation_rules(id, role, doc_type)").eq("id", id).single(),
    supabase.from("phases").select("*, tasks(*, profiles:assignee_id(full_name), documents(*))").eq("project_id", id).order("position"),
    supabase.from("budget_lines").select("*, funder:funder_org_id(name), owner:owner_org_id(name), phase:phase_id(name), allocations:budget_line_tasks(task_id, amount, task:task_id(title)), documents(id, filename, type, amount, paid, paid_at, uploaded_at, validations(id, org_id, decision, step, comment, org:org_id(name), decider:decided_by(full_name)))").eq("project_id", id).order("year"),
    supabase.from("indicators").select("*, measures:indicator_measures(*)").eq("project_id", id),
    supabase.from("meetings").select("*, decisions(*, owner:owner_user_id(full_name))").eq("project_id", id).order("date", { ascending: false }),
    supabase.from("audit_log").select("*, profiles:user_id(full_name)").eq("project_id", id).order("at", { ascending: false }).limit(20),
    // Photos de phase (PR 38c) : requête séparée car le join imbriqué
    // sur phases remonterait aussi les photos des tâches, qui portent
    // elles aussi un phase_id. Le critère est task_id IS NULL.
    supabase.from("documents").select("id, phase_id, filename, moment, storage_path")
      .eq("project_id", id).eq("type", "photo").is("task_id", null).order("uploaded_at"),
    // Zone documentaire centralisée (PR 38d) : toutes les pièces du
    // projet, quel que soit leur point de dépôt.
    supabase.from("documents")
      .select("id, filename, type, moment, amount, paid, uploaded_at, phase:phase_id(name), task:task_id(title), line:budget_line_id(poste), uploader:uploaded_by(full_name)")
      .eq("project_id", id).order("uploaded_at", { ascending: false }),
    canEditCompletedTasks(supabase, user.id),
  ])

  // Bucket privé : les vignettes exigent des URL signées. Une seule
  // signature groupée plutôt qu'un aller-retour par image.
  const photoUrlByPath = new Map<string, string>()
  const photoPaths = (phasePhotos ?? []).map((p: { storage_path: string | null }) => p.storage_path).filter(Boolean) as string[]
  if (photoPaths.length) {
    const { data: signed } = await supabase.storage.from("documents").createSignedUrls(photoPaths, GALLERY_URL_TTL)
    for (const s of signed ?? []) if (s.path && s.signedUrl) photoUrlByPath.set(s.path, s.signedUrl)
  }
  // Qui peut décider d'une validation (correctif 0036) : le membre de
  // l'organisation SOLLICITÉE, ou un administrateur plateforme. Se
  // contenter du rôle projet affichait « Valider » à des profils que la
  // base refuse ensuite — et surtout, laissait une organisation trancher
  // au nom d'une autre.
  const [{ data: myOrgs }, { data: myProfile }] = await Promise.all([
    supabase.from("memberships").select("org_id").eq("user_id", user.id),
    supabase.from("profiles").select("is_platform_admin").eq("id", user.id).maybeSingle(),
  ])
  const myOrgIds = new Set((myOrgs ?? []).map((m: { org_id: string }) => m.org_id))
  const isPlatformAdmin = !!myProfile?.is_platform_admin

  // supabase-js type les jointures « to-one » tantôt en objet, tantôt en
  // tableau selon l'inférence : on normalise une fois pour toutes.
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)
  const projectDocs: ProjectDoc[] = ((allDocs ?? []) as any[]).map(d => ({
    id: d.id, filename: d.filename, type: d.type, moment: d.moment ?? null,
    amount: d.amount ?? null, paid: !!d.paid, uploadedAt: d.uploaded_at,
    uploaderName: one<{ full_name: string | null }>(d.uploader)?.full_name ?? null,
    phaseName: one<{ name: string }>(d.phase)?.name ?? null,
    taskTitle: one<{ title: string }>(d.task)?.title ?? null,
    lineposte: one<{ poste: string }>(d.line)?.poste ?? null,
  }))

  const photosByPhase = new Map<string, PhasePhoto[]>()
  for (const p of (phasePhotos ?? []) as { id: string; phase_id: string | null; filename: string; moment: DocMoment | null; storage_path: string | null }[]) {
    if (!p.phase_id) continue
    photosByPhase.set(p.phase_id, [...(photosByPhase.get(p.phase_id) ?? []), {
      id: p.id, filename: p.filename, moment: p.moment,
      url: p.storage_path ? photoUrlByPath.get(p.storage_path) ?? null : null,
    }])
  }

  if (!project) notFound()

  // Droits d'édition : les admins (canEditCompleted couvre le même
  // périmètre) ou le rôle du membre dans ce projet.
  // Les droits se lisent dans lib/rbac.ts, seule liste à tenir juste.
  // Ces trois tableaux étaient recopiés ici, et l'écran des droits en
  // affichait une version qui avait fini par diverger.
  const myRole = await getProjectRole(supabase, user.id, id)
  const canPhases = canEditCompleted || can(myRole, "phases.manage")
  const canTasks = canEditCompleted || can(myRole, "taches.manage")
  const canBudget = canEditCompleted || can(myRole, "budget.manage")
  const canMeetings = canPhases
  const memberOptions = (project.project_members ?? [])
    .map((pm: any) => ({ id: pm.user_id, name: pm.profiles?.full_name ?? pm.user_id }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name, "fr"))
  const { data: orgsAll } = await supabase.from("organizations").select("id, name").eq("status", "active").order("name")
  const orgOptions = (orgsAll ?? []).map((o: any) => ({ id: o.id, name: o.name }))
  // Candidats à l'ajout comme membre : comptes existants pas encore membres
  const { data: allProfiles } = await supabase.from("profiles").select("id, full_name, email").order("full_name")
  const memberIds = new Set((project.project_members ?? []).map((pm: any) => pm.user_id))
  const memberCandidates = (allProfiles ?? [])
    .filter((p: any) => !memberIds.has(p.id))
    .map((p: any) => ({ id: p.id, name: p.full_name ?? "", email: p.email ?? "" }))
  const phaseOptions = (phases ?? []).map((ph: any) => ({ id: ph.id, name: ph.name }))

  // Campagnes de communication (PR 26) — tolère l'absence de la table
  // tant que la migration 0019 n'est pas appliquée.
  const { data: rawCampaigns, error: commError } = await supabase
    .from("comm_campaigns")
    .select("*, responsible:responsible_id(full_name)")
    .eq("project_id", id)
    .order("scheduled_date")
  const campaigns: Campaign[] = (rawCampaigns ?? []).map((c: any) => ({
    ...c, responsible_name: c.responsible?.full_name ?? null, brief: c.brief ?? null,
  }))

  const allTasks = (phases ?? []).flatMap((ph: any) => ph.tasks ?? [])
  const projectProgress = allTasks.length ? Math.round(allTasks.reduce((s: number, t: any) => s + t.progress, 0) / allTasks.length) : 0
  const s = PROJECT_STATUS[project.status] ?? { label: project.status, fg: "#66716B", bg: "#EEF0EE" }

  // ---- Lien tâches ↔ budget (PR 40 / 40b) --------------------------
  // Relation N:M portant un montant : une tâche peut être financée par
  // plusieurs lignes (co-financement), et une ligne se répartir sur
  // plusieurs tâches (40 000 € = 10 000 € + 30 000 €). Le budget d'une
  // tâche est donc TOUJOURS une somme d'affectations — 0 € quand il n'y
  // en a aucune, jamais « inconnu ».
  const taskOptions = (phases ?? []).flatMap((ph: any) =>
    (ph.tasks ?? []).map((t: any) => ({ id: t.id, name: t.title, phase_id: ph.id })))
  const plannedByTask = new Map<string, number>()
  const plannedByPhase = new Map<string, number>()
  const linesByPhase = new Map<string, any[]>()
  // Prévu / engagé / payé (PR 39). Le calcul vit dans lib/budget.ts,
  // partagé avec le rapport IA : deux implémentations des mêmes règles
  // finiraient par diverger, et un chiffre affiché contredisant le même
  // chiffre commenté par l'IA serait le pire défaut pour une pièce
  // destinée à un financeur.
  const finByLine = new Map<string, Financials>()
  const finByPhase = new Map<string, Financials>()
  for (const l of budgetLines ?? []) {
    const amount = l.planned_amount ?? 0
    for (const a of (l.allocations ?? []) as { task_id: string; amount: number }[]) {
      plannedByTask.set(a.task_id, (plannedByTask.get(a.task_id) ?? 0) + (a.amount ?? 0))
    }
    const key = l.phase_id ?? "__hors_phase__"
    plannedByPhase.set(key, (plannedByPhase.get(key) ?? 0) + amount)
    linesByPhase.set(key, [...(linesByPhase.get(key) ?? []), l])
    const fin = financialsFor(amount, (l.documents ?? []) as any[])
    finByLine.set(l.id, fin)
    finByPhase.set(key, sumFinancials([finByPhase.get(key) ?? EMPTY_FIN, fin]))
  }

  // Enveloppe : les valorisations (bénévolat, locaux) ne sont pas de
  // l'argent voté — les mêler au prévisionnel gonflerait l'enveloppe
  // d'un montant que personne ne paiera jamais.
  const realLines = (budgetLines ?? []).filter((l: any) => !l.is_valorisation)
  const projectFin = sumFinancials(realLines.map((l: any) => finByLine.get(l.id) ?? EMPTY_FIN))
  const totalValorisation = (budgetLines ?? []).filter((l: any) => l.is_valorisation)
    .reduce((s: number, l: any) => s + (l.planned_amount ?? 0), 0)
  // Le montant VOTÉ est la référence : la répartition entre lignes peut
  // bouger librement, l'enveloppe non (règle YCID du 25/07/2026).
  const voted = project.budget ?? null
  const envelopeGap = voted != null ? gap(projectFin.planned, voted) : null
  // Le budget d'une tâche existe toujours : à défaut d'affectation, 0 €.
  const taskBudget = (taskId: string) => plannedByTask.get(taskId) ?? 0
  // Regroupement du tableau budgétaire : phases dans l'ordre du projet,
  // puis les lignes non rattachées. Les groupes vides sont omis.
  const budgetGroups = [
    ...(phases ?? []).map((ph: any) => ({ id: ph.id, name: ph.name, lines: linesByPhase.get(ph.id) ?? [] })),
    { id: "__hors_phase__", name: "Hors phase", lines: linesByPhase.get("__hors_phase__") ?? [] },
  ].filter(g => g.lines.length)

  const TABS = [
    { key: "apercu", label: "Aperçu" },
    { key: "taches", label: `Tâches (${allTasks.length})` },
    { key: "budget", label: "Budget" },
    { key: "documents", label: `Documents${projectDocs.length ? ` (${projectDocs.length})` : ""}` },
    { key: "impact", label: "Impact" },
    { key: "copil", label: "COPIL" },
    { key: "comm", label: `Communication${campaigns.length ? ` (${campaigns.length})` : ""}` },
    { key: "audit", label: "Journal" },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/projets" className="inline-flex items-center gap-1 text-sm" style={{ color: "#66716B" }}>
          <ChevronLeft size={16} /> Projets
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {canPhases && (
            <ProjectEditDialog project={{
              id, name: project.name, description: project.description ?? null,
              country: project.country ?? null, zone: project.zone ?? null,
              programme: project.programme ?? null,
              start_date: project.start_date ?? null, end_date: project.end_date ?? null,
              status: project.status, budget: project.budget ?? null,
              lead_org_id: project.lead_org_id ?? null,
            }} organizations={orgOptions} />
          )}
          {canPhases && <PublicPageDialog projectId={id} token={project.public_token ?? null} />}
          <ExpertReportDialog projectId={id} projectName={project.name} />
          {canEditCompleted && <DeleteProjectButton projectId={id} projectName={project.name} />}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{project.name}</h1>
            <Badge label={s.label} fg={s.fg} bg={s.bg} />
            {project.programme && <Badge label={project.programme} fg="#6B4A8C" bg="#F0E9F5" />}
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
              borderColor: tab === key ? "var(--brand-accent,#0E6B5C)" : "transparent",
              color: tab === key ? "var(--brand-accent,#0E6B5C)" : "#66716B",
              fontFamily: "var(--font-inter)",
            }}
          >
            {label}
          </Link>
        ))}
        {TAB_HELP[tab] && (
          <span className="ml-auto self-center">
            <HelpDialog title={TAB_HELP[tab].title} excerpt={TAB_HELP[tab].excerpt} anchor={TAB_HELP[tab].anchor} />
          </span>
        )}
      </div>

      {/* ===== APERÇU ===== */}
      {tab === "apercu" && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Organisations */}
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
            <h2 className="font-semibold mb-4" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Organisations ({(project.project_organizations ?? []).length})</h2>
            <div className="space-y-2">
              {(project.project_organizations ?? []).map((po: any) => {
                const r = PROJECT_ROLES[po.role] ?? { label: po.role, fg: "#66716B", bg: "#EEF0EE" }
                return (
                  <div key={po.org_id} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: "#17211D", fontFamily: "var(--font-inter)" }}>{po.organizations?.name}</span>
                    <Badge label={r.label} fg={r.fg} bg={r.bg} />
                  </div>
                )
              })}
            </div>
          </div>
          {/* Membres */}
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Membres ({(project.project_members ?? []).length})</h2>
              {canPhases && (
                <span className="flex items-center gap-1.5">
                  <InviteUserDialog projectId={id} />
                  <MemberDialog projectId={id} candidates={memberCandidates} />
                </span>
              )}
            </div>
            <div className="space-y-2">
              {(project.project_members ?? []).map((pm: any) => {
                const r = ACCESS_ROLES[pm.role] ?? { label: pm.role.replace(/_/g, " "), short: pm.role, fg: "#66716B", bg: "#EEF0EE" }
                return (
                  <div key={pm.user_id} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium" style={{ color: "#17211D" }}>{pm.profiles?.full_name}</div>
                      <div className="text-xs" style={{ color: "#66716B" }}>{pm.profiles?.email}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Le rôle se change sur place. Il fallait jusqu'ici
                          retirer puis rajouter la personne — ce qui effaçait
                          son historique d'appartenance — et, pour un
                          responsable, en nommer un second d'abord. */}
                      {canPhases
                        ? <MemberRoleSelect projectId={id} userId={pm.user_id} name={pm.profiles?.full_name ?? ""} role={pm.role} />
                        : <Badge label={r.short ?? r.label} fg={r.fg} bg={r.bg} />}
                      {canPhases && <RemoveMemberButton projectId={id} userId={pm.user_id} name={pm.profiles?.full_name ?? ""} />}
                    </div>
                  </div>
                )
              })}
              {!(project.project_members ?? []).length && (
                <p className="text-sm" style={{ color: "#66716B" }}>
                  Aucun membre — ajoutez les utilisateurs invités pour leur donner accès au projet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== TÂCHES ===== */}
      {tab === "taches" && (
        <div className="space-y-4">
          {canPhases && (
            <div className="flex justify-end">
              <PhaseDialog projectId={id} />
            </div>
          )}
          {(phases ?? []).map((ph: any) => {
            const phaseTasks = ph.tasks ?? []
            // Avancement pondéré par le budget, avec PLANCHER À 2 %
            // (arbitrage YCID du 25/07).
            //
            // La règle d'origine n'appliquait la pondération que si TOUTE
            // tâche de la phase était chiffrée — donc jamais, puisqu'une
            // tâche peut légitimement valoir 0 €. La pondération était
            // morte-née.
            //
            // Pondérer sans plancher est pire encore : une tâche à 0 €
            // disparaît du calcul, et la phase peut afficher 100 % alors
            // que « signer la convention » n'est pas fait. C'est
            // exactement ce qu'un financeur ne doit pas lire.
            //
            // Le plancher vaut pour TOUTES les tâches, pas seulement
            // celles à 0 € : sans quoi une tâche à 100 € pèserait moins
            // qu'une tâche à 0 €, ce qui serait absurde.
            const phaseLinesForWeight = plannedByPhase.get(ph.id) ?? 0
            const floor = phaseLinesForWeight * 0.02
            const rawWeights = phaseTasks.map((t: any) => taskBudget(t.id))
            const weighted = phaseTasks.length > 0 && phaseLinesForWeight > 0
            const weights = weighted
              ? rawWeights.map((w: number) => Math.max(w, floor))
              : rawWeights
            const totalWeight = weights.reduce((s: number, w: number) => s + w, 0)
            const phProg = !phaseTasks.length ? 0
              : weighted && totalWeight > 0
                ? Math.round(phaseTasks.reduce((s: number, t: any, i: number) => s + t.progress * weights[i], 0) / totalWeight)
                : Math.round(phaseTasks.reduce((s: number, t: any) => s + t.progress, 0) / phaseTasks.length)
            // Deux chiffres coexistent : le budget saisi sur la phase et
            // la somme des lignes qui lui sont rattachées. On montre
            // l'écart au lieu de laisser croire qu'ils sont synchronisés.
            const phaseLinesTotal = plannedByPhase.get(ph.id) ?? 0
            const phaseFin = finByPhase.get(ph.id) ?? EMPTY_FIN
            return (
              <div key={ph.id} className="bg-white rounded-2xl border" style={{ borderColor: "#E3E6E2" }}>
                <div className="p-4 border-b" style={{ borderColor: "#E3E6E2" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{ph.name}</h3>
                      {canPhases && (
                        <PhaseDialog projectId={id} phase={{
                          id: ph.id, name: ph.name, start_date: ph.start_date ?? null,
                          end_date: ph.end_date ?? null, status: ph.status,
                        }} />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm flex-wrap justify-end" style={{ color: "#66716B" }}>
                      <span>{phaseTasks.length} tâche{phaseTasks.length > 1 ? "s" : ""}</span>
                      {/* Preuve de réalisation (PR 38e) : compte agrégé,
                          pour qu'on n'ait pas à déplier chaque tâche. */}
                      {(() => {
                        const n = phaseTasks.filter((t: any) => t.status === "terminee" && !(t.documents ?? []).length).length
                        return n > 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: "#F7EDDD", color: "#8A6A1F" }}
                            title="Tâches déclarées terminées sans aucune pièce justificative">
                            {n} sans justificatif
                          </span>
                        ) : null
                      })()}
                      {phaseLinesTotal > 0 && <span title="Somme des lignes budgétaires de la phase">{fmtEur(phaseLinesTotal)}</span>}
                      <span title={weighted
                        ? "Moyenne pondérée par le budget des tâches, avec un poids plancher de 2 % du budget de la phase : une tâche à 0 € compte tout de même, la phase ne peut donc pas afficher 100 % tant qu'elle n'est pas faite."
                        : "Moyenne des tâches, à parts égales — la phase n'a pas encore de budget réparti."}>
                        {phProg}%{weighted && <span className="text-xs"> pondéré</span>}
                      </span>
                      {canTasks && <TaskDialog phaseId={ph.id} members={memberOptions} />}
                    </div>
                  </div>
                  {/* Plus d'écart possible ici depuis la PR 39 : le budget
                      d'une phase EST la somme de ses lignes. On montre
                      donc son exécution plutôt qu'une divergence. */}
                  {phaseFin.planned > 0 && (
                    <p className="mt-2 text-xs" style={{ color: "#66716B" }}>
                      Prévu {fmtEur(phaseFin.planned)} · engagé {fmtEur(phaseFin.engaged)} · payé {fmtEur(phaseFin.paid)}
                    </p>
                  )}
                  <div className="mt-2"><ProgressBar value={phProg} /></div>
                  {/* Photos avant / pendant / après de la phase (PR 38c) */}
                  <PhasePhotos projectId={id} phaseId={ph.id} canUpload={canTasks}
                    photos={photosByPhase.get(ph.id) ?? []} />
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
                              {t.profiles?.full_name && <span>👤 {t.profiles.full_name}</span>}
                              {t.end_date && <span>📅 {fmtDate(t.end_date)}</span>}
                              {/* Le compteur « 📎 N doc » existait depuis
                                  l'origine mais restait à 0 : rien ne
                                  permettait de déposer une pièce (PR 38a). */}
                              <TaskDocuments projectId={id} phaseId={ph.id} taskId={t.id}
                                canUpload={canTasks} taskDone={t.status === "terminee"}
                                docs={[...(t.documents ?? [])]
                                  .sort((a: any, b: any) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)))
                                  .map((d: any) => ({
                                    id: d.id, filename: d.filename, type: d.type, uploaded_at: d.uploaded_at,
                                  }))} />
                              {/* Toute tâche porte un budget, 0 € compris :
                                  « sans budget » ressemblait à une donnée
                                  manquante alors que 0 € est une décision. */}
                              <span
                                title={taskBudget(t.id) > 0
                                  ? "Somme affectée à cette tâche par les lignes budgétaires"
                                  : "Aucune ligne budgétaire n'est affectée à cette tâche"}
                                style={{ color: taskBudget(t.id) > 0 ? "var(--brand-accent,#0E6B5C)" : "#9AA39D" }}>
                                💶 {fmtEur(taskBudget(t.id))}
                              </span>
                              {/* Sens inverse de la création croisée : la
                                  tâche existe, son financement reste à
                                  saisir. Le dialogue s'ouvre déjà rattaché. */}
                              {canBudget && (
                                <BudgetLineDialog projectId={id} orgs={orgOptions} phases={phaseOptions} tasks={taskOptions}
                                  preset={{ phase_id: ph.id, task_id: t.id }} triggerLabel="ligne budgétaire" />
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                              {canTasks && t.status !== "terminee" && (
                                <>
                                  <TaskDialog phaseId={ph.id} members={memberOptions} task={{
                                    id: t.id, title: t.title, description: t.description ?? null,
                                    assignee_id: t.assignee_id ?? null, start_date: t.start_date ?? null,
                                    end_date: t.end_date ?? null, status: t.status, progress: t.progress,
                                  }} />
                                  {/* Aucun moyen de supprimer une tâche n'existait :
                                      deux clics sur « Créer la tâche » suffisaient à
                                      en laisser une en double, définitivement. */}
                                  <DeleteTaskButton taskId={t.id} projectId={id} title={t.title}
                                    budget={taskBudget(t.id)} docCount={(t.documents ?? []).length} />
                                </>
                              )}
                              <Badge label={ts.label} fg={ts.fg} bg={ts.bg} />
                            </div>
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
          {canBudget && (
            <div className="flex justify-end mb-4">
              <BudgetLineDialog projectId={id} orgs={orgOptions} phases={phaseOptions} tasks={taskOptions} />
            </div>
          )}
          {/* Enveloppe votée (PR 39). La répartition entre lignes bouge
              librement ; c'est l'écart au montant VOTÉ qui alerte. */}
          {voted != null && envelopeGap && Math.abs(envelopeGap.value) >= 1 && (
            <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
              <strong>Enveloppe : {fmtEur(voted)} votés, {fmtEur(projectFin.planned)} répartis</strong> — écart {fmtSignedEur(envelopeGap.value)}
              {envelopeGap.percent != null && <> ({envelopeGap.percent > 0 ? "+" : ""}{envelopeGap.percent.toFixed(1)} %)</>}.
              Déplacer du budget d&apos;une ligne à l&apos;autre est normal ; le total, lui, correspond à un financement voté.
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            {[
              { label: "Voté", value: fmtEur(voted), color: "#17211D" },
              { label: "Prévu (hors valorisation)", value: fmtEur(projectFin.planned), color: "var(--brand-accent,#0E6B5C)" },
              { label: "Engagé (devis validés)", value: fmtEur(projectFin.engaged), color: "#3B5488" },
              { label: "Payé", value: fmtEur(projectFin.paid), color: "var(--brand-accent,#0E6B5C)" },
              { label: "Reste à engager", value: fmtEur(projectFin.remainingToCommit), color: "#66716B" },
              { label: "Valorisations", value: fmtEur(totalValorisation), color: "#8A6A1F" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-2xl border p-4" style={{ borderColor: "#E3E6E2" }}>
                <div className="text-lg font-bold" style={{ fontFamily: "var(--font-sora)", color }}>{value}</div>
                <div className="text-xs mt-1" style={{ color: "#66716B" }}>{label}</div>
              </div>
            ))}
          </div>
          {/* Consommation du projet : engagé et payé rapportés au prévu.
              Deux barres superposées plutôt que deux pourcentages : on
              voit d'un coup l'écart entre commander et régler. */}
          {projectFin.planned > 0 && (
            <div className="bg-white rounded-2xl border p-4 mb-6" style={{ borderColor: "#E3E6E2" }}>
              <div className="flex justify-between text-xs mb-1" style={{ color: "#66716B" }}>
                <span>Engagé — {Math.round((projectFin.engaged / projectFin.planned) * 100)} % du prévu</span>
                <span>Reste à payer {fmtEur(projectFin.remainingToPay)}</span>
              </div>
              <ProgressBar value={Math.min(100, Math.round((projectFin.engaged / projectFin.planned) * 100))} />
              <div className="text-xs mt-2 mb-1" style={{ color: "#66716B" }}>
                Payé — {Math.round((projectFin.paid / projectFin.planned) * 100)} % du prévu
              </div>
              <ProgressBar value={Math.min(100, Math.round((projectFin.paid / projectFin.planned) * 100))} />
            </div>
          )}
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
                  {["Poste", "Tâche financée", "Catégorie", "Financeur", "Année", "Prévu", "Engagé", "Payé", "Statut"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "#66716B" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              {/* Regroupé par phase, avec sous-total : la colonne « Phase »
                  répétée sur chaque ligne ne permettait pas de lire ce que
                  coûte une phase. */}
              {budgetGroups.map(group => (
                <tbody key={group.id}>
                  <tr style={{ background: "#EEF0EE", borderBottom: "1px solid #E3E6E2" }}>
                    <th scope="colgroup" colSpan={5} className="text-left px-4 py-2 text-xs font-semibold" style={{ color: "#17211D" }}>
                      {group.name}
                    </th>
                    {(() => {
                      // Sous-total de phase sur les trois montants : lire
                      // « prévu » sans « engagé » ne dit pas où en est
                      // l'exécution.
                      const gf = sumFinancials(group.lines.map((l: any) => finByLine.get(l.id) ?? EMPTY_FIN))
                      return (
                        <>
                          <td className="px-4 py-2 text-xs font-bold" style={{ color: "#17211D" }}>{fmtEur(gf.planned)}</td>
                          <td className="px-4 py-2 text-xs font-bold" style={{ color: "#3B5488" }}>{fmtEur(gf.engaged)}</td>
                          <td className="px-4 py-2 text-xs font-bold" style={{ color: "var(--brand-accent,#0E6B5C)" }}>{fmtEur(gf.paid)}</td>
                        </>
                      )
                    })()}
                    <td />
                  </tr>
                  {group.lines.map((l: any, i: number) => {
                    const ls = LINE_STATUS[l.status] ?? { label: l.status, fg: "#66716B", bg: "#EEF0EE" }
                    const lc = LINE_CATEGORIES[l.category] ?? { label: l.category, fg: "#66716B", bg: "#EEF0EE" }
                    return (
                      <tr key={l.id} style={{ borderBottom: "1px solid #E3E6E2", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                        <td className="px-4 py-3 font-medium" style={{ color: "#17211D" }}>
                          {l.poste}
                          {l.is_valorisation && <span className="ml-1 text-xs px-1.5 py-0.5 rounded" style={{ background: "#F5EFE2", color: "#8A6A1F" }}>Valorisation</span>}
                        </td>
                        {/* Une ligne peut se répartir sur plusieurs tâches :
                            on montre le détail, le montant par tâche étant
                            justement ce qui distingue ce modèle d'un 1:1. */}
                        <td className="px-4 py-3 text-xs" style={{ color: (l.allocations ?? []).length ? "#17211D" : "#9AA39D" }}>
                          {(l.allocations ?? []).length ? (
                            <ul className="space-y-0.5">
                              {(l.allocations as any[]).map((a: any) => (
                                <li key={a.task_id}>
                                  {a.task?.title ?? "—"}
                                  <span style={{ color: "#66716B" }}> · {fmtEur(a.amount)}</span>
                                </li>
                              ))}
                              {(() => {
                                const alloc = (l.allocations as any[]).reduce((s: number, a: any) => s + (a.amount ?? 0), 0)
                                const rest = (l.planned_amount ?? 0) - alloc
                                return rest > 0 ? <li style={{ color: "#9AA39D" }}>non affecté · {fmtEur(rest)}</li> : null
                              })()}
                            </ul>
                          ) : "—"}
                          {/* Création croisée : la ligne existe, la tâche
                              qu'elle finance reste à créer. Sans phase, une
                              tâche n'a nulle part où aller. */}
                          {canBudget && canTasks && l.phase_id && !l.is_valorisation && (
                            <div className="mt-1">
                              <CreateTaskFromLineButton projectId={id} lineId={l.id} poste={l.poste} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3"><Badge label={lc.label} fg={lc.fg} bg={lc.bg} /></td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#66716B" }}>{l.funder?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#66716B" }}>{l.year ?? "—"}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: "#17211D" }}>
                          {fmtEur(l.planned_amount)}
                          {/* Devis, factures et reçus de la ligne (PR 38b) :
                              c'est ici que « engagé » et « payé » prennent
                              leur source, agrégés par la PR 39. */}
                          <div className="mt-1 font-normal">
                            <BudgetLineDocuments projectId={id} phaseId={l.phase_id ?? null} lineId={l.id} poste={l.poste}
                              canManage={canBudget}
                              docs={(l.documents ?? []).map((d: any) => ({
                                id: d.id, filename: d.filename, type: d.type,
                                amount: d.amount ?? null, paid: !!d.paid, paid_at: d.paid_at ?? null,
                                validations: (d.validations ?? []).map((v: any) => {
                                  // Un échelon n'est actionnable que si tous
                                  // ceux qui le précèdent ont validé — même
                                  // règle que la policy 0041, pour ne pas
                                  // proposer un bouton que la base refusera.
                                  const step = v.step ?? 1
                                  const blocked = (d.validations ?? []).some((o: any) => (o.step ?? 1) < step && o.decision !== 'valide')
                                  return ({
                                  id: v.id, decision: v.decision, comment: v.comment ?? null,
                                  orgName: (Array.isArray(v.org) ? v.org[0]?.name : v.org?.name) ?? null,
                                  // Qui a tranché : « validé par LEY » et « validé par un
                                  // administrateur au nom de LEY » ne sont pas la même
                                  // affirmation devant un financeur.
                                  deciderName: (Array.isArray(v.decider) ? v.decider[0]?.full_name : v.decider?.full_name) ?? null,
                                  canDecide: myOrgIds.has(v.org_id) || isPlatformAdmin,
                                  isMember: myOrgIds.has(v.org_id),
                                  step, blocked,
                                })
                                }),
                              }))} />
                          </div>
                        </td>
                        {/* Engagé et payé (PR 39), calculés depuis les
                            pièces de la ligne. Grisés à zéro : rien
                            n'est engagé tant qu'aucun devis n'est validé. */}
                        <td className="px-4 py-3 text-xs" style={{ color: (finByLine.get(l.id)?.engaged ?? 0) > 0 ? "#3B5488" : "#9AA39D" }}>
                          {fmtEur(finByLine.get(l.id)?.engaged ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: (finByLine.get(l.id)?.paid ?? 0) > 0 ? "var(--brand-accent,#0E6B5C)" : "#9AA39D" }}>
                          {fmtEur(finByLine.get(l.id)?.paid ?? 0)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Badge label={ls.label} fg={ls.fg} bg={ls.bg} />
                            {canBudget && (
                              <BudgetLineDialog projectId={id} orgs={orgOptions} phases={phaseOptions} tasks={taskOptions} line={{
                                id: l.id, poste: l.poste, description: l.description ?? "",
                                category: l.category, funder_org_id: l.funder_org_id ?? "",
                                owner_org_id: l.owner_org_id ?? "", phase_id: l.phase_id ?? "",
                                allocations: (l.allocations ?? []).map((a: any) => ({ task_id: a.task_id, amount: String(a.amount ?? 0) })),
                                year: l.year != null ? String(l.year) : "", planned_amount: String(l.planned_amount ?? 0),
                                is_valorisation: !!l.is_valorisation, status: l.status, comment: l.comment ?? "",
                              }} />
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              ))}
            </table>
            {!(budgetLines ?? []).length && <div className="p-8 text-center text-sm" style={{ color: "#66716B" }}>Aucune ligne budgétaire</div>}
          </div>
        </div>
      )}

      {/* ===== DOCUMENTS (PR 38d) ===== */}
      {tab === "documents" && (
        <>
          {/* La convention de financement n'avait aucun point de dépôt :
              ni sur une tâche, à laquelle elle ne se rattache pas, ni sur
              une ligne budgétaire, puisqu'elle les couvre toutes. */}
          {canTasks && (
            <div className="flex justify-end mb-4">
              <ProjectDocUpload projectId={id}
                phases={(phases ?? []).map((p: any) => ({ id: p.id, name: p.name }))} />
            </div>
          )}
          <DocumentsPanel projectId={id} projectName={project.name} docs={projectDocs} canManage={canTasks} />
        </>
      )}

      {/* ===== IMPACT ===== */}
      {tab === "impact" && (
        <div>
          {canBudget && (
            <div className="flex justify-end mb-4">
              <IndicatorDialog projectId={id} phases={phaseOptions} />
            </div>
          )}
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
                  <span className="text-3xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "var(--brand-accent,#0E6B5C)" }}>
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
                <div className="mt-3">
                  <MeasureDialog indicatorId={ind.id} indicatorName={ind.name} unit={ind.unit ?? undefined} />
                </div>
              </div>
            )
          })}
          {!(indicators ?? []).length && <div className="col-span-3 text-center py-12 text-sm" style={{ color: "#66716B" }}>Aucun indicateur défini</div>}
        </div>
        </div>
      )}

      {/* ===== COPIL ===== */}
      {tab === "copil" && (
        <div className="space-y-4">
          {canMeetings && (
            <div className="flex justify-end">
              <MeetingDialog projectId={id} />
            </div>
          )}
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
                            {d.owner && <span className="text-xs" style={{ color: "#66716B" }}>{d.owner.full_name}</span>}
                            {d.due_date && <span className="text-xs" style={{ color: "#66716B" }}>{fmtDate(d.due_date)}</span>}
                            <Badge label={ds.label} fg={ds.fg} bg={ds.bg} />
                            {canMeetings && (
                              <DecisionDialog projectId={id} meetingId={m.id} members={memberOptions} decision={{
                                id: d.id, text: d.text, owner_user_id: d.owner_user_id ?? "",
                                due_date: d.due_date ?? "", status: d.status,
                              }} />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {canMeetings && (
                  <div className="px-5 pb-4">
                    <DecisionDialog projectId={id} meetingId={m.id} members={memberOptions} />
                  </div>
                )}
              </div>
            )
          })}
          {!(meetings ?? []).length && <div className="text-center py-12 text-sm" style={{ color: "#66716B" }}>Aucune réunion enregistrée</div>}
        </div>
      )}

      {/* ===== COMMUNICATION (PR 26) ===== */}
      {tab === "comm" && (
        commError ? (
          <div className="bg-white rounded-2xl border p-8 text-center text-sm" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
            Module Communication non activé : appliquez la migration <strong>0019_comm_campaigns.sql</strong> dans le SQL Editor Supabase.
          </div>
        ) : (
          <CommPanel projectId={id} campaigns={campaigns} members={memberOptions} canManage={canPhases} userId={user.id} />
        )
      )}

      {/* ===== AUDIT ===== */}
      {tab === "audit" && (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
          <div className="divide-y" style={{ borderColor: "#E3E6E2" }}>
            {(audit ?? []).map((a: any) => (
              <div key={a.id} className="px-5 py-3 flex items-start gap-4">
                <div className="flex-shrink-0 w-16 text-xs text-right" style={{ color: "#66716B" }}>
                  {new Date(a.at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>{a.action}</span>
                  {" "}
                  <span className="text-sm" style={{ color: "#17211D" }}>{a.label}</span>
                  {a.comment && <span className="text-xs ml-2" style={{ color: "#66716B" }}>· {a.comment}</span>}
                  <div className="text-xs mt-0.5" style={{ color: "#66716B" }}>par {a.profiles?.full_name ?? "—"}</div>
                </div>
              </div>
            ))}
            {!(audit ?? []).length && <div className="p-8 text-center text-sm" style={{ color: "#66716B" }}>Aucun événement enregistré</div>}
          </div>
        </div>
      )}
    </div>
  )
}
