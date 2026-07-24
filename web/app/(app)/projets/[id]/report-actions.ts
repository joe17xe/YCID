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
}

export async function generateExpertReport(projectId: string): Promise<ReportResult> {
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
      { data: budget },
      { data: indicators },
      { data: measures },
      { data: meetings },
      { data: decisions },
      { data: members },
    ] = await Promise.all([
      supabase.from('projects').select('name, description, country, zone, start_date, end_date, status, budget, currency').eq('id', projectId).maybeSingle(),
      supabase.from('project_organizations').select('role, organizations:org_id(name, type)').eq('project_id', projectId),
      supabase.from('phases').select('id, name, position, start_date, end_date, status, budget, tasks(title, status, progress, start_date, end_date, assignee_id)').eq('project_id', projectId).order('position'),
      supabase.from('budget_lines').select('poste, category, year, planned_amount, is_valorisation, status').eq('project_id', projectId),
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

    // Digest compact : seules ces données peuvent être citées par l'IA
    const digest = {
      date_du_jour: today,
      projet: project,
      organisations: (orgs ?? []).map(o => ({ role: o.role, org: o.organizations })),
      nb_membres: (members ?? []).length,
      phases: (phases ?? []).map(p => ({
        nom: p.name, statut: p.status, debut: p.start_date, fin: p.end_date, budget: p.budget,
        taches: (p.tasks ?? []).map((t: { title: string; status: string; progress: number; end_date: string | null }) => ({
          titre: t.title, statut: t.status, avancement: t.progress, echeance: t.end_date,
          en_retard: !!(t.end_date && t.end_date < today && t.status !== 'terminee'),
        })),
      })),
      lignes_budgetaires: budget ?? [],
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
- Si une donnée manque, écris « donnée non renseignée » et recommande de la compléter.
- Mets en évidence les écarts, retards et risques réels visibles dans les données.
Structure EXACTE du rapport (Markdown) :
# Rapport d'expertise — {nom du projet}
## 1. Synthèse exécutive (5 lignes max)
## 2. Avancement du projet (par phase, avec les retards)
## 3. Analyse budgétaire (prévu, répartition, points d'attention)
## 4. Indicateurs & impact (cibles vs mesures)
## 5. Gouvernance (réunions, décisions en attente)
## 6. Risques & alertes (priorisés)
## 7. Recommandations pour le COPIL (concrètes, numérotées)`

    const result = await chatComplete({
      system,
      user: `Données réelles du projet (JSON) :\n${JSON.stringify(digest, null, 1)}`,
      temperature: 0.2,
      maxTokens: 4096,
    })
    if (!result.ok) return { ok: false, error: result.error }

    // Trace d'audit : qui a généré un rapport, quand
    await supabase.from('audit_log').insert({
      project_id: projectId, entity: 'rapport_ia', entity_id: null,
      label: project.name, action: 'cree', user_id: user.id,
      comment: 'Génération du rapport d\'expert IA',
    })

    return { ok: true, report: result.content }
  } catch (e) {
    console.error('[generateExpertReport] exception:', e)
    return { ok: false, error: `Échec de la génération : ${e instanceof Error ? e.message : String(e)}` }
  }
}
