'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isUserAdmin } from '@/lib/permissions'

// ============================================================
// Programmes (0055) — création et directeurs
// ============================================================
// Admin plateforme seul : un pouvoir d'échelon supérieur ne se donne
// pas depuis l'échelon qu'il gouverne (même logique que les
// auditeurs). La RLS double chaque contrôle ; les appartenances des
// directeurs sont posées par les déclencheurs de la 0055, jamais ici.

type Result = { ok: boolean; error?: string }

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' as const }
  if (!(await isUserAdmin(supabase, user.id))) return { error: 'Réservé aux administrateurs.' as const }
  return { supabase, user }
}

export async function createProgramme(input: { name: string; description: string }): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Le nom du programme est obligatoire.' }

  const { error } = await ctx.supabase.from('programmes').insert({
    name, description: input.description?.trim() || null, created_by: ctx.user.id,
  })
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Un programme porte déjà ce nom.' }
    return { ok: false, error: `Échec de la création : ${error.message}` }
  }
  revalidatePath('/admin/programmes')
  return { ok: true }
}

export async function addProgrammeDirector(input: { programmeId: string; userId: string }): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!input.userId) return { ok: false, error: 'Choisissez un compte.' }

  const { error } = await ctx.supabase.from('programme_directors')
    .insert({ programme_id: input.programmeId, user_id: input.userId })
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ce compte dirige déjà ce programme.' }
    return { ok: false, error: `Échec de la nomination : ${error.message}` }
  }

  // Trace au Journal de chaque projet du programme : la nomination
  // vient d'ARRIVER dans leur liste de membres, le Journal doit dire
  // pourquoi.
  const [{ data: projs }, { data: profile }, { data: prog }] = await Promise.all([
    ctx.supabase.from('projects').select('id').eq('programme_id', input.programmeId),
    ctx.supabase.from('profiles').select('full_name').eq('id', input.userId).maybeSingle(),
    ctx.supabase.from('programmes').select('name').eq('id', input.programmeId).maybeSingle(),
  ])
  const who = profile?.full_name ?? input.userId
  for (const p of projs ?? []) {
    await ctx.supabase.from('audit_log').insert({
      project_id: p.id, entity: 'project_member', entity_id: input.userId,
      label: who, action: 'cree', user_id: ctx.user.id,
      comment: `Nommé·e directeur·rice du programme « ${prog?.name ?? '—'} »`,
    })
  }
  revalidatePath('/admin/programmes')
  return { ok: true }
}

export async function removeProgrammeDirector(input: { programmeId: string; userId: string }): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { ok: false, error: ctx.error }

  const { error } = await ctx.supabase.from('programme_directors')
    .delete().eq('programme_id', input.programmeId).eq('user_id', input.userId)
  if (error) return { ok: false, error: `Échec du retrait : ${error.message}` }
  revalidatePath('/admin/programmes')
  return { ok: true }
}
