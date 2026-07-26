import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendMail, renderMail, getEmailSettings, isUsable } from './mailer'
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
  const { error } = await db.from('notifications').insert(
    ids.map(user_id => ({ user_id, type: notice.type, payload: { title: notice.title, href: notice.path } })),
  )
  if (error) console.error('[notify-circuit] notification interne échouée:', error.message)

  // 2. Email ensuite, et seulement si la configuration le permet.
  const settings = await getEmailSettings()
  if (!isUsable(settings)) return

  const { data: profiles } = await db.from('profiles').select('id, email, full_name').in('id', ids)
  const base = (settings.site_url ?? '').replace(/\/+$/, '')
  const link = notice.path && base
    ? { href: `${base}${notice.path}`, label: notice.linkLabel ?? 'Ouvrir dans Solid’Pilot' }
    : undefined
  const { text, html } = renderMail(notice.title, notice.body, link)

  for (const p of profiles ?? []) {
    // Une adresse manifestement invalide ne part pas : l'import CSV en a
    // produit qui commencent par un point. Tenter l'envoi ferait rejeter
    // le message par le relais, et pourrait abîmer la réputation de
    // l'expéditeur pour les destinataires légitimes.
    if (!p.email || !/^[^\s@.][^\s@]*@[^\s@]+\.[^\s@]+$/.test(p.email)) {
      console.warn('[notify-circuit] adresse inexploitable, email non envoyé:', p.email)
      continue
    }
    const err = await sendMail({ to: p.email, subject: notice.title, text, html })
    if (err) console.error('[notify-circuit] email non envoyé à', p.email, ':', err)
  }
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
