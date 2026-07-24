'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isUserAdmin } from '@/lib/permissions'

const PLATFORM_ROLES = ['admin', 'ycid', 'user']

// Rôle plateforme de l'utilisateur connecté + garde-fous
async function currentContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' as const }
  if (!(await isUserAdmin(supabase, user.id))) return { error: 'Gestion des utilisateurs réservée aux administrateurs.' as const }
  const { data: me } = await supabase.from('profiles').select('platform_role, is_platform_admin').eq('id', user.id).maybeSingle()
  const myRole = me?.platform_role ?? (me?.is_platform_admin ? 'admin' : 'user')
  return { user, myRole }
}

function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type Result = { ok: boolean; error?: string }

interface UserFormInput {
  fullName: string
  email: string
  role: string
  password: string
  confirmPassword: string
  active: boolean
}

function validate(input: UserFormInput, requirePassword: boolean): string | null {
  if (!input.fullName?.trim()) return 'Le nom complet est obligatoire.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((input.email ?? '').trim())) return 'Adresse email invalide.'
  if (!PLATFORM_ROLES.includes(input.role)) return 'Rôle invalide.'
  if (requirePassword || input.password) {
    if ((input.password ?? '').length < 12) return 'Le mot de passe doit contenir au moins 12 caractères.'
    if (input.password !== input.confirmPassword) return 'La confirmation ne correspond pas au mot de passe.'
  }
  return null
}

export async function createUser(input: UserFormInput): Promise<Result> {
  const supabase = await createClient()
  const ctx = await currentContext(supabase)
  if ('error' in ctx) return { ok: false, error: ctx.error }
  // Un YCID ne peut pas créer d'Administrateur
  if (ctx.myRole === 'ycid' && input.role === 'admin') {
    return { ok: false, error: "Le rôle YCID ne peut pas créer d'Administrateur." }
  }
  const invalid = validate(input, true)
  if (invalid) return { ok: false, error: invalid }

  const admin = adminClient()
  if (!admin) return { ok: false, error: "Création non configurée : ajoutez SUPABASE_SERVICE_ROLE_KEY au serveur." }

  const email = input.email.trim().toLowerCase()
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: input.password, email_confirm: true,
    user_metadata: { full_name: input.fullName.trim() },
  })
  if (error) {
    if ((error as { status?: number }).status === 422 || /already/i.test(error.message)) return { ok: false, error: 'Un compte existe déjà avec cet email.' }
    return { ok: false, error: `Échec de la création : ${error.message}` }
  }
  // Le trigger crée profiles ; on complète rôle + statut
  await admin.from('profiles').update({
    full_name: input.fullName.trim(),
    platform_role: input.role,
    is_platform_admin: input.role !== 'user',
    active: !!input.active,
  }).eq('id', created.user!.id)

  revalidatePath('/admin/utilisateurs')
  return { ok: true }
}

export async function updateUser(userId: string, input: UserFormInput): Promise<Result> {
  const supabase = await createClient()
  const ctx = await currentContext(supabase)
  if ('error' in ctx) return { ok: false, error: ctx.error }

  const { data: target } = await supabase.from('profiles').select('platform_role, email').eq('id', userId).maybeSingle()
  if (!target) return { ok: false, error: 'Utilisateur introuvable.' }
  // Un YCID ne peut ni modifier un Administrateur, ni promouvoir en Administrateur
  if (ctx.myRole === 'ycid' && (target.platform_role === 'admin' || input.role === 'admin')) {
    return { ok: false, error: "Le rôle YCID ne peut pas modifier ni créer un Administrateur." }
  }
  const invalid = validate(input, false)
  if (invalid) return { ok: false, error: invalid }

  const admin = adminClient()
  if (!admin) return { ok: false, error: "Modification non configurée : ajoutez SUPABASE_SERVICE_ROLE_KEY au serveur." }

  const email = input.email.trim().toLowerCase()
  // Auth : email et/ou mot de passe
  const authUpdate: { email?: string; password?: string } = {}
  if (email !== (target.email ?? '').toLowerCase()) authUpdate.email = email
  if (input.password) authUpdate.password = input.password
  if (Object.keys(authUpdate).length) {
    const { error } = await admin.auth.admin.updateUserById(userId, authUpdate)
    if (error) return { ok: false, error: `Échec (authentification) : ${error.message}` }
  }
  // Profil : nom, email, rôle, statut
  const { error: pErr } = await admin.from('profiles').update({
    full_name: input.fullName.trim(),
    email,
    platform_role: input.role,
    is_platform_admin: input.role !== 'user',
    active: !!input.active,
  }).eq('id', userId)
  if (pErr) return { ok: false, error: `Échec (profil) : ${pErr.message}` }

  revalidatePath('/admin/utilisateurs')
  return { ok: true }
}

export async function deleteUser(userId: string): Promise<Result> {
  const supabase = await createClient()
  const ctx = await currentContext(supabase)
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (ctx.user.id === userId) return { ok: false, error: 'Vous ne pouvez pas supprimer votre propre compte.' }

  const { data: target } = await supabase.from('profiles').select('platform_role').eq('id', userId).maybeSingle()
  if (!target) return { ok: false, error: 'Utilisateur introuvable.' }
  if (ctx.myRole === 'ycid' && target.platform_role === 'admin') {
    return { ok: false, error: "Le rôle YCID ne peut pas supprimer un Administrateur." }
  }
  // Ne pas supprimer le dernier administrateur
  if (target.platform_role === 'admin') {
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('platform_role', 'admin')
    if ((count ?? 0) <= 1) return { ok: false, error: 'Impossible de supprimer le dernier Administrateur.' }
  }

  const admin = adminClient()
  if (!admin) return { ok: false, error: "Suppression non configurée : ajoutez SUPABASE_SERVICE_ROLE_KEY au serveur." }
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { ok: false, error: `Échec de la suppression : ${error.message}` }

  revalidatePath('/admin/utilisateurs')
  return { ok: true }
}

// Variantes qui redirigent (utilisées par les pages formulaire créer/éditer)
export async function createUserAndRedirect(input: UserFormInput): Promise<Result> {
  const res = await createUser(input)
  if (res.ok) redirect('/admin/utilisateurs')
  return res
}

export async function updateUserAndRedirect(userId: string, input: UserFormInput): Promise<Result> {
  const res = await updateUser(userId, input)
  if (res.ok) redirect('/admin/utilisateurs')
  return res
}
