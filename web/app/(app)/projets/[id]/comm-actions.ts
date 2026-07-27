'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canManagePhases } from '@/lib/permissions'
import { chatComplete, extractJson } from '@/lib/llm'
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
// Canaux disponibles et consignes de rédaction associées
const CHANNEL_RULES: Record<string, { label: string; rule: string }> = {
  linkedin: { label: 'LinkedIn', rule: 'ton institutionnel, 120-180 mots, 3-5 hashtags sobres' },
  facebook: { label: 'Facebook', rule: 'ton chaleureux grand public, 80-140 mots, 1-2 émojis maximum' },
  communique: { label: 'Communiqué de presse', rule: 'style presse neutre, 150-250 mots, titre en première ligne' },
  newsletter: { label: 'Newsletter', rule: 'ton direct et informatif, 150-250 mots, objet d\'email en première ligne' },
  affiche: { label: 'Affiche / visuel', rule: 'accroche courte (10 mots maximum) puis 3 lignes d\'information pratique' },
  bulletin: { label: 'Bulletin municipal', rule: 'ton institutionnel local, 100-150 mots, mise en avant du lien avec le territoire' },
}

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
      .select('id, project_id, phase_id, trigger_kind, title, scheduled_date, responsible_id, status, languages, brief')
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

    // Brief : canaux, audience, objectif, ton, message clé. Sans lui,
    // l'IA ne peut produire qu'un texte générique (P2-13 du rapport de
    // test du 25/07/2026).
    const brief = (campaign.brief ?? {}) as {
      channels?: string[]; audience?: string; objective?: string; tone?: string; keyMessage?: string
    }
    const channels = (brief.channels?.length ? brief.channels : ['linkedin', 'facebook', 'communique'])
      .filter(c => CHANNEL_RULES[c])
    if (!channels.length) return { ok: false, error: 'Choisissez au moins un canal dans le brief.' }

    const briefLines = [
      brief.audience ? `Audience visée : ${brief.audience}` : '',
      brief.objective ? `Objectif de la campagne : ${brief.objective}` : '',
      brief.tone ? `Ton attendu : ${brief.tone}` : '',
      brief.keyMessage ? `Message clé / appel à l'action : ${brief.keyMessage}` : '',
    ].filter(Boolean)

    const system = `Tu es le responsable communication d'une association de solidarité internationale.
Tu rédiges des contenus de communication PRÊTS À PUBLIER, sobres, positifs et factuels.
RÈGLES ABSOLUES :
- Utilise UNIQUEMENT les faits fournis ; n'invente JAMAIS un chiffre, un lieu, un nom ou un résultat.
- Communication éthique : dignité des bénéficiaires, pas de misérabilisme, pas de promesses.
- Chaque contenu inclut la mention du financeur : « ${MENTION_DEFAUT} » (traduite naturellement dans la langue du contenu).
${channels.map(c => `- ${CHANNEL_RULES[c].label} : ${CHANNEL_RULES[c].rule}`).join('\n')}
Réponds UNIQUEMENT avec un objet JSON strict, sans texte autour ni bloc de code :
{${langs.map(l => `"${l}": {${channels.map(c => `"${c}": "..."`).join(', ')}}`).join(', ')}}`

    const userMsg = `Occasion : ${campaign.trigger_kind} — ${campaign.title}${campaign.scheduled_date ? ` (date prévue : ${campaign.scheduled_date})` : ''}
${briefLines.length ? `\nBrief de communication (à respecter impérativement) :\n${briefLines.join('\n')}\n` : ''}
Projet (faits vérifiés, seuls utilisables) :
${JSON.stringify({ projet: project, phase_concernee: phase, etat_des_phases: phases }, null, 1)}
Langues demandées : ${langs.join(', ')} (ar = arabe standard moderne, sens RTL).`

    // Mode JSON natif + budget large : le format n'est plus laissé au
    // bon vouloir du modèle (échecs 100 % constatés le 25/07/2026).
    const result = await chatComplete({
      usageContext: { feature: 'campagne', projectId: campaign.project_id },
      system, user: userMsg, temperature: 0.5, maxTokens: 12_000, json: true, attempts: 2,
    })
    if (!result.ok || !result.content) {
      await supabase.from('audit_log').insert({
        project_id: campaign.project_id, entity: 'campagne_ia', entity_id: campaign.id,
        label: campaign.title, action: 'cree', user_id: user.id,
        comment: `Échec de génération des contenus — ${result.error ?? 'cause inconnue'}`,
      })
      return { ok: false, error: result.error ?? 'Réponse IA vide.' }
    }

    // Extraction tolérante (blocs de code, texte autour, virgules
    // terminales) plutôt qu'un JSON.parse strict
    const contents = extractJson<Record<string, Record<string, string>>>(result.content)
    if (!contents || typeof contents !== 'object') {
      console.error('[generateCampaignContents] JSON illisible:', result.content.slice(0, 500))
      await supabase.from('audit_log').insert({
        project_id: campaign.project_id, entity: 'campagne_ia', entity_id: campaign.id,
        label: campaign.title, action: 'cree', user_id: user.id,
        comment: `Échec de génération des contenus — format illisible${result.truncated ? ' (réponse tronquée)' : ''}`,
      })
      return {
        ok: false,
        error: result.truncated
          ? `Réponse tronquée par le modèle « ${result.model ?? '?'} » : réduisez le nombre de langues, ou choisissez un modèle « flash » non raisonnant dans Administration ▸ Configuration ▸ IA.`
          : "Le modèle n'a pas renvoyé un JSON exploitable. Réessayez ; si cela persiste, changez de modèle dans Administration ▸ Configuration ▸ IA.",
      }
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
  brief?: {
    channels?: string[]; audience?: string; objective?: string; tone?: string; keyMessage?: string
  } | null
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
    if (patch.brief !== undefined) values.brief = patch.brief

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
