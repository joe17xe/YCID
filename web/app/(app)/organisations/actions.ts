'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isUserAdmin } from '@/lib/permissions'

const ORG_TYPES = ['association', 'collectivite', 'partenaire_local', 'partenaire_medical', 'financeur', 'financeur_public', 'mecene', 'autre']

type Result = { ok: boolean; error?: string }

export interface OrgInput {
  orgId?: string
  name: string
  type: string
  country: string
  email: string
  status: string
}

export async function saveOrganization(input: OrgInput): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await isUserAdmin(supabase, user.id))) return { ok: false, error: 'Gestion des organisations réservée aux administrateurs YCID / LEY.' }

  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: "Le nom de l'organisation est obligatoire." }
  if (!ORG_TYPES.includes(input.type)) return { ok: false, error: 'Type invalide.' }
  const email = (input.email ?? '').trim().toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Adresse email invalide.' }
  const status = input.status === 'inactive' ? 'inactive' : 'active'

  const values = { name, type: input.type, country: (input.country ?? '').trim() || 'France', email: email || null, status }

  if (input.orgId) {
    const { error } = await supabase.from('organizations').update(values).eq('id', input.orgId)
    if (error) return { ok: false, error: `Échec de la modification : ${error.message}` }
  } else {
    const { error } = await supabase.from('organizations').insert({ ...values, created_by: user.id })
    if (error) return { ok: false, error: `Échec de la création : ${error.message}` }
  }
  revalidatePath('/organisations')
  return { ok: true }
}

export async function deleteOrganization(orgId: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await isUserAdmin(supabase, user.id))) return { ok: false, error: 'Action réservée aux administrateurs YCID / LEY.' }

  const { error } = await supabase.from('organizations').delete().eq('id', orgId)
  if (error) {
    if (error.code === '23503') {
      return { ok: false, error: 'Cette organisation est utilisée par un projet ou une ligne budgétaire — retirez-la d\'abord de ces éléments.' }
    }
    return { ok: false, error: `Échec de la suppression : ${error.message}` }
  }
  revalidatePath('/organisations')
  return { ok: true }
}

// Crée un compte utilisateur directement (sans email), avec un mot de passe
// temporaire renvoyé à l'admin. Utile pour ouvrir un accès à partir de
// l'email d'une organisation, sans dépendre d'un SMTP.
export async function createUserAccount(input: { email: string; fullName: string }): Promise<Result & { password?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await isUserAdmin(supabase, user.id))) return { ok: false, error: 'Action réservée aux administrateurs YCID / LEY.' }

  const email = (input.email ?? '').trim().toLowerCase()
  const fullName = (input.fullName ?? '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Adresse email invalide.' }
  if (!fullName) return { ok: false, error: 'Le nom est obligatoire.' }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return { ok: false, error: "Création de compte non configurée : ajoutez SUPABASE_SERVICE_ROLE_KEY au serveur." }

  // Mot de passe temporaire lisible (12 caractères)
  const password = randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) + 'A9'

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  try {
    const { error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName },
    })
    if (error) {
      const e = error as { message?: string; code?: string; status?: number }
      if (e.status === 422 || /already/i.test(e.message ?? '')) {
        return { ok: false, error: 'Un compte existe déjà avec cet email.' }
      }
      return { ok: false, error: `Échec de la création : ${e.message || e.code || 'erreur inconnue'}` }
    }
  } catch (e) {
    return { ok: false, error: `Échec de la création : ${e instanceof Error ? e.message : String(e)}` }
  }
  revalidatePath('/admin/utilisateurs')
  return { ok: true, password }
}
