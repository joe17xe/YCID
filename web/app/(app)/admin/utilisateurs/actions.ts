'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isUserAdmin } from '@/lib/permissions'

export async function inviteUser(input: { email: string; fullName: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const allowed = await isUserAdmin(supabase, user.id)
  if (!allowed) return { ok: false, error: 'Action réservée aux administrateurs YCID / LEY.' }

  const email = (input.email ?? '').trim().toLowerCase()
  const fullName = (input.fullName ?? '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Adresse email invalide.' }
  if (!fullName) return { ok: false, error: 'Le nom complet est obligatoire.' }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return {
      ok: false,
      error: "Invitations non configurées : ajoutez SUPABASE_SERVICE_ROLE_KEY aux variables d'environnement du serveur.",
    }
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    })
    if (error) {
      const e = error as { message?: string; status?: number; code?: string; name?: string }
      const detail = e.message || e.code || e.name || (e.status ? `HTTP ${e.status}` : '')
      // Message d'erreur explicite : l'envoi de l'email est la cause la plus fréquente
      const hint = (e.status === 500 || /email|smtp/i.test(detail))
        ? " — vérifiez la configuration email de Supabase (Authentication > SMTP), ou créez le compte via Dashboard > Add user."
        : ""
      return { ok: false, error: `Échec de l'invitation : ${detail || 'erreur inconnue'}${hint}` }
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Échec de l'invitation : ${detail || 'erreur serveur'} — vérifiez la configuration email de Supabase (SMTP) ou créez le compte via Dashboard > Add user.` }
  }

  revalidatePath('/admin/utilisateurs')
  return { ok: true }
}
