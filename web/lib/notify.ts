import { createClient as createAdminClient } from '@supabase/supabase-js'

// Émission d'une notification in-app à destination d'un utilisateur.
// La policy RLS « Own notifications » n'autorise l'insertion que pour soi :
// pour notifier quelqu'un d'autre, on passe par la clé service (serveur
// uniquement — ce module ne doit JAMAIS être importé côté client).
// Défensif par conception : sans clé configurée ou en cas d'erreur, on ne
// bloque jamais l'action métier appelante (log serveur seulement).
export interface NotificationPayload {
  title: string
  href?: string
}

export async function notifyUser(userId: string | null | undefined, type: string, payload: NotificationPayload): Promise<void> {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey || !userId) return
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error } = await admin.from('notifications').insert({ user_id: userId, type, payload })
    if (error) console.error('[notifyUser] insertion échouée:', { type, code: error.code, message: error.message })
  } catch (e) {
    console.error('[notifyUser] exception:', e)
  }
}
