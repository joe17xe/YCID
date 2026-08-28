import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendMail, renderMail, getEmailSettings, isUsable, unusableReason, recordSendOutcome } from './mailer'
import { isUsableEmail } from './email'
import { rolesWith } from './rbac'

// ============================================================
// Notifications du circuit de validation
// ============================================================
// Serveur uniquement.
//
// Le circuit devis → validé → engagé ne tourne pas tout seul : il exige
// qu'une personne précise fasse un geste précis. Jusqu'ici rien ne le
// lui disait — il fallait ouvrir projet par projet, ligne par ligne, le
// dialogue des pièces pour découvrir qu'une décision attendait.
//
// C'est devenu bloquant avec l'unanimité : une organisation qui ne
// répond pas gèle l'engagé. Prévenir n'est plus un confort.
//
// Deux canaux, un seul appel : la notification interne (table
// `notifications`, alimentée par la clé service) et l'email si la
// configuration existe. L'email est facultatif par construction — une
// installation sans SMTP fonctionne, en dégradé.

function adminDb() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export interface CircuitNotice {
  type: string
  title: string
  body: string[]
  // Chemin relatif — le domaine vient de la configuration, pas du code.
  path?: string
  linkLabel?: string
}

// Les destinataires sont dédupliqués : quelqu'un membre de deux
// organisations sollicitées sur le même devis ne doit pas recevoir deux
// fois le même message.
export async function notifyPeople(userIds: (string | null | undefined)[], notice: CircuitNotice): Promise<void> {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))]
  if (!ids.length) return

  const db = adminDb()
  if (!db) {
    console.error('[notify-circuit] clé service absente — aucune notification émise')
    return
  }

  // 1. Interne d'abord : c'est le canal fiable. Il ne dépend d'aucun
  //    tiers, et il reste la trace consultable si l'email se perd.
  const { data: created, error } = await db.from('notifications').insert(
    ids.map(user_id => ({ user_id, type: notice.type, payload: { title: notice.title, href: notice.path } })),
  ).select('id, user_id')
  if (error) console.error('[notify-circuit] notification interne échouée:', error.message)

  // 2. Email ensuite, et seulement si la configuration le permet.
  const settings = await getEmailSettings()
  if (!isUsable(settings)) {
    // Se taire ici, c'était laisser croire à un envoi. « Le SMTP est en
    // place, pourquoi je n'ai pas reçu de mail ? » n'avait aucune
    // réponse consultable : ni journal, ni trace en base.
    console.warn('[notify-circuit] aucun email envoyé —', unusableReason(settings))
    return
  }

  const { data: profiles } = await db.from('profiles').select('id, email, full_name').in('id', ids)
  const base = (settings.site_url ?? '').replace(/\/+$/, '')
  const link = notice.path && base
    ? { href: `${base}${notice.path}`, label: notice.linkLabel ?? 'Ouvrir dans Solid’Pilot' }
    : undefined
  const { text, html } = renderMail(notice.title, notice.body, link)

  const notifByUser = new Map((created ?? []).map(n => [n.user_id as string, n.id as string]))
  const sent: string[] = []
  let lastTo: string | null = null
  let lastErr: string | null = null

  for (const p of profiles ?? []) {
    // Une adresse manifestement invalide ne part pas : l'import CSV en a
    // produit qui commencent par un point. Tenter l'envoi ferait rejeter
    // le message par le relais, et pourrait abîmer la réputation de
    // l'expéditeur pour les destinataires légitimes. La règle vit dans
    // lib/email.ts — la même qui garde désormais la porte d'entrée.
    if (!isUsableEmail(p.email)) {
      console.warn('[notify-circuit] adresse inexploitable, email non envoyé:', p.email)
      continue
    }
    const err = await sendMail({ to: p.email, subject: notice.title, text, html })
    lastTo = p.email
    lastErr = err
    if (err) console.error('[notify-circuit] email non envoyé à', p.email, ':', err)
    else {
      const nid = notifByUser.get(p.id as string)
      if (nid) sent.push(nid)
    }
  }

  // `emailed_at` posée par la 0040 n'était jamais renseignée : la
  // colonne existait, personne ne l'écrivait. Elle répond pourtant à la
  // seule question qui compte après coup — ce message est-il parti, ou
  // seulement affiché dans l'application ?
  if (sent.length) {
    const { error: stampErr } = await db.from('notifications')
      .update({ emailed_at: new Date().toISOString() }).in('id', sent)
    if (stampErr) console.error('[notify-circuit] horodatage d’envoi non posé:', stampErr.message)
  }
  if (lastTo !== null) await recordSendOutcome(lastTo, lastErr)
}

// ------------------------------------------------------------
// Qui prévenir
// ------------------------------------------------------------

// Les membres des organisations sollicitées : ce sont eux, et eux seuls,
// qui peuvent décider depuis la 0036.
export async function membersOfOrgs(orgIds: string[]): Promise<string[]> {
  const db = adminDb()
  if (!db || !orgIds.length) return []
  const { data } = await db.from('memberships').select('user_id').in('org_id', orgIds)
  return (data ?? []).map(m => m.user_id as string)
}

// Les responsables d'un projet, destinataires naturels de ce qui s'y
// achève.
export async function projectLeads(projectId: string): Promise<string[]> {
  const db = adminDb()
  if (!db) return []
  const { data } = await db.from('project_members')
    .select('user_id').eq('project_id', projectId)
    // Ceux qui pilotent le projet, au sens de la matrice : la liste
    // ne se recopie pas ici, elle se demande.
    .in('role', rolesWith('projets.update'))
  return (data ?? []).map(m => m.user_id as string)
}

// Tous les membres d'un projet — le cercle de ceux qui y voient déjà
// tout. Sert au dépôt de pièce (0067) : « à chaque ajout de document,
// une notification doit apparaître chez les personnes sur le projet ».
export async function projectMembers(projectId: string): Promise<string[]> {
  const db = adminDb()
  if (!db) return []
  const { data } = await db.from('project_members').select('user_id').eq('project_id', projectId)
  return (data ?? []).map(m => m.user_id as string)
}

// Les administrateurs des organisations PILOTES — YCID et LEY. La règle
// n'est pas réinventée ici : c'est mot pour mot celle de
// `is_lead_org_admin()` (0007), qui gouverne déjà en base ce que
// « admin YCID / LEY » veut dire. Deux définitions du même cercle
// finiraient par diverger, et c'est le genre de divergence qui se
// découvre le jour où quelqu'un ne reçoit rien.
export async function leadOrgAdmins(): Promise<string[]> {
  const db = adminDb()
  if (!db) return []
  const { data: orgs } = await db.from('organizations').select('id, name')
  const leadIds = (orgs ?? [])
    .filter(o => {
      const n = String(o.name ?? '').toUpperCase()
      return n.includes('YCID') || n.includes('LEY')
    })
    .map(o => o.id as string)
  if (!leadIds.length) return []
  const { data } = await db.from('memberships')
    .select('user_id').in('org_id', leadIds).eq('role', 'admin_org')
  return (data ?? []).map(m => m.user_id as string)
}

// La direction du programme dont relève le projet (0055). Elle est le
// plus souvent DÉJÀ membre du projet — le déclencheur de la 0055 lui
// pose une ligne `chef_projet` via_programme — mais on ne s'appuie pas
// là-dessus : un projet rattaché à un programme sans que la
// synchronisation ait eu lieu laisserait la directrice sans nouvelles,
// et c'est précisément la personne qu'il ne faut pas rater.
export async function programmeDirectors(projectId: string): Promise<string[]> {
  const db = adminDb()
  if (!db) return []
  const { data: project } = await db.from('projects')
    .select('programme_id').eq('id', projectId).maybeSingle()
  if (!project?.programme_id) return []
  const { data } = await db.from('programme_directors')
    .select('user_id').eq('programme_id', project.programme_id)
  return (data ?? []).map(d => d.user_id as string)
}
