import { createClient as createAdminClient } from '@supabase/supabase-js'

// Client Supabase « service » (bypass RLS) — SERVEUR UNIQUEMENT.
// Retourne null si la clé n'est pas configurée : l'appelant doit
// afficher un message clair plutôt que planter.
export function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
