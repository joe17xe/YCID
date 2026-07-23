'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isUserAdmin } from '@/lib/permissions'

const IDEA_STATUSES = ['idee', 'acceptee', 'en_cours', 'livree', 'refusee']
const IDEA_PRIORITIES = ['basse', 'moyenne', 'haute']

type Result = { ok: boolean; error?: string; id?: string }

export async function proposeIdea(input: { title: string; description: string; tags: string }): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  const title = (input.title ?? '').trim()
  if (!title) return { ok: false, error: 'Le titre est obligatoire.' }
  const tags = (input.tags ?? '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 5)
  const { data: created, error } = await supabase.from('ideas').insert({
    title, description: input.description?.trim() || null,
    tags: tags.length ? tags : null, author_id: user.id,
  }).select('id').single()
  if (error) return { ok: false, error: `Échec : ${error.message}` }
  revalidatePath('/roadmap')
  return { ok: true, id: created?.id }
}

export async function updateIdea(input: { ideaId: string; title: string; description: string; tags: string }): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  const { data: idea } = await supabase.from('ideas').select('author_id').eq('id', input.ideaId).maybeSingle()
  if (!idea) return { ok: false, error: 'Idée introuvable.' }
  if (idea.author_id !== user.id && !(await isUserAdmin(supabase, user.id))) {
    return { ok: false, error: "Seul l'auteur ou un admin peut modifier cette idée." }
  }
  const title = (input.title ?? '').trim()
  if (!title) return { ok: false, error: 'Le titre est obligatoire.' }
  const tags = (input.tags ?? '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 5)
  const { error } = await supabase.from('ideas').update({
    title, description: input.description?.trim() || null,
    tags: tags.length ? tags : null, updated_at: new Date().toISOString(),
  }).eq('id', input.ideaId)
  if (error) return { ok: false, error: `Échec : ${error.message}` }
  revalidatePath('/roadmap')
  revalidatePath(`/roadmap/${input.ideaId}`)
  return { ok: true }
}

// « Gestion produit » — réservé aux admins
export async function manageIdea(input: { ideaId: string; status: string; priority: string; difficulty: string }): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await isUserAdmin(supabase, user.id))) return { ok: false, error: 'Réservé aux administrateurs.' }
  if (!IDEA_STATUSES.includes(input.status)) return { ok: false, error: 'Statut invalide.' }
  if (!IDEA_PRIORITIES.includes(input.priority)) return { ok: false, error: 'Priorité invalide.' }
  const difficulty = input.difficulty ? Number(input.difficulty) : null
  if (difficulty !== null && (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)) {
    return { ok: false, error: 'Difficulté invalide (1 à 5).' }
  }
  const { error } = await supabase.from('ideas').update({
    status: input.status, priority: input.priority, difficulty,
    updated_at: new Date().toISOString(),
  }).eq('id', input.ideaId)
  if (error) return { ok: false, error: `Échec : ${error.message}` }
  revalidatePath('/roadmap')
  revalidatePath(`/roadmap/${input.ideaId}`)
  return { ok: true }
}

export async function deleteIdea(ideaId: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  const { data: idea } = await supabase.from('ideas').select('author_id').eq('id', ideaId).maybeSingle()
  if (!idea) return { ok: false, error: 'Idée introuvable.' }
  if (idea.author_id !== user.id && !(await isUserAdmin(supabase, user.id))) {
    return { ok: false, error: "Seul l'auteur ou un admin peut supprimer cette idée." }
  }
  const { error } = await supabase.from('ideas').delete().eq('id', ideaId)
  if (error) return { ok: false, error: `Échec : ${error.message}` }
  revalidatePath('/roadmap')
  return { ok: true }
}

export async function toggleVote(ideaId: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  const { data: existing } = await supabase.from('idea_votes').select('idea_id').eq('idea_id', ideaId).eq('user_id', user.id).maybeSingle()
  const { error } = existing
    ? await supabase.from('idea_votes').delete().eq('idea_id', ideaId).eq('user_id', user.id)
    : await supabase.from('idea_votes').insert({ idea_id: ideaId, user_id: user.id })
  if (error) return { ok: false, error: `Échec : ${error.message}` }
  revalidatePath('/roadmap')
  revalidatePath(`/roadmap/${ideaId}`)
  return { ok: true }
}

export async function addComment(input: { ideaId: string; body: string }): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  const body = (input.body ?? '').trim()
  if (!body) return { ok: false, error: 'Le commentaire est vide.' }
  const { error } = await supabase.from('idea_comments').insert({ idea_id: input.ideaId, author_id: user.id, body })
  if (error) return { ok: false, error: `Échec : ${error.message}` }
  revalidatePath(`/roadmap/${input.ideaId}`)
  return { ok: true }
}

export async function deleteComment(input: { commentId: string; ideaId: string }): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  const { data: comment } = await supabase.from('idea_comments').select('author_id').eq('id', input.commentId).maybeSingle()
  if (!comment) return { ok: false, error: 'Commentaire introuvable.' }
  if (comment.author_id !== user.id && !(await isUserAdmin(supabase, user.id))) {
    return { ok: false, error: "Seul l'auteur ou un admin peut supprimer ce commentaire." }
  }
  const { error } = await supabase.from('idea_comments').delete().eq('id', input.commentId)
  if (error) return { ok: false, error: `Échec : ${error.message}` }
  revalidatePath(`/roadmap/${input.ideaId}`)
  return { ok: true }
}
