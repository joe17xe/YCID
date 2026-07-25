'use server'

import { createClient } from '@/lib/supabase/server'
import { getProjectRole, isUserAdmin } from '@/lib/permissions'
import { chatComplete } from '@/lib/llm'

// ============================================================
// PR 25 — Rapport d'expert IA
// ============================================================
// Rassemble TOUTES les données réelles du projet (la seule source de
// vérité), les fournit au LLM avec interdiction d'inventer des chiffres,
// et retourne un rapport d'expert structuré en Markdown.

interface ReportResult {
  ok: boolean
  report?: string
  error?: string
  truncated?: boolean
  model?: string
  reportId?: string
}

export interface ReportSummary {
  id: string
  createdAt: string
  model: string | null
  instructions: string | null
  truncated: boolean
  authorName: string
}

// `instructions` : consignes libres du chef de projet ou de l'expert
// local (contexte terrain, angle attendu, points à approfondir).
export async function generateExpertReport(projectId: string, instructions?: string): Promise<ReportResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Non authentifié.' }

    const [role, admin] = await Promise.all([
      getProjectRole(supabase, user.id, projectId),
      isUserAdmin(supabase, user.id),
    ])
    if (!role && !admin) return { ok: false, error: 'Rapport réservé aux membres du projet et aux admins.' }

    // --- Collecte des données réelles ---
    const [
      { data: project },
      { data: orgs },
      { data: phases },
      { data: docs },
      { data: budget },
      { data: indicators },
      { data: measures },
      { data: meetings },
      { data: decisions },
      { data: members },
    ] = await Promise.all([
      supabase.from('projects').select('name, description, country, zone, start_date, end_date, status, budget, currency').eq('id', projectId).maybeSingle(),
      supabase.from('project_organizations').select('role, organizations:org_id(name, type)').eq('project_id', projectId),
      supabase.from('phases').select('id, name, position, start_date, end_date, status, budget, tasks(id, title, status, progress, start_date, end_date, assignee_id)').eq('project_id', projectId).order('position'),
      // Pièces justificatives (PR 38e). Un rapport adossé à des preuves
      // datées vaut mieux qu'un rapport adossé à des pourcentages
      // déclaratifs — et l'absence de preuve sur une tâche déclarée
      // terminée est en soi une information de pilotage.
      supabase.from('documents').select('id, type, moment, phase_id, task_id, uploaded_at').eq('project_id', projectId),
      // phase_id et la répartition sont indispensables : sans eux le
      // modèle ne peut structurellement pas rapprocher une ligne de sa
      // phase ni des tâches qu'elle finance, donc pas commenter le
      // moindre écart.
      supabase.from('budget_lines').select('poste, category, year, planned_amount, is_valorisation, status, phase_id, allocations:budget_line_tasks(task_id, amount)').eq('project_id', projectId),
      supabase.from('indicators').select('id, name, kind, unit, baseline, target').eq('project_id', projectId),
      supabase.from('indicator_measures').select('indicator_id, period, value').order('period'),
      supabase.from('meetings').select('title, kind, date, minutes').eq('project_id', projectId).order('date', { ascending: false }).limit(10),
      supabase.from('decisions').select('label, status, due_date').eq('project_id', projectId).limit(20),
      supabase.from('project_members').select('role', { count: 'exact' }).eq('project_id', projectId),
    ])
    if (!project) return { ok: false, error: 'Projet introuvable.' }

    const today = new Date().toISOString().slice(0, 10)
    const indicatorIds = new Set((indicators ?? []).map(i => i.id))
    const projectMeasures = (measures ?? []).filter(m => indicatorIds.has(m.indicator_id))

    // Rattachement budget ↔ phases ↔ tâches (PR 40). On résout les
    // identifiants en libellés : des UUID dans le digest ne seraient que
    // du bruit pour le modèle.
    const phaseNameById = new Map<string, string>()
    const taskTitleById = new Map<string, string>()
    for (const p of phases ?? []) {
      phaseNameById.set(p.id, p.name)
      for (const t of (p.tasks ?? []) as { id: string; title: string }[]) taskTitleById.set(t.id, t.title)
    }
    // Pièces par tâche et par phase (PR 38e). Les pièces de phase sont
    // celles sans tâche : sinon chaque justificatif serait compté deux
    // fois, la tâche portant aussi le phase_id.
    const docsByTask = new Map<string, { type: string; uploaded_at: string }[]>()
    const docsByPhase = new Map<string, { type: string; moment: string | null }[]>()
    for (const d of (docs ?? []) as { type: string; moment: string | null; phase_id: string | null; task_id: string | null; uploaded_at: string }[]) {
      if (d.task_id) {
        docsByTask.set(d.task_id, [...(docsByTask.get(d.task_id) ?? []), { type: d.type, uploaded_at: d.uploaded_at }])
      } else if (d.phase_id) {
        docsByPhase.set(d.phase_id, [...(docsByPhase.get(d.phase_id) ?? []), { type: d.type, moment: d.moment }])
      }
    }

    const plannedByTask = new Map<string, number>()
    const plannedByPhase = new Map<string, number>()
    for (const l of budget ?? []) {
      const amount = l.planned_amount ?? 0
      for (const a of (l.allocations ?? []) as { task_id: string; amount: number }[]) {
        plannedByTask.set(a.task_id, (plannedByTask.get(a.task_id) ?? 0) + (a.amount ?? 0))
      }
      if (l.phase_id) plannedByPhase.set(l.phase_id, (plannedByPhase.get(l.phase_id) ?? 0) + amount)
    }

    // Digest compact : seules ces données peuvent être citées par l'IA
    const digest = {
      date_du_jour: today,
      projet: project,
      organisations: (orgs ?? []).map(o => ({ role: o.role, org: o.organizations })),
      nb_membres: (members ?? []).length,
      phases: (phases ?? []).map(p => ({
        nom: p.name, statut: p.status, debut: p.start_date, fin: p.end_date,
        // Deux montants distincts, à ne pas confondre : celui saisi sur la
        // phase, et la somme réelle des lignes qui lui sont rattachées.
        budget_saisi_sur_la_phase: p.budget,
        budget_somme_des_lignes: plannedByPhase.get(p.id) ?? 0,
        // Photos de terrain : c'est la comparaison avant / après qui
        // documente une réalisation, pas leur nombre total.
        photos_avant: (docsByPhase.get(p.id) ?? []).filter(d => d.type === 'photo' && d.moment === 'avant').length,
        photos_apres: (docsByPhase.get(p.id) ?? []).filter(d => d.type === 'photo' && d.moment === 'apres').length,
        pieces_de_la_phase: (docsByPhase.get(p.id) ?? []).length,
        taches: (p.tasks ?? []).map((t: { id: string; title: string; status: string; progress: number; end_date: string | null }) => {
          const pieces = docsByTask.get(t.id) ?? []
          return {
            titre: t.title, statut: t.status, avancement: t.progress, echeance: t.end_date,
            // Toujours un nombre : 0 signifie « aucun budget affecté », ce
            // qui est une information, pas une donnée manquante.
            budget_prevu: plannedByTask.get(t.id) ?? 0,
            en_retard: !!(t.end_date && t.end_date < today && t.status !== 'terminee'),
            nb_pieces_justificatives: pieces.length,
            natures_des_pieces: Array.from(new Set(pieces.map(d => d.type))),
            // Déclarée faite sans aucune pièce : le modèle doit pouvoir
            // le signaler plutôt que de prendre le pourcentage pour argent
            // comptant.
            terminee_sans_justificatif: t.status === 'terminee' && pieces.length === 0,
          }
        }),
      })),
      lignes_budgetaires: (budget ?? []).map(l => ({
        poste: l.poste, categorie: l.category, annee: l.year,
        montant_prevu: l.planned_amount, valorisation: l.is_valorisation, statut: l.status,
        phase: l.phase_id ? phaseNameById.get(l.phase_id) ?? null : null,
        // Répartition : une même ligne peut financer plusieurs tâches
        // pour des montants distincts (40 000 € = 10 000 € + 30 000 €).
        repartition_par_tache: ((l.allocations ?? []) as { task_id: string; amount: number }[]).map(a => ({
          tache: taskTitleById.get(a.task_id) ?? null, montant: a.amount,
        })),
        montant_non_affecte: (l.planned_amount ?? 0) - ((l.allocations ?? []) as { amount: number }[]).reduce((s, a) => s + (a.amount ?? 0), 0),
      })),
      indicateurs: (indicators ?? []).map(i => ({
        nom: i.name, type: i.kind, unite: i.unit, reference: i.baseline, cible: i.target,
        mesures: projectMeasures.filter(m => m.indicator_id === i.id).map(m => ({ periode: m.period, valeur: m.value })),
      })),
      reunions_recentes: meetings ?? [],
      decisions: decisions ?? [],
    }

    const system = `Tu es un expert-consultant senior en pilotage de projets de solidarité internationale, mandaté par un financeur public français (YCID, Département des Yvelines, programme CEM).
Tu rédiges en français, de façon factuelle, professionnelle et directement exploitable en comité de pilotage (COPIL).
RÈGLES ABSOLUES :
- Utilise UNIQUEMENT les chiffres et faits présents dans les données fournies. N'invente JAMAIS un chiffre, une date ou un fait.
- Quand une donnée manque, écris « donnée non renseignée » ET signale explicitement que la conclusion n'est pas étayée.
- Mets en évidence les écarts, retards et risques réels visibles dans les données.
- Distingue ce qui est DÉCLARÉ de ce qui est PROUVÉ : une tâche à 100 % sans pièce justificative (« terminee_sans_justificatif ») est un avancement déclaratif, à signaler comme tel. Une phase sans photo « avant » ni « après » ne documente pas sa réalisation.
- N'écris AUCUNE consigne, instruction ni commentaire de méthode dans le document.
- Markdown sobre : titres de niveau 2, listes à puces, gras pour les alertes. Pas d'italique.
Emploie EXACTEMENT ces titres de section, sans rien ajouter entre parenthèses :
## 1. Synthèse exécutive
## 2. Avancement du projet
## 3. Analyse budgétaire
## 4. Indicateurs et impact
## 5. Gouvernance
## 6. Risques et alertes
## 7. Recommandations pour le COPIL
Ne commence pas par un titre de niveau 1 : il est ajouté par l'application.`

    const consigne = (instructions ?? '').trim().slice(0, 2000)
    const result = await chatComplete({
      system,
      user: [
        consigne ? `Consignes du chef de projet / de l'expert local, à respecter en priorité :\n${consigne}\n` : '',
        `Données réelles du projet (JSON) :\n${JSON.stringify(digest, null, 1)}`,
      ].filter(Boolean).join('\n'),
      temperature: 0.2,
      maxTokens: 12_000,
    })
    if (!result.ok) {
      // Les ÉCHECS sont tracés eux aussi : sans cela, impossible de
      // mesurer un taux d'échec en production.
      await supabase.from('audit_log').insert({
        project_id: projectId, entity: 'rapport_ia', entity_id: null,
        label: project.name, action: 'cree', user_id: user.id,
        comment: `Échec de génération du rapport — ${result.error ?? 'cause inconnue'}`,
      })
      return { ok: false, error: result.error }
    }

    // En-tête de traçabilité imposé par l'APPLICATION (jamais par le
    // modèle) : indispensable pour une pièce annexée à un rapport
    // destiné à un financeur public.
    const stamp = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
    const header = [
      `# Rapport d'expertise — ${project.name}`,
      '',
      `Généré le ${stamp} · modèle ${result.model ?? 'inconnu'} · données arrêtées au ${today}`,
      `Périmètre analysé : ${(phases ?? []).length} phase(s), ${(budget ?? []).length} ligne(s) budgétaire(s), ${(indicators ?? []).length} indicateur(s), ${(meetings ?? []).length} réunion(s), ${(docs ?? []).length} pièce(s) justificative(s).`,
      '',
      '**Document généré par intelligence artificielle — à vérifier et valider avant toute diffusion.**',
      '',
      '---',
      '',
    ].join('\n')
    const report = header + (result.content ?? '').replace(/^#\s+[^\n]*\n/, '')

    // Persistance : un rapport est une pièce datée, comparable dans le
    // temps et annexable à un dossier de financement. Si la table n'existe
    // pas encore (migration 0024), la génération reste utilisable.
    let reportId: string | undefined
    const { data: saved, error: saveErr } = await supabase.from('ai_reports').insert({
      project_id: projectId,
      content: report,
      model: result.model ?? null,
      instructions: consigne || null,
      truncated: result.truncated ?? false,
      tokens: result.usage?.total ?? null,
      created_by: user.id,
    }).select('id').maybeSingle()
    if (saveErr) console.error('[generateExpertReport] historisation impossible:', saveErr.message)
    else reportId = saved?.id

    await supabase.from('audit_log').insert({
      project_id: projectId, entity: 'rapport_ia', entity_id: reportId ?? null,
      label: project.name, action: 'cree', user_id: user.id,
      comment: `Rapport d'expert IA généré — modèle ${result.model ?? '?'}${result.usage?.total ? `, ${result.usage.total} jetons` : ''}${result.truncated ? ' — TRONQUÉ' : ''}`,
    })

    return { ok: true, report, truncated: result.truncated, model: result.model, reportId }
  } catch (e) {
    console.error('[generateExpertReport] exception:', e)
    return { ok: false, error: `Échec de la génération : ${e instanceof Error ? e.message : String(e)}` }
  }
}


// ------------------------------------------------------------
// Historique : liste, lecture, suppression
// ------------------------------------------------------------
export async function listReports(projectId: string): Promise<{ ok: boolean; reports?: ReportSummary[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Non authentifié.' }
    const { data, error } = await supabase
      .from('ai_reports')
      .select('id, created_at, model, instructions, truncated, author:created_by(full_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(20)
    // Table absente (migration 0024 non appliquée) : historique vide
    if (error) return { ok: true, reports: [] }
    const reports: ReportSummary[] = (data ?? []).map((r: {
      id: string; created_at: string; model: string | null; instructions: string | null
      truncated: boolean; author: { full_name: string | null } | { full_name: string | null }[] | null
    }) => {
      const a = Array.isArray(r.author) ? r.author[0] : r.author
      return {
        id: r.id, createdAt: r.created_at, model: r.model,
        instructions: r.instructions, truncated: r.truncated,
        authorName: a?.full_name ?? '—',
      }
    })
    return { ok: true, reports }
  } catch (e) {
    console.error('[listReports] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

export async function getReport(reportId: string): Promise<{ ok: boolean; report?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  const { data, error } = await supabase.from('ai_reports').select('content').eq('id', reportId).maybeSingle()
  if (error || !data) return { ok: false, error: 'Rapport introuvable.' }
  return { ok: true, report: data.content }
}

export async function deleteReport(reportId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  const { error } = await supabase.from('ai_reports').delete().eq('id', reportId)
  if (error) return { ok: false, error: `Suppression refusée : ${error.message}` }
  return { ok: true }
}
