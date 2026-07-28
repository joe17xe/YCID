export const dynamic = 'force-dynamic'
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { PROJECT_STATUS, PROJECT_ROLES, ACCESS_ROLES, TASK_STATUS, REVIEW_STATES, fmtEur, fmtDate, LINE_STATUS, LINE_CATEGORIES, IND_KINDS, DECISION_STATUS, MEETING_KINDS } from "@/lib/constants"
import { canEditCompletedTasks, getProjectRole } from "@/lib/permissions"
import { can, isAuditorSeat } from "@/lib/rbac"
import { TAB_HELP } from "@/lib/help-content"
import EditCompletedTaskDialog from "@/components/tasks/EditCompletedTaskDialog"
import PhaseDialog from "@/components/tasks/PhaseDialog"
import TaskDialog from "@/components/tasks/TaskDialog"
import { BudgetLineDialog, CreateTaskFromLineButton, IndicatorDialog, MeasureDialog, MeetingDialog, DecisionDialog } from "@/components/project/ProjectDataDialogs"
import TaskDocuments from "@/components/project/TaskDocuments"
import DeleteTaskButton from "@/components/tasks/DeleteTaskButton"
import BudgetLineDocuments from "@/components/project/BudgetLineDocuments"
import ProjectPulse from "@/components/project/ProjectPulse"
import { StatTile } from "@/components/ui/StatTile"
import NextSteps, { daysUntil, type StepTask } from "@/components/project/NextSteps"
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
import ProjectCitiesDialog from "@/components/project/ProjectCitiesDialog"
import MeetingRSVP from "@/components/project/MeetingRSVP"
import ProjectDocUpload from "@/components/project/ProjectDocUpload"
import { ChevronLeft, User, CalendarDays, MapPin, Download } from "lucide-react"

function Badge({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: fg, background: bg }}>{label}</span>
}

function ProgressBar({ value }: { value: number }) {
  return (
    // La piste est une marche CLAIRE de la même gamme que le
    // remplissage, pas un gris neutre : l'état se lit sur toute la
    // barre, pas seulement sur la partie remplie.
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--brand-accent-soft,#E4F0EC)" }}>
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: "var(--brand-accent,#0E6B5C)" }} />
    </div>
  )
}

// Journal paginé et filtrable (roadmap : « Le Journal s'arrête aux 20
// derniers événements, sans filtre. Pour un contrôleur : pagination,
// filtres par entité / personne / période »). Tout en LIENS et
// formulaire GET serveur — même mécanique que le tri du Pilotage,
// aucun état client. platform_settings et stockage n'apparaissent pas :
// leurs événements n'ont pas de projet.
const AUDIT_PAGE = 20
const AUDIT_ENTITIES: Record<string, string> = {
  project: "Projet", phase: "Phase", task: "Tâche", document: "Pièce",
  budget_line: "Ligne budgétaire", validation: "Validation", decision: "Décision",
  meeting: "Réunion", indicator: "Indicateur", indicator_measure: "Mesure",
  project_member: "Membre", campagne_ia: "Campagne IA", rapport_ia: "Rapport IA",
}
// « Lien vers l'objet concerné quand il existe encore » : on pointe
// l'ONGLET qui le porte — lui existe toujours, même si l'objet a été
// supprimé depuis. Un lien mort vers une tâche disparue serait pire
// que pas de lien.
const AUDIT_TAB: Record<string, string> = {
  phase: "taches", task: "taches", document: "documents",
  budget_line: "budget", validation: "budget",
  decision: "copil", meeting: "copil",
  indicator: "impact", indicator_measure: "impact",
  campagne_ia: "comm",
}

export default async function ProjetDetailPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ tab?: string, ligne?: string, jpage?: string, jent?: string, jqui?: string, jde?: string, jau?: string }> }) {
  const { id } = await params
  // Un onglet inconnu (?tab=journal au lieu de ?tab=audit, lien périmé,
  // faute de frappe) affichait une page entièrement vide : aucune
  // section ne correspondait, et rien ne le disait. On retombe sur
  // l'aperçu, comportement attendu d'une URL qui ne mène nulle part.
  const VALID_TABS = ["apercu", "taches", "budget", "documents", "impact", "copil", "comm", "audit"]
  const { tab: rawTab, ligne: ligneParam, jpage, jent, jqui, jde, jau } = await searchParams
  const tab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : "apercu"
  // Filtres du Journal — assainis : une entité inconnue ou une page
  // invalide retombent sur la vue par défaut, comme un onglet inconnu.
  const auditPage = Math.max(1, Math.floor(Number(jpage)) || 1)
  const auditEnt = jent && AUDIT_ENTITIES[jent] ? jent : ""
  const auditQui = (jqui ?? "").trim()
  const auditDe = /^\d{4}-\d{2}-\d{2}$/.test(jde ?? "") ? (jde as string) : ""
  const auditAu = /^\d{4}-\d{2}-\d{2}$/.test(jau ?? "") ? (jau as string) : ""
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const [{ data: project }, { data: phases }, { data: budgetLines }, { data: indicators }, { data: meetings }, { data: audit, count: auditCount }, { data: phasePhotos }, { data: allDocs }, canEditCompleted] = await Promise.all([
    supabase.from("projects").select("*, project_organizations(org_id, role, organizations(id, name, type)), project_members(user_id, role, profiles(id, full_name, email)), validation_rules(id, role, doc_type)").eq("id", id).single(),
    supabase.from("phases").select("*, tasks(*, profiles:assignee_id(full_name), documents(*))").eq("project_id", id).order("position"),
    supabase.from("budget_lines").select("*, funder:funder_org_id(name), owner:owner_org_id(name), phase:phase_id(name), allocations:budget_line_tasks(task_id, amount, task:task_id(title)), documents(id, filename, type, amount, paid, paid_at, uploaded_at, validations(id, org_id, decision, step, comment, org:org_id(name), decider:decided_by(full_name)))").eq("project_id", id).order("year"),
    supabase.from("indicators").select("*, measures:indicator_measures(*)").eq("project_id", id),
    supabase.from("meetings").select("*, decisions(*, owner:owner_user_id(full_name))").eq("project_id", id).order("date", { ascending: false }),
    // Journal : filtres + pagination (roadmap). Le compte exact vient
    // avec la page — une seule requête pour les deux.
    (() => {
      let q = supabase.from("audit_log")
        .select("*, profiles:user_id(full_name)", { count: "exact" })
        .eq("project_id", id)
      if (auditEnt) q = q.eq("entity", auditEnt)
      if (auditQui) q = q.eq("user_id", auditQui)
      if (auditDe) q = q.gte("at", auditDe)
      // Borne du jour INCLUSE : « au 28/07 » veut dire jusqu'au soir.
      if (auditAu) q = q.lte("at", `${auditAu}T23:59:59.999Z`)
      return q.order("at", { ascending: false }).range((auditPage - 1) * AUDIT_PAGE, auditPage * AUDIT_PAGE - 1)
    })(),
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

  // Villes du projet (0050). Requêtes TOLÉRANTES : tant que la
  // migration n'est pas passée elles échouent, et la fiche n'affiche
  // simplement ni la ligne ni le bouton « Villes » — jamais d'écran
  // cassé entre le déploiement du code et le passage du SQL.
  const [{ data: projectCityRows, error: pcErr }, { data: allCities, error: cErr }, { data: mpRows, error: mpErr }] = await Promise.all([
    supabase.from("project_cities").select("city_id, cities(id, name, country)").eq("project_id", id),
    supabase.from("cities").select("id, name, country").order("name"),
    // Invités des réunions (0051) — même dégradation douce : tant que
    // la migration n'est pas passée, l'onglet COPIL fonctionne comme
    // avant et le dialogue n'envoie aucun champ neuf.
    supabase.from("meeting_participants").select("meeting_id, user_id, response, responded_at"),
  ])
  const citiesReady = !pcErr && !cErr
  const participantsReady = !mpErr
  const participantsByMeeting = new Map<string, { user_id: string; response: string }[]>()
  if (participantsReady) {
    for (const r of mpRows ?? []) {
      const list = participantsByMeeting.get(r.meeting_id) ?? []
      list.push({ user_id: r.user_id, response: r.response })
      participantsByMeeting.set(r.meeting_id, list)
    }
  }
  const linkedCities: { id: string; name: string; country: string | null }[] = citiesReady
    ? (projectCityRows ?? []).flatMap(r => {
        const c = Array.isArray(r.cities) ? r.cities[0] : r.cities
        return c ? [{ id: c.id, name: c.name, country: c.country ?? null }] : []
      })
    : []

  // Droits d'édition : les admins (canEditCompleted couvre le même
  // périmètre) ou le rôle du membre dans ce projet.
  // Les droits se lisent dans lib/rbac.ts, seule liste à tenir juste.
  // Ces trois tableaux étaient recopiés ici, et l'écran des droits en
  // affichait une version qui avait fini par diverger.
  const myRole = await getProjectRole(supabase, user.id, id)
  const canPhases = canEditCompleted || can(myRole, "phases.manage")
  // Séparé de `phases.manage` le 27/07 : décider qui a accès au projet
  // n'est pas le même pouvoir que créer une phase.
  const canMembers = canEditCompleted || can(myRole, "membres.manage")
  // Le siège d'auditeur ne relève d'aucun rôle projet (0047) : le
  // contrôlé ne choisit pas son contrôleur.
  const canAuditorSeat = isPlatformAdmin
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
  // Nom d'un invité de réunion (0051) — via l'annuaire complet : un
  // invité retiré du projet depuis garde son nom sur la réunion.
  const profileName = new Map<string, string>((allProfiles ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, p.full_name ?? p.email ?? "—"]))
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
  // Répartition par financeur (spec §10.4) — « la vue qu'attend un
  // financeur ». Elle prend tout son sens depuis l'arbitrage du 27/07 :
  // le MEAE et le Département ne valident pas ligne à ligne, ils
  // attendent un COMPTE RENDU. C'est celui-ci.
  //
  // Les valorisations sont exclues, comme partout ailleurs : du
  // bénévolat et des locaux prêtés ne se paient pas, les mélanger à des
  // euros fausserait le taux de consommation de chaque financeur.
  //
  // Les lignes sans financeur sont regroupées à part plutôt qu'omises :
  // un montant prévu qui n'est rattaché à personne est une information,
  // pas un détail à masquer.
  const NO_FUNDER = '__sans__'
  const byFunder = new Map<string, { name: string; fin: Financials[] }>()
  for (const l of realLines as any[]) {
    const key = l.funder_org_id ?? NO_FUNDER
    const name = l.funder?.name ?? 'Non affecté'
    if (!byFunder.has(key)) byFunder.set(key, { name, fin: [] })
    byFunder.get(key)!.fin.push(finByLine.get(l.id) ?? EMPTY_FIN)
  }
  const funderRows = [...byFunder.entries()]
    .map(([key, v]) => ({ key, name: v.name, fin: sumFinancials(v.fin) }))
    // Le plus gros contributeur en tête ; « Non affecté » toujours en
    // dernier, quel que soit son montant — c'est un reliquat, pas un
    // financeur.
    .sort((a, b) => a.key === NO_FUNDER ? 1 : b.key === NO_FUNDER ? -1 : b.fin.planned - a.fin.planned)

  // ------------------------------------------------------------
  // Contributions en nature
  // ------------------------------------------------------------
  // La valorisation n'est pas un détail comptable : pour le MEAE elle
  // fait partie du COFINANCEMENT. Du bénévolat et des locaux prêtés
  // sont un apport réel du territoire, et souvent la part la plus
  // visible de l'engagement associatif.
  //
  // Elle est exclue des montants monétaires — on ne peut ni l'engager
  // ni la payer — mais l'exclure de partout revenait à la rendre
  // invisible : elle n'avait qu'une tuile et un badge.
  //
  // Regroupée par organisation CONTRIBUTRICE (`owner_org_id`), pas par
  // financeur : personne ne finance une valorisation, quelqu'un
  // l'apporte.
  const valoLines = (budgetLines ?? []).filter((l: any) => l.is_valorisation)
  const valoByOrg = new Map<string, { name: string; amount: number; lines: number; justified: number }>()
  for (const l of valoLines as any[]) {
    const key = l.owner_org_id ?? '__sans__'
    const name = l.owner?.name ?? 'Contributeur non renseigné'
    const row = valoByOrg.get(key) ?? { name, amount: 0, lines: 0, justified: 0 }
    row.amount += Number(l.planned_amount ?? 0)
    row.lines += 1
    // Une valorisation sans pièce est DÉCLARATIVE. Le MEAE exige des
    // feuilles d'émargement pour valoriser du bénévolat : compter les
    // lignes justifiées est donc une information de conformité, pas un
    // raffinement.
    if ((l.documents ?? []).length > 0) row.justified += 1
    valoByOrg.set(key, row)
  }
  const valoRows = [...valoByOrg.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => a.key === '__sans__' ? 1 : b.key === '__sans__' ? -1 : b.amount - a.amount)

  const totalValorisation = (budgetLines ?? []).filter((l: any) => l.is_valorisation)
    .reduce((s: number, l: any) => s + (l.planned_amount ?? 0), 0)
  // Le montant VOTÉ est la référence : la répartition entre lignes peut
  // bouger librement, l'enveloppe non (règle YCID du 25/07/2026).
  const voted = project.budget ?? null
  const envelopeGap = voted != null ? gap(projectFin.planned, voted) : null

  // ---- Le pouls du projet, et ce qui vient ensuite -----------------
  // « Pas de KPI, pas de vue globale, pas de prochaines étapes, pas de
  // propriétaire » (27/07). Tout existait dans la base ; rien n'était
  // remonté en tête. Ces trois calculs alimentent ProjectPulse et
  // NextSteps — la page n'en fabrique pas la mise en forme, elle fournit
  // les faits.
  const todayISO = new Date().toISOString().slice(0, 10)
  const steps: StepTask[] = (phases ?? []).flatMap((ph: any) =>
    (ph.tasks ?? []).map((t: any) => ({
      id: t.id, title: t.title, phaseName: ph.name,
      ownerName: t.profiles?.full_name ?? null,
      ownerIsMe: t.assignee_id === user.id,
      endDate: t.end_date ?? null, status: t.status, progress: t.progress ?? 0,
    })))
  const openSteps = steps.filter(t => t.status !== "terminee")
  const lateTasks = openSteps.filter(t => t.endDate && daysUntil(t.endDate, todayISO) < 0).length
  const nextDated = openSteps
    .filter(t => t.endDate)
    .sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)))[0]
  const nextDeadline = nextDated
    ? { title: nextDated.title, date: nextDated.endDate!, days: daysUntil(nextDated.endDate!, todayISO) }
    : null

  // Décisions ACTIONNABLES seulement : un échelon dont le tour n'est pas
  // venu n'est pas une tâche, c'est une attente. Le compter gonflerait
  // le chiffre sans donner de travail.
  const myDecisions = (budgetLines ?? []).reduce((n: number, l: any) =>
    n + (l.documents ?? []).reduce((m: number, d: any) => {
      const all = d.validations ?? []
      return m + all.filter((v: any) =>
        v.decision === 'en_attente'
        && (myOrgIds.has(v.org_id) || isPlatformAdmin)
        && !all.some((o: any) => (o.step ?? 1) < (v.step ?? 1) && o.decision !== 'valide')
      ).length
    }, 0), 0)
  // Le budget d'une tâche existe toujours : à défaut d'affectation, 0 €.
  const taskBudget = (taskId: string) => plannedByTask.get(taskId) ?? 0
  // Regroupement du tableau budgétaire : phases dans l'ordre du projet,
  // puis les lignes non rattachées. Les groupes vides sont omis.
  const budgetGroups = [
    ...(phases ?? []).map((ph: any) => ({ id: ph.id, name: ph.name, lines: linesByPhase.get(ph.id) ?? [] })),
    { id: "__hors_phase__", name: "Hors phase", lines: linesByPhase.get("__hors_phase__") ?? [] },
  ].filter(g => g.lines.length)

  // Le compteur est une DONNÉE, pas un morceau de libellé : « Tâches
  // (7) » tapé dans la chaîne se lisait comme du texte. Séparé, il
  // devient un badge dans la pastille.
  const TABS: { key: string; label: string; count?: number }[] = [
    { key: "apercu", label: "Aperçu" },
    { key: "taches", label: "Tâches", count: allTasks.length },
    { key: "budget", label: "Budget" },
    { key: "documents", label: "Documents", count: projectDocs.length || undefined },
    { key: "impact", label: "Impact" },
    { key: "copil", label: "COPIL" },
    { key: "comm", label: "Communication", count: campaigns.length || undefined },
    { key: "audit", label: "Journal" },
  ]

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
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
              lat: project.lat ?? null, lng: project.lng ?? null,
            }} organizations={orgOptions} />
          )}
          {canPhases && citiesReady && (
            <ProjectCitiesDialog projectId={id} linkedIds={linkedCities.map(c => c.id)}
              cities={(allCities ?? []).map(c => ({ id: c.id, name: c.name, country: c.country ?? null }))} />
          )}
          {canPhases && <PublicPageDialog projectId={id} token={project.public_token ?? null} />}
          <ExpertReportDialog projectId={id} projectName={project.name} />
          {canEditCompleted && <DeleteProjectButton projectId={id} projectName={project.name} />}
        </div>
      </div>

      {/* Sur un téléphone, cet en-tête occupait un écran entier avant
          le premier chiffre : titre sur trois lignes en 24 px,
          description en entier, et un « 48 650 € » flottant sans
          étiquette — on ne savait pas s'il s'agissait du voté, du prévu
          ou du dépensé. Le titre rétrécit, la description se limite à
          deux lignes, et le montant dit ce qu'il est. */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{project.name}</h1>
            <Badge label={s.label} fg={s.fg} bg={s.bg} />
            {project.programme && <Badge label={project.programme} fg="#6B4A8C" bg="#F0E9F5" />}
          </div>
          {project.description && (
            <p className="text-sm line-clamp-2 sm:line-clamp-none" style={{ color: "#66716B" }}>{project.description}</p>
          )}
          <div className="text-xs mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: "#66716B" }}>
            {project.country && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} aria-hidden="true" />
                {project.country}{project.zone ? ` — ${project.zone}` : ""}
              </span>
            )}
            {/* Les villes du projet (0050) : le travail est ENTRE des
                villes, la fiche les nomme toutes. */}
            {linkedCities.length > 0 && (
              <span>
                Villes : {linkedCities.map(c => c.name).join(" · ")}
              </span>
            )}
            {project.start_date && <span>{fmtDate(project.start_date)} → {fmtDate(project.end_date)}</span>}
            {project.budget != null && (
              <span>Montant voté <strong style={{ color: "#17211D" }}>{fmtEur(project.budget)}</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* Le pouls du projet. Remplace la barre « Avancement global »,
          qui occupait toute la largeur pour un seul chiffre — lequel ne
          disait ni si l'argent suivait, ni si quelque chose glissait, ni
          si une décision attendait quelqu'un. */}
      <ProjectPulse
        progress={projectProgress}
        voted={voted}
        planned={projectFin.planned}
        engaged={projectFin.engaged}
        paid={projectFin.paid}
        lateTasks={lateTasks}
        openTasks={openSteps.length}
        myDecisions={myDecisions}
        nextDeadline={nextDeadline}
      />


      {/* Onglets en pastilles pleines — le même langage que la roadmap
          et l'écran de configuration, pour que l'application converge
          sur UN idiome d'onglets au lieu de deux. La version
          soulignée, passée à la ligne le matin même, laissait trois
          rangées de texte clairsemé où seul un filet de deux pixels
          distinguait l'onglet actif : « du texte avec des chiffres »,
          pas des boutons. Ici chaque onglet est une pastille, l'actif
          est blanc sur fond gris, et le compteur est un badge. */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-2xl mb-6" style={{ background: "#EEF0EE" }}>
        {TABS.map(({ key, label, count }) => {
          const active = tab === key
          return (
            <Link
              key={key}
              href={`/projets/${id}?tab=${key}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
              style={{
                background: active ? "#FFFFFF" : "transparent",
                color: active ? "var(--brand-accent,#0E6B5C)" : "#66716B",
                boxShadow: active ? "0 1px 2px rgba(23,33,29,0.06)" : "none",
                fontFamily: "var(--font-inter)",
              }}
            >
              {label}
              {count != null && count > 0 && (
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                  style={active
                    ? { background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }
                    : { background: "#E3E6E2", color: "#66716B" }}>
                  {count}
                </span>
              )}
            </Link>
          )
        })}
        {TAB_HELP[tab] && (
          <span className="ml-auto self-center">
            <HelpDialog title={TAB_HELP[tab].title} excerpt={TAB_HELP[tab].excerpt} anchor={TAB_HELP[tab].anchor} />
          </span>
        )}
      </div>

      {/* ===== APERÇU ===== */}
      {tab === "apercu" && (
        <div className="space-y-6">
        {/* Ce qui vient d'abord, ce qui vient ensuite. L'aperçu ouvrait
            sur « Organisations (6) » : la donnée la plus stable du
            projet, celle qui ne demande aucune action, en position la
            plus visible. Les prochaines étapes passent devant. */}
        <NextSteps tasks={steps} today={todayISO} projectId={id} />
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
              {canMembers && (
                <span className="flex items-center gap-1.5">
                  <InviteUserDialog projectId={id} canAuditor={canAuditorSeat} />
                  <MemberDialog projectId={id} candidates={memberCandidates} canAuditor={canAuditorSeat} />
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
                      {/* Un auditeur ne se modifie ni ne se retire depuis
                          le projet, sauf par un administrateur : c'est
                          le contrôle du projet, pas un membre comme un
                          autre (0047). Le rôle reste lisible par tous —
                          masquer QUI contrôle serait le contraire du
                          but. */}
                      {canMembers && (!isAuditorSeat(pm.role) || canAuditorSeat)
                        ? <MemberRoleSelect projectId={id} userId={pm.user_id} name={pm.profiles?.full_name ?? ""} role={pm.role} canAuditor={canAuditorSeat} />
                        : <Badge label={r.short ?? r.label} fg={r.fg} bg={r.bg} />}
                      {canMembers && (!isAuditorSeat(pm.role) || canAuditorSeat) && (
                        <RemoveMemberButton projectId={id} userId={pm.user_id} name={pm.profiles?.full_name ?? ""} />
                      )}
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
          {/* Le découpage par phase répond à « comment le projet est
              organisé ». Il ne répond pas à « qu'est-ce qui glisse » :
              il fallait déplier chaque phase et comparer les dates de
              tête. Cette liste traverse les phases et donne l'ordre dans
              lequel les ouvrir. */}
          <NextSteps tasks={steps} today={todayISO} projectId={id} limit={8} />
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
                  {/* L'ancien en-tête empilait « 3 tâches / 26 600 € /
                      0 % pondéré / + Tâche » en colonne à droite du
                      titre : sur téléphone, une tour de chiffres sans
                      libellés. Le titre prend la largeur, l'action reste
                      en haut à droite, et les chiffres deviennent des
                      pastilles nommées qui passent à la ligne. */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <h3 className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{ph.name}</h3>
                      {canPhases && (
                        <PhaseDialog projectId={id} phase={{
                          id: ph.id, name: ph.name, start_date: ph.start_date ?? null,
                          end_date: ph.end_date ?? null, status: ph.status,
                        }} />
                      )}
                    </div>
                    {canTasks && <span className="flex-shrink-0"><TaskDialog phaseId={ph.id} members={memberOptions} /></span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
                    <span className="px-2 py-1 rounded-lg" style={{ background: "#F5F6F4", color: "#66716B" }}>
                      {phaseTasks.length} tâche{phaseTasks.length > 1 ? "s" : ""}
                    </span>
                    {phaseLinesTotal > 0 && (
                      <span className="px-2 py-1 rounded-lg" style={{ background: "#F5F6F4", color: "#66716B" }}
                        title="Somme des lignes budgétaires de la phase">
                        {fmtEur(phaseLinesTotal)}
                      </span>
                    )}
                    <span className="px-2 py-1 rounded-lg font-medium"
                      style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}
                      title={weighted
                        ? "Moyenne pondérée par le budget des tâches, avec un poids plancher de 2 % du budget de la phase : une tâche à 0 € compte tout de même, la phase ne peut donc pas afficher 100 % tant qu'elle n'est pas faite."
                        : "Moyenne des tâches, à parts égales — la phase n'a pas encore de budget réparti."}>
                      {phProg} %{weighted ? " pondéré" : ""}
                    </span>
                    {/* Preuve de réalisation (PR 38e) : compte agrégé,
                        pour qu'on n'ait pas à déplier chaque tâche. */}
                    {(() => {
                      const n = phaseTasks.filter((t: any) => t.status === "terminee" && !(t.documents ?? []).length).length
                      return n > 0 ? (
                        <span className="px-2 py-1 rounded-lg" style={{ background: "#F7EDDD", color: "#8A6A1F" }}
                          title="Tâches déclarées terminées sans aucune pièce justificative">
                          {n} sans justificatif
                        </span>
                      ) : null
                    })()}
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
                        {/* Le statut vivait dans une colonne fixe à
                            droite : elle comprimait la date sur trois
                            lignes et faisait flotter « À faire » hors de
                            la carte. Une tâche se lit désormais de haut
                            en bas — titre et statut, description, puis
                            les faits en pastilles qui passent à la ligne
                            au lieu de se compresser. Les emoji (👤 📅 💶)
                            cèdent la place aux icônes : rendu identique
                            partout, taille contrôlée. */}
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                              <span className="text-sm font-medium" style={{ color: "#17211D" }}>{t.title}</span>
                              <Badge label={ts.label} fg={ts.fg} bg={ts.bg} />
                              {rv && <Badge label={rv.label} fg={rv.fg} bg={rv.bg} />}
                            </div>
                            {t.description && <div className="text-xs mt-0.5 line-clamp-2" style={{ color: "#66716B" }}>{t.description}</div>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {t.status === "terminee" && canEditCompleted && (
                              <EditCompletedTaskDialog task={{
                                id: t.id, title: t.title, description: t.description ?? null,
                                status: t.status, progress: t.progress,
                                start_date: t.start_date ?? null, end_date: t.end_date ?? null,
                                comment: t.comment ?? null,
                              }} />
                            )}
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
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
                          {/* Une tâche sans nom en face est une tâche que
                              personne ne fera. Le blanc ne le disait pas ;
                              la pastille orange, si. */}
                          {t.profiles?.full_name
                            ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: "#F5F6F4", color: "#66716B" }}>
                                <User size={11} aria-hidden="true" /> {t.profiles.full_name}
                              </span>
                            )
                            : t.status !== "terminee" && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
                                <User size={11} aria-hidden="true" /> sans responsable
                              </span>
                            )}
                          {t.end_date && (() => {
                            const d = daysUntil(t.end_date, todayISO)
                            const late = t.status !== "terminee" && d < 0
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg"
                                style={late
                                  ? { background: "#FBEAEA", color: "#A3342C", fontWeight: 600 }
                                  : { background: "#F5F6F4", color: "#66716B" }}>
                                <CalendarDays size={11} aria-hidden="true" />
                                {fmtDate(t.end_date)}{late ? ` · ${Math.abs(d)} j de retard` : ""}
                              </span>
                            )
                          })()}
                          {/* Le compteur « N doc » existait depuis
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
                          <span className="px-2 py-1 rounded-lg"
                            title={taskBudget(t.id) > 0
                              ? "Somme affectée à cette tâche par les lignes budgétaires"
                              : "Aucune ligne budgétaire n'est affectée à cette tâche"}
                            style={{ background: "#F5F6F4", color: taskBudget(t.id) > 0 ? "var(--brand-accent,#0E6B5C)" : "#9AA39D", fontWeight: taskBudget(t.id) > 0 ? 600 : 400 }}>
                            {fmtEur(taskBudget(t.id))}
                          </span>
                          {/* Sens inverse de la création croisée : la
                              tâche existe, son financement reste à
                              saisir. Le dialogue s'ouvre déjà rattaché. */}
                          {canBudget && (
                            <BudgetLineDialog projectId={id} orgs={orgOptions} phases={phaseOptions} tasks={taskOptions}
                              preset={{ phase_id: ph.id, task_id: t.id }} triggerLabel="ligne" />
                          )}
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
          {/* « Rien ne montre qu'il y a un devis à valider, je dois
              cliquer sur toutes les lignes avec pièce » (27/07). Le
              décompte se lit ici, avant le tableau, et il ne compte que
              ce qui est ACTIONNABLE : un échelon dont le tour n'est pas
              venu n'est pas une tâche, c'est une attente. */}
          {(() => {
            const aDecider = myDecisions
            if (!aDecider) return null
            return (
              <div className="rounded-xl p-4 mb-4 text-sm flex flex-wrap items-center justify-between gap-3"
                style={{ background: "#FBF0E0", color: "#8A6A1F", border: "1px solid #E8D5AE" }}>
                <span>
                  <strong>{aDecider} décision{aDecider > 1 ? "s" : ""} vous {aDecider > 1 ? "attendent" : "attend"} sur ce projet.</strong>{" "}
                  Les lignes concernées portent une pastille « À valider ».
                </span>
                <Link href="/a-valider" className="px-3 py-1.5 rounded-xl text-white text-xs font-semibold flex-shrink-0"
                  style={{ background: "#B4690E" }}>
                  Tout voir
                </Link>
              </div>
            )
          })()}
          <div className="flex justify-end items-center gap-2 mb-4">
            {/* Export CSV (roadmap, priorisé le 28/07) : le compte
                rendu au Département et au MEAE se fait sur tableur.
                Mêmes règles de calcul que l'écran — la route s'appuie
                sur lib/budget.ts, source unique. Ouvert à qui VOIT le
                budget (l'auditeur exporte pour contrôler) : la RLS
                filtre, l'export n'ouvre rien de plus que l'onglet. */}
            <a href={`/projets/${id}/budget.csv`} download
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium"
              style={{ borderColor: "#E3E6E2", color: "#17211D" }}>
              <Download size={14} aria-hidden="true" /> Export CSV
            </a>
            {canBudget && <BudgetLineDialog projectId={id} orgs={orgOptions} phases={phaseOptions} tasks={taskOptions} />}
          </div>
          {/* Enveloppe votée (PR 39). La répartition entre lignes bouge
              librement ; c'est l'écart au montant VOTÉ qui alerte. */}
          {voted != null && envelopeGap && Math.abs(envelopeGap.value) >= 1 && (
            <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: "#F7EDDD", color: "#8A6A1F" }}>
              <strong>Enveloppe : {fmtEur(voted)} votés, {fmtEur(projectFin.planned)} répartis</strong> — écart {fmtSignedEur(envelopeGap.value)}
              {envelopeGap.percent != null && <> ({envelopeGap.percent > 0 ? "+" : ""}{envelopeGap.percent.toFixed(1)} %)</>}.
              Déplacer du budget d&apos;une ligne à l&apos;autre est normal ; le total, lui, correspond à un financement voté.
            </div>
          )}
          {/* Six tuiles de même poids visuel où « Voté » et « Payé » se
              valaient, alors que la seule question du COPIL est l'écart
              entre ce qui est voté et ce qui est consommé. Anatomie
              partagée (StatTile), et surtout : TOUTES les jauges sont
              rapportées à la même base — le montant voté quand il
              existe. La rangée devient une phrase : voté, dont tant de
              prévu, dont tant d'engagé, dont tant de payé. */}
          {(() => {
            const budgetBase = voted && voted > 0 ? voted : projectFin.planned
            const pctOf = (n: number) => budgetBase > 0 ? Math.round((n / budgetBase) * 100) : 0
            return (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 mb-6">
                <StatTile label="Voté" mark="#17211D"
                  value={voted != null ? fmtEur(voted) : "—"}
                  sub={voted != null ? "l'enveloppe de référence" : "aucun montant voté saisi"} />
                <StatTile label="Prévu (hors valorisation)" mark="var(--brand-accent,#0E6B5C)"
                  value={fmtEur(projectFin.planned)}
                  meter={{ pct: pctOf(projectFin.planned), fill: "var(--brand-accent,#0E6B5C)", track: "var(--brand-accent-soft,#E4F0EC)" }}
                  sub={voted != null ? `${pctOf(projectFin.planned)} % du voté réparti` : "réparti sur les lignes"} />
                <StatTile label="Engagé (devis validés)" mark="#3B5488"
                  value={fmtEur(projectFin.engaged)}
                  meter={{ pct: pctOf(projectFin.engaged), fill: "#3B5488", track: "#E8ECF5" }}
                  sub={`${pctOf(projectFin.engaged)} % de ${fmtEur(budgetBase)}`} />
                <StatTile label="Payé" mark="var(--brand-accent,#0E6B5C)"
                  value={fmtEur(projectFin.paid)}
                  meter={{ pct: pctOf(projectFin.paid), fill: "var(--brand-accent,#0E6B5C)", track: "var(--brand-accent-soft,#E4F0EC)" }}
                  sub={`reste ${fmtEur(Math.max(0, projectFin.engaged - projectFin.paid))} à régler`} />
                <StatTile label="Reste à engager" mark="#66716B"
                  value={fmtEur(projectFin.remainingToCommit)} />
                <StatTile label="Valorisations" mark="#8A6A1F"
                  value={fmtEur(totalValorisation)}
                  sub="apports en nature — hors enveloppe" />
              </div>
            )
          })()}
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
          {/* Répartition par financeur — la vue du compte rendu. Placée
              avant le détail : en COPIL on lit le total, puis qui finance
              quoi, puis seulement la ligne à la ligne. */}
          {funderRows.length > 0 && (
            <div className="bg-white rounded-2xl border overflow-hidden mb-6" style={{ borderColor: "#E3E6E2" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid #E3E6E2" }}>
                <h3 className="text-sm font-semibold" style={{ color: "#17211D" }}>Répartition par financeur</h3>
                <p className="text-xs mt-0.5" style={{ color: "#66716B" }}>
                  Hors valorisations. C&apos;est cette vue qui sert au compte rendu :
                  chaque financeur y lit ce qui a été prévu sur son enveloppe, engagé, et réglé.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-cards tc-560">
                  <thead>
                    <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
                      {["Financeur", "Prévu", "Engagé", "Payé", "Reste à engager", "Consommation"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: "#66716B" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {funderRows.map(r => {
                      const pct = r.fin.planned > 0 ? Math.round((r.fin.paid / r.fin.planned) * 100) : 0
                      const orphan = r.key === NO_FUNDER
                      return (
                        <tr key={r.key} style={{ borderBottom: "1px solid #F0F2F0" }}>
                          <td data-primary="" className="px-4 py-3" style={{ color: orphan ? "#B4690E" : "#17211D" }}>
                            {r.name}
                            {orphan && (
                              <span className="block text-xs" style={{ color: "#66716B" }}>
                                lignes sans financeur renseigné
                              </span>
                            )}
                          </td>
                          <td data-label="Prévu" className="px-4 py-3 font-semibold" style={{ color: "#17211D" }}>{fmtEur(r.fin.planned)}</td>
                          <td data-label="Engagé" className="px-4 py-3 text-xs" style={{ color: r.fin.engaged > 0 ? "#3B5488" : "#9AA39D" }}>{fmtEur(r.fin.engaged)}</td>
                          <td data-label="Payé" className="px-4 py-3 text-xs" style={{ color: r.fin.paid > 0 ? "var(--brand-accent,#0E6B5C)" : "#9AA39D" }}>{fmtEur(r.fin.paid)}</td>
                          <td data-label="Reste à engager" className="px-4 py-3 text-xs" style={{ color: "#66716B" }}>{fmtEur(r.fin.remainingToCommit)}</td>
                          <td data-label="Consommation" className="px-4 py-3">
                            <ProgressBar value={Math.min(100, pct)} />
                            <span className="text-xs" style={{ color: "#66716B" }}>{pct} % payé</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {/* Le total rappelle celui des tuiles : s'ils divergent,
                      c'est qu'une ligne échappe au regroupement. */}
                  <tfoot>
                    <tr style={{ background: "#F5F6F4", borderTop: "1px solid #E3E6E2" }}>
                      <th scope="row" className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: "#17211D" }}>Total</th>
                      <td data-label="Prévu" className="px-4 py-2.5 text-xs font-semibold" style={{ color: "#17211D" }}>{fmtEur(projectFin.planned)}</td>
                      <td data-label="Engagé" className="px-4 py-2.5 text-xs font-semibold" style={{ color: "#17211D" }}>{fmtEur(projectFin.engaged)}</td>
                      <td data-label="Payé" className="px-4 py-2.5 text-xs font-semibold" style={{ color: "#17211D" }}>{fmtEur(projectFin.paid)}</td>
                      <td data-label="Reste à engager" className="px-4 py-2.5 text-xs font-semibold" style={{ color: "#17211D" }}>{fmtEur(projectFin.remainingToCommit)}</td>
                      <td data-label="Consommation" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Contributions en nature. Elles ne sont ni engagées ni
              payées — elles sont APPORTÉES. Leur donner un tableau à
              part, plutôt qu'une tuile, c'est reconnaître qu'elles font
              partie du cofinancement et non du reliquat. */}
          {valoRows.length > 0 && (() => {
            const coutTotal = projectFin.planned + totalValorisation
            const partNature = coutTotal > 0 ? Math.round((totalValorisation / coutTotal) * 100) : 0
            const nonJustifiees = valoLines.length - valoRows.reduce((s, r) => s + r.justified, 0)
            return (
              <div className="bg-white rounded-2xl border overflow-hidden mb-6" style={{ borderColor: "#E3E6E2" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid #E3E6E2" }}>
                  <h3 className="text-sm font-semibold" style={{ color: "#17211D" }}>Contributions en nature</h3>
                  {/* Le coût total du projet — monétaire + nature — n'était
                      affiché nulle part. C'est pourtant le chiffre que lit
                      un financeur : ce que le projet représente réellement. */}
                  <p className="text-xs mt-0.5" style={{ color: "#66716B" }}>
                    Coût total du projet <strong style={{ color: "#17211D" }}>{fmtEur(coutTotal)}</strong> —
                    dont <strong style={{ color: "#8A6A1F" }}>{fmtEur(totalValorisation)}</strong> apportés
                    en nature, soit <strong style={{ color: "#8A6A1F" }}>{partNature} %</strong>.
                    Bénévolat, locaux et matériel prêtés : ils ne se paient pas, mais ils comptent
                    dans le cofinancement.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-cards tc-560">
                    <thead>
                      <tr style={{ background: "#F5F6F4", borderBottom: "1px solid #E3E6E2" }}>
                        {["Organisation contributrice", "Montant valorisé", "Part du coût total", "Lignes", "Justifiées"].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: "#66716B" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {valoRows.map(r => {
                        const part = coutTotal > 0 ? Math.round((r.amount / coutTotal) * 100) : 0
                        const orphan = r.key === "__sans__"
                        return (
                          <tr key={r.key} style={{ borderBottom: "1px solid #F0F2F0" }}>
                            <td data-primary="" className="px-4 py-3" style={{ color: orphan ? "#B4690E" : "#17211D" }}>{r.name}</td>
                            <td data-label="Montant valorisé" className="px-4 py-3 font-semibold" style={{ color: "#8A6A1F" }}>{fmtEur(r.amount)}</td>
                            <td data-label="Part du coût total" className="px-4 py-3 text-xs" style={{ color: "#66716B" }}>{part} %</td>
                            <td data-label="Lignes" className="px-4 py-3 text-xs" style={{ color: "#66716B" }}>{r.lines}</td>
                            <td data-label="Justifiées" className="px-4 py-3 text-xs"
                              style={{ color: r.justified === r.lines ? "var(--brand-accent,#0E6B5C)" : "#B4690E" }}>
                              {r.justified} / {r.lines}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Une valorisation sans pièce est DÉCLARATIVE. Le MEAE
                    exige des feuilles d'émargement pour valoriser du
                    bénévolat : le signaler ici évite de le découvrir au
                    contrôle. */}
                {nonJustifiees > 0 && (
                  <div className="px-4 py-3 text-xs" style={{ background: "#F7EDDD", color: "#8A6A1F", borderTop: "1px solid #E3E6E2" }}>
                    <strong>{nonJustifiees} contribution{nonJustifiees > 1 ? "s" : ""} sans pièce justificative.</strong>{" "}
                    Une valorisation non documentée reste déclarative : un financeur peut la
                    refuser au moment du contrôle. Déposez les feuilles d&apos;émargement,
                    conventions de mise à disposition ou attestations sur la ligne concernée,
                    par le bouton « Pièces ».
                  </div>
                )}
              </div>
            )
          })()}

          {/* Le tableau des lignes n'avait AUCUN défilement horizontal :
              sur téléphone il débordait de la page, et la colonne
              « Prévu » — qui porte l'accès aux pièces — devenait
              inatteignable. Constaté en recette : un devis ne pouvait pas
              être déposé depuis un mobile. */}
          <div className="bg-white rounded-2xl border overflow-x-auto" style={{ borderColor: "#E3E6E2" }}>
            {/* `table-cards` : sous 640 px chaque ligne devient un bloc et
                chaque cellule porte son intitulé (voir globals.css). Un
                seul balisage — rendre en plus une liste de cartes aurait
                recréé la divergence que ce dépôt a déjà payée trois
                fois. */}
            <table className="w-full text-sm table-cards tc-760">
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
                  <tr data-group="" style={{ background: "#EEF0EE", borderBottom: "1px solid #E3E6E2" }}>
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
                          <td data-label="Prévu" className="px-4 py-2 text-xs font-bold" style={{ color: "#17211D" }}>{fmtEur(gf.planned)}</td>
                          <td data-label="Engagé" className="px-4 py-2 text-xs font-bold" style={{ color: "#3B5488" }}>{fmtEur(gf.engaged)}</td>
                          <td data-label="Payé" className="px-4 py-2 text-xs font-bold" style={{ color: "var(--brand-accent,#0E6B5C)" }}>{fmtEur(gf.paid)}</td>
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
                        <td data-primary="" className="px-4 py-3 font-medium" style={{ color: "#17211D" }}>
                          {l.poste}
                          {l.is_valorisation && <span className="ml-1 text-xs px-1.5 py-0.5 rounded" style={{ background: "#F5EFE2", color: "#8A6A1F" }}>Valorisation</span>}
                        </td>
                        {/* Une ligne peut se répartir sur plusieurs tâches :
                            on montre le détail, le montant par tâche étant
                            justement ce qui distingue ce modèle d'un 1:1. */}
                        <td data-label="Tâche financée" className="px-4 py-3 text-xs" style={{ color: (l.allocations ?? []).length ? "#17211D" : "#9AA39D" }}>
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
                        <td data-label="Catégorie" className="px-4 py-3"><Badge label={lc.label} fg={lc.fg} bg={lc.bg} /></td>
                        <td data-label="Financeur" className="px-4 py-3 text-xs" style={{ color: "#66716B" }}>{l.funder?.name ?? "—"}</td>
                        <td data-label="Année" className="px-4 py-3 text-xs" style={{ color: "#66716B" }}>{l.year ?? "—"}</td>
                        <td data-label="Prévu" className="px-4 py-3 font-semibold" style={{ color: "#17211D" }}>
                          {fmtEur(l.planned_amount)}
                          {/* Devis, factures et reçus de la ligne (PR 38b) :
                              c'est ici que « engagé » et « payé » prennent
                              leur source, agrégés par la PR 39. */}
                          <div className="mt-1 font-normal">
                            <BudgetLineDocuments projectId={id} phaseId={l.phase_id ?? null} lineId={l.id} poste={l.poste}
                              canManage={canBudget}
                              /* Lien direct depuis une notification ou la file
                                 « À valider » : la ligne visée s'ouvre seule. */
                              autoOpen={!!ligneParam && l.id === ligneParam}
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
                        <td data-label="Engagé" className="px-4 py-3 text-xs" style={{ color: (finByLine.get(l.id)?.engaged ?? 0) > 0 ? "#3B5488" : "#9AA39D" }}>
                          {fmtEur(finByLine.get(l.id)?.engaged ?? 0)}
                        </td>
                        <td data-label="Payé" className="px-4 py-3 text-xs" style={{ color: (finByLine.get(l.id)?.paid ?? 0) > 0 ? "var(--brand-accent,#0E6B5C)" : "#9AA39D" }}>
                          {fmtEur(finByLine.get(l.id)?.paid ?? 0)}
                        </td>
                        <td data-label="Statut" className="px-4 py-3">
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
            <div className="flex flex-col items-end gap-1">
              <MeetingDialog projectId={id} members={memberOptions} participantsReady={participantsReady} />
              {!participantsReady && (
                <p className="text-xs" style={{ color: "#66716B" }}>
                  Invitations et réponses : appliquez la migration <strong>0051_meeting_participants.sql</strong> dans le SQL Editor Supabase.
                </p>
              )}
            </div>
          )}
          {(meetings ?? []).map((m: any) => {
            const mk = MEETING_KINDS[m.kind] ?? { label: m.kind, fg: "#66716B", bg: "#EEF0EE" }
            const invitees = participantsByMeeting.get(m.id) ?? []
            const mine = invitees.find(p => p.user_id === user.id)
            return (
              <div key={m.id} className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
                <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "#E3E6E2" }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge label={mk.label} fg={mk.fg} bg={mk.bg} />
                      <span className="font-semibold" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>{m.title}</span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: "#66716B" }}>
                      {fmtDate(m.date)}
                      {m.start_time ? ` · ${String(m.start_time).slice(0, 5)}` : ""}
                      {m.location ? ` · ${m.location}` : ""}
                    </div>
                  </div>
                  {(m.decisions ?? []).length > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#E8ECF5", color: "#3B5488" }}>
                      {m.decisions.length} décision{m.decisions.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {/* Invités et réponses (0051) : chaque pastille porte un
                    nom, sa couleur dit la réponse — acceptée (accent),
                    refusée (rouge), en attente (neutre). L'invité
                    connecté répond ici même. */}
                {invitees.length > 0 && (
                  <div className="px-5 py-3 border-b space-y-2" style={{ borderColor: "#E3E6E2" }}>
                    <div className="flex flex-wrap gap-1.5">
                      {invitees.map(p => {
                        const st = p.response === "acceptee"
                          ? { fg: "var(--brand-accent,#0E6B5C)", bg: "var(--brand-accent-soft,#E4F0EC)", label: "acceptée" }
                          : p.response === "refusee"
                            ? { fg: "#A3342C", bg: "#F6E7E5", label: "refusée" }
                            : { fg: "#66716B", bg: "#EEF0EE", label: "en attente" }
                        return (
                          <span key={p.user_id} className="text-xs px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.fg }}
                            title={`Invitation ${st.label}`}>
                            {profileName.get(p.user_id) ?? "—"}
                          </span>
                        )
                      })}
                    </div>
                    {mine && (
                      <MeetingRSVP projectId={id} meetingId={m.id} current={mine.response} />
                    )}
                  </div>
                )}
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
      {tab === "audit" && (() => {
        const filtered = !!(auditEnt || auditQui || auditDe || auditAu)
        const total = auditCount ?? (audit ?? []).length
        const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE))
        // Les liens de pagination CONSERVENT les filtres : changer de
        // page ne doit pas faire perdre la question posée.
        const auditHref = (page: number) => {
          const q = new URLSearchParams({ tab: "audit" })
          if (auditEnt) q.set("jent", auditEnt)
          if (auditQui) q.set("jqui", auditQui)
          if (auditDe) q.set("jde", auditDe)
          if (auditAu) q.set("jau", auditAu)
          if (page > 1) q.set("jpage", String(page))
          return `/projets/${id}?${q.toString()}`
        }
        const filterInput = "px-2.5 py-1.5 rounded-xl border text-xs"
        return (
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E2" }}>
            {/* Filtres en GET pur : le formulaire recharge la page avec
                ses paramètres, aucun état client — la même mécanique que
                le tri du Pilotage. Une URL filtrée se partage. */}
            <form method="get" className="px-5 py-3 border-b flex flex-wrap items-center gap-2" style={{ borderColor: "#E3E6E2" }}>
              <input type="hidden" name="tab" value="audit" />
              <label className="sr-only" htmlFor="j-ent">Entité</label>
              <select id="j-ent" name="jent" defaultValue={auditEnt} className={filterInput} style={{ borderColor: "#E3E6E2", color: "#17211D" }}>
                <option value="">Toutes les entités</option>
                {Object.entries(AUDIT_ENTITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <label className="sr-only" htmlFor="j-qui">Personne</label>
              <select id="j-qui" name="jqui" defaultValue={auditQui} className={filterInput} style={{ borderColor: "#E3E6E2", color: "#17211D" }}>
                <option value="">Tout le monde</option>
                {memberOptions.map((m: { id: string; name: string }) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <label htmlFor="j-de" className="text-xs" style={{ color: "#66716B" }}>Du</label>
              <input id="j-de" type="date" name="jde" defaultValue={auditDe} className={filterInput} style={{ borderColor: "#E3E6E2", color: "#17211D" }} />
              <label htmlFor="j-au" className="text-xs" style={{ color: "#66716B" }}>au</label>
              <input id="j-au" type="date" name="jau" defaultValue={auditAu} className={filterInput} style={{ borderColor: "#E3E6E2", color: "#17211D" }} />
              <button type="submit" className="px-3 py-1.5 rounded-xl text-white text-xs font-semibold" style={{ background: "var(--brand-accent,#0E6B5C)" }}>
                Filtrer
              </button>
              {filtered && (
                <Link href={`/projets/${id}?tab=audit`} className="text-xs" style={{ color: "#66716B" }}>Réinitialiser</Link>
              )}
            </form>
            <div className="divide-y" style={{ borderColor: "#E3E6E2" }}>
              {(audit ?? []).map((a: any) => {
                const entLabel = AUDIT_ENTITIES[a.entity] ?? a.entity
                const entTab = AUDIT_TAB[a.entity]
                return (
                  <div key={a.id} className="px-5 py-3 flex items-start gap-4">
                    <div className="flex-shrink-0 w-16 text-xs text-right" style={{ color: "#66716B" }}>
                      {new Date(a.at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: "var(--brand-accent-soft,#E4F0EC)", color: "var(--brand-accent,#0E6B5C)" }}>{a.action}</span>
                      {" "}
                      <span className="text-sm" style={{ color: "#17211D" }}>{a.label}</span>
                      {a.comment && <span className="text-xs ml-2" style={{ color: "#66716B" }}>· {a.comment}</span>}
                      <div className="text-xs mt-0.5" style={{ color: "#66716B" }}>
                        par {a.profiles?.full_name ?? "—"}
                        {/* Le lien pointe l'ONGLET qui porte l'entité —
                            lui existe toujours, même si l'objet a été
                            supprimé depuis. */}
                        {entTab ? (
                          <> · <Link href={`/projets/${id}?tab=${entTab}`} className="hover:underline" style={{ color: "var(--brand-accent,#0E6B5C)" }}>{entLabel}</Link></>
                        ) : (
                          <> · {entLabel}</>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {!(audit ?? []).length && (
                <div className="p-8 text-center text-sm" style={{ color: "#66716B" }}>
                  {filtered ? "Aucun événement ne correspond aux filtres." : "Aucun événement enregistré"}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t flex items-center justify-between text-xs" style={{ borderColor: "#E3E6E2", color: "#66716B" }}>
              <span>{total} événement{total > 1 ? "s" : ""} · page {auditPage} / {totalPages}</span>
              <div className="flex items-center gap-3">
                {auditPage > 1 && (
                  <Link href={auditHref(auditPage - 1)} className="font-medium" style={{ color: "var(--brand-accent,#0E6B5C)" }}>← Précédente</Link>
                )}
                {auditPage < totalPages && (
                  <Link href={auditHref(auditPage + 1)} className="font-medium" style={{ color: "var(--brand-accent,#0E6B5C)" }}>Suivante →</Link>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
