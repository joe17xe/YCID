'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canManagePhases } from '@/lib/permissions'
import { chatComplete } from '@/lib/llm'
import { notifyUser } from '@/lib/notify'

// ============================================================
// PR 26 — Campagnes de communication IA
// ============================================================
// Règles produit (24/07/2026) : l'IA PROPOSE, l'humain VALIDE (jamais
// d'auto-publication) ; mentions CEM & YCID par défaut ; FR/EN/AR
// paramétrables ; check-list éthique obligatoire avant validation.

type Result = { ok: boolean; error?: string; count?: number }

const LANGS = ['fr', 'en', 'ar'] as const
const STATUSES = ['proposee', 'brouillon', 'validee', 'publiee', 'annulee'] as const
const MENTION_DEFAUT = "Projet soutenu dans le cadre du programme CEM avec l'appui d'YCID — Yvelines Coopération Internationale et Développement (Département des Yvelines)."

async function commContext(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' as const }
  const canManage = await canManagePhases(supabase, user.id, projectId)
  return { supabase, user, canManage }
}

// Le responsable d'une campagne peut la modifier même sans être chef
async function canTouchCampaign(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, campaign: { project_id: string; responsible_id: string | null }) {
  if (campaign.responsible_id === userId) return true
  return canManagePhases(supabase, userId, campaign.project_id)
}

// ------------------------------------------------------------
// Génération du plan de communication (kickoff / phases / clôture)
// ------------------------------------------------------------
export async function generateCommPlan(projectId: string): Promise<Result> {
  try {
    const ctx = await commContext(projectId)
    if ('error' in ctx) return { ok: false, error: ctx.error }
    const { supabase, user, canManage } = ctx
    if (!canManage) return { ok: false, error: 'Plan de communication réservé au chef de projet et aux admins.' }

    const [{ data: project }, { data: phases }, { data: existing }, { data: chef }] = await Promise.all([
      supabase.from('projects').select('name, start_date, end_date').eq('id', projectId).maybeSingle(),
      supabase.from('phases').select('id, name, end_date').eq('project_id', projectId).order('position'),
      supabase.from('comm_campaigns').select('trigger_kind, phase_id').eq('project_id', projectId),
      supabase.from('project_members').select('user_id').eq('project_id', projectId).eq('role', 'chef_projet').limit(1).maybeSingle(),
    ])
    if (!project) return { ok: false, error: 'Projet introuvable.' }

    const responsible = chef?.user_id ?? user.id
    const has = (kind: string, phaseId?: string | null) =>
      (existing ?? []).some(c => c.trigger_kind === kind && (kind !== 'phase' || c.phase_id === phaseId))

    const today = new Date().toISOString().slice(0, 10)
    const rows: Array<Record<string, unknown>> = []
    if (!has('kickoff')) {
      rows.push({ project_id: projectId, trigger_kind: 'kickoff', title: `Lancement du projet ${project.name}`, scheduled_date: project.start_date ?? today, responsible_id: responsible, created_by: user.id })
    }
    for (const p of phases ?? []) {
      if (!has('phase', p.id)) {
        rows.push({ project_id: projectId, phase_id: p.id, trigger_kind: 'phase', title: `Réalisation — ${p.name}`, scheduled_date: p.end_date, responsible_id: responsible, created_by: user.id })
      }
    }
    if (!has('cloture')) {
      rows.push({ project_id: projectId, trigger_kind: 'cloture', title: `Bilan du projet ${project.name}`, scheduled_date: project.end_date, responsible_id: responsible, created_by: user.id })
    }
    if (!rows.length) return { ok: true, count: 0 }

    const { error } = await supabase.from('comm_campaigns').insert(rows)
    if (error) return { ok: false, error: `Échec de la création du plan : ${error.message}` }

    if (responsible !== user.id) {
      await notifyUser(responsible, 'comm_plan', {
        title: `${rows.length} campagne(s) de communication proposée(s) — ${project.name}`,
        href: `/projets/${projectId}?tab=comm`,
      })
    }
    revalidatePath(`/projets/${projectId}`)
    return { ok: true, count: rows.length }
  } catch (e) {
    console.error('[generateCommPlan] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ------------------------------------------------------------
// Génération IA des contenus d'une campagne
// ------------------------------------------------------------
export async function generateCampaignContents(campaignId: string): Promise<Result> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Non authentifié.' }

    const { data: campaign } = await supabase.from('comm_campaigns')
      .select('id, project_id, phase_id, trigger_kind, title, scheduled_date, responsible_id, status, languages')
      .eq('id', campaignId).maybeSingle()
    if (!campaign) return { ok: false, error: 'Campagne introuvable.' }
    if (!(await canTouchCampaign(supabase, user.id, campaign))) {
      return { ok: false, error: 'Génération réservée au responsable de la campagne, au chef de projet et aux admins.' }
    }

    const [{ data: project }, { data: phase }, { data: phases }] = await Promise.all([
      supabase.from('projects').select('name, description, country, zone, start_date, end_date, status').eq('id', campaign.project_id).maybeSingle(),
      campaign.phase_id
        ? supabase.from('phases').select('name, start_date, end_date, status, tasks(title, status, progress)').eq('id', campaign.phase_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('phases').select('name, status').eq('project_id', campaign.project_id).order('position'),
    ])
    if (!project) return { ok: false, error: 'Projet introuvable.' }

    const langs = ((campaign.languages ?? ['fr']) as string[]).filter(l => (LANGS as readonly string[]).includes(l))
    if (!langs.length) return { ok: false, error: 'Choisissez au moins une langue.' }

    const system = `Tu es le responsable communication d'une association de solidarité internationale.
Tu rédiges des contenus de communication PRÊTS À PUBLIER, sobres, positifs et factuels.
RÈGLES ABSOLUES :
- Utilise UNIQUEMENT les faits fournis ; n'invente JAMAIS un chiffre, un lieu, un nom ou un résultat.
- Communication éthique : dignité des bénéficiaires, pas de misérabilisme, pas de promesses.
- Chaque contenu inclut la mention du financeur : « ${MENTION_DEFAUT} » (traduite naturellement dans la langue du contenu).
- LinkedIn : ton institutionnel, 120-180 mots, 3-5 hashtags sobres.
- Facebook : ton chaleureux grand public, 80-140 mots, 1-2 émojis maximum.
- Communiqué : style presse neutre, 150-250 mots, avec un titre en première ligne.
Réponds UNIQUEMENT avec un objet JSON strict, sans texte autour ni bloc de code :
{${langs.map(l => `"${l}": {"linkedin": "...", "facebook": "...", "communique": "..."}`).join(', ')}}`

    const userMsg = `Occasion : ${campaign.trigger_kind} — ${campaign.title}${campaign.scheduled_date ? ` (date prévue : ${campaign.scheduled_date})` : ''}
Projet (faits vérifiés, seuls utilisables) :
${JSON.stringify({ projet: project, phase_concernee: phase, etat_des_phases: phases }, null, 1)}
Langues demandées : ${langs.join(', ')} (ar = arabe standard moderne, sens RTL).`

    const result = await chatComplete({ system, user: userMsg, temperature: 0.5, maxTokens: 4096 })
    if (!result.ok || !result.content) return { ok: false, error: result.error ?? 'Réponse IA vide.' }

    // Parse strict (tolère un éventuel bloc ```json)
    let contents: Record<string, Record<string, string>>
    try {
      const raw = result.content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
      contents = JSON.parse(raw)
    } catch {
      console.error('[generateCampaignContents] JSON invalide:', result.content.slice(0, 400))
      return { ok: false, error: "L'IA a renvoyé un format inattendu — réessayez." }
    }

    const { error } = await supabase.from('comm_campaigns').update({
      contents,
      status: campaign.status === 'proposee' ? 'brouillon' : campaign.status,
    }).eq('id', campaignId)
    if (error) return { ok: false, error: `Échec de l'enregistrement : ${error.message}` }

    if (campaign.responsible_id && campaign.responsible_id !== user.id) {
      await notifyUser(campaign.responsible_id, 'comm_contents', {
        title: `Contenus générés — « ${campaign.title} » : à relire et valider`,
        href: `/projets/${campaign.project_id}?tab=comm`,
      })
    }
    revalidatePath(`/projets/${campaign.project_id}`)
    return { ok: true }
  } catch (e) {
    console.error('[generateCampaignContents] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ------------------------------------------------------------
// Mise à jour (titre, date, responsable, langues, contenus, check-list)
// ------------------------------------------------------------
export interface CampaignPatch {
  title?: string
  scheduled_date?: string | null
  responsible_id?: string | null
  languages?: string[]
  contents?: Record<string, Record<string, string>> | null
  checklist?: Record<string, boolean>
}

export async function updateCampaign(campaignId: string, patch: CampaignPatch): Promise<Result> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Non authentifié.' }
    const { data: campaign } = await supabase.from('comm_campaigns')
      .select('id, project_id, responsible_id').eq('id', campaignId).maybeSingle()
    if (!campaign) return { ok: false, error: 'Campagne introuvable.' }
    if (!(await canTouchCampaign(supabase, user.id, campaign))) return { ok: false, error: 'Modification non autorisée.' }

    const values: Record<string, unknown> = {}
    if (patch.title !== undefined) {
      const t = patch.title.trim()
      if (!t) return { ok: false, error: 'Le titre est obligatoire.' }
      values.title = t
    }
    if (patch.scheduled_date !== undefined) values.scheduled_date = patch.scheduled_date || null
    if (patch.responsible_id !== undefined) values.responsible_id = patch.responsible_id || null
    if (patch.languages !== undefined) {
      const langs = patch.languages.filter(l => (LANGS as readonly string[]).includes(l))
      if (!langs.length) return { ok: false, error: 'Au moins une langue est requise.' }
      values.languages = langs
    }
    if (patch.contents !== undefined) values.contents = patch.contents
    if (patch.checklist !== undefined) values.checklist = patch.checklist

    const { error } = await supabase.from('comm_campaigns').update(values).eq('id', campaignId)
    if (error) return { ok: false, error: `Échec de l'enregistrement : ${error.message}` }
    revalidatePath(`/projets/${campaign.project_id}`)
    return { ok: true }
  } catch (e) {
    console.error('[updateCampaign] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ------------------------------------------------------------
// Changement de statut (workflow avec garde-fous)
// ------------------------------------------------------------
export async function setCampaignStatus(campaignId: string, status: string): Promise<Result> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Non authentifié.' }
    if (!(STATUSES as readonly string[]).includes(status)) return { ok: false, error: 'Statut invalide.' }

    const { data: campaign } = await supabase.from('comm_campaigns')
      .select('id, project_id, responsible_id, title, status, checklist, contents').eq('id', campaignId).maybeSingle()
    if (!campaign) return { ok: false, error: 'Campagne introuvable.' }
    if (!(await canTouchCampaign(supabase, user.id, campaign))) return { ok: false, error: 'Action non autorisée.' }

    // Garde-fous : pas de validation sans contenus ni check-list complète ;
    // pas de publication sans validation préalable.
    if (status === 'validee') {
      if (!campaign.contents) return { ok: false, error: 'Générez ou saisissez les contenus avant de valider.' }
      const cl = (campaign.checklist ?? {}) as Record<string, boolean>
      if (!cl.chiffres_ok || !cl.mentions_ok || !cl.images_ok) {
        return { ok: false, error: 'Check-list éthique incomplète : vérifiez chiffres, mentions financeur et droits à l\'image.' }
      }
    }
    if (status === 'publiee' && !['validee', 'publiee'].includes(campaign.status)) {
      return { ok: false, error: 'Une campagne doit être validée avant d\'être marquée publiée.' }
    }

    const values: Record<string, unknown> = { status }
    if (status === 'publiee') values.published_at = new Date().toISOString()
    const { error } = await supabase.from('comm_campaigns').update(values).eq('id', campaignId)
    if (error) return { ok: false, error: `Échec : ${error.message}` }

    if (campaign.responsible_id && campaign.responsible_id !== user.id && (status === 'validee' || status === 'publiee')) {
      await notifyUser(campaign.responsible_id, 'comm_status', {
        title: `Campagne « ${campaign.title} » ${status === 'validee' ? 'validée' : 'publiée'}`,
        href: `/projets/${campaign.project_id}?tab=comm`,
      })
    }
    revalidatePath(`/projets/${campaign.project_id}`)
    return { ok: true }
  } catch (e) {
    console.error('[setCampaignStatus] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ------------------------------------------------------------
// Création manuelle & suppression
// ------------------------------------------------------------
export async function createCampaign(projectId: string, input: { title: string; scheduled_date?: string }): Promise<Result> {
  try {
    const ctx = await commContext(projectId)
    if ('error' in ctx) return { ok: false, error: ctx.error }
    const { supabase, user, canManage } = ctx
    if (!canManage) return { ok: false, error: 'Création réservée au chef de projet et aux admins.' }
    const title = (input.title ?? '').trim()
    if (!title) return { ok: false, error: 'Le titre est obligatoire.' }
    const { error } = await supabase.from('comm_campaigns').insert({
      project_id: projectId, trigger_kind: 'manuelle', title,
      scheduled_date: input.scheduled_date || null, responsible_id: user.id, created_by: user.id,
    })
    if (error) return { ok: false, error: `Échec de la création : ${error.message}` }
    revalidatePath(`/projets/${projectId}`)
    return { ok: true }
  } catch (e) {
    console.error('[createCampaign] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

export async function deleteCampaign(campaignId: string): Promise<Result> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Non authentifié.' }
    const { data: campaign } = await supabase.from('comm_campaigns').select('id, project_id').eq('id', campaignId).maybeSingle()
    if (!campaign) return { ok: false, error: 'Campagne introuvable.' }
    if (!(await canManagePhases(supabase, user.id, campaign.project_id))) {
      return { ok: false, error: 'Suppression réservée au chef de projet et aux admins.' }
    }
    const { error } = await supabase.from('comm_campaigns').delete().eq('id', campaignId)
    if (error) return { ok: false, error: `Échec de la suppression : ${error.message}` }
    revalidatePath(`/projets/${campaign.project_id}`)
    return { ok: true }
  } catch (e) {
    console.error('[deleteCampaign] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}
