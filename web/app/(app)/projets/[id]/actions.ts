'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canEditCompletedTasks, canManagePhases, canManageTasks } from '@/lib/permissions'
import type { TaskStatus } from '@/lib/types'

const TASK_STATUSES: TaskStatus[] = ['a_faire', 'en_cours', 'terminee', 'bloquee']

export interface UpdateCompletedTaskInput {
  taskId: string
  confirmation: string
  motif: string
  title: string
  description: string
  status: TaskStatus
  progress: number
  start_date: string
  end_date: string
  comment: string
}

export async function updateCompletedTask(input: UpdateCompletedTaskInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  // Double confirmation vérifiée aussi côté serveur
  if (input.confirmation !== 'MODIFIER') {
    return { ok: false, error: 'Confirmation invalide. Saisissez MODIFIER pour confirmer.' }
  }
  const motif = (input.motif ?? '').trim()
  if (motif.length < 5) {
    return { ok: false, error: 'Un motif de modification est obligatoire (5 caractères minimum).' }
  }

  const allowed = await canEditCompletedTasks(supabase, user.id)
  if (!allowed) {
    return { ok: false, error: 'Action réservée aux administrateurs YCID / LEY.' }
  }

  const { data: task } = await supabase
    .from('tasks')
    .select('id, title, status, phases:phase_id(project_id)')
    .eq('id', input.taskId)
    .single()
  if (!task) return { ok: false, error: 'Tâche introuvable.' }
  if (task.status !== 'terminee') {
    return { ok: false, error: 'Cette action ne concerne que les tâches terminées.' }
  }

  const title = (input.title ?? '').trim()
  if (!title) return { ok: false, error: 'Le titre est obligatoire.' }
  if (!TASK_STATUSES.includes(input.status)) return { ok: false, error: 'Statut invalide.' }
  const progress = Math.round(Number(input.progress))
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    return { ok: false, error: "L'avancement doit être compris entre 0 et 100." }
  }

  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      title,
      description: input.description?.trim() || null,
      status: input.status,
      progress,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      comment: input.comment?.trim() || null,
    })
    .eq('id', input.taskId)
  if (updateError) return { ok: false, error: `Échec de la mise à jour : ${updateError.message}` }

  const projectId = (task as unknown as { phases: { project_id: string } | null }).phases?.project_id ?? null
  await supabase.from('audit_log').insert({
    project_id: projectId,
    entity: 'task',
    entity_id: task.id,
    label: task.title,
    action: 'modifie',
    user_id: user.id,
    comment: `Réouverture d'une tâche terminée — motif : ${motif}`,
  })

  if (projectId) revalidatePath(`/projets/${projectId}`)
  return { ok: true }
}

// ============================================================
// PR 9 — CRUD phases & tâches
// ============================================================

const PHASE_STATUSES = ['a_venir', 'en_cours', 'terminee']

export interface PhaseInput {
  projectId: string
  phaseId?: string
  name: string
  start_date: string
  end_date: string
  status: string
  budget: string
}

export async function savePhase(input: PhaseInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canManagePhases(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Gestion des phases réservée au chef de projet et aux admins.' }
  }
  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Le nom de la phase est obligatoire.' }
  if (!PHASE_STATUSES.includes(input.status)) return { ok: false, error: 'Statut invalide.' }
  const budget = input.budget ? Number(input.budget) : null
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) return { ok: false, error: 'Budget invalide.' }
  if (input.start_date && input.end_date && input.end_date < input.start_date) {
    return { ok: false, error: 'La date de fin doit être postérieure au début.' }
  }

  const values = {
    name,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    status: input.status,
    budget,
  }

  if (input.phaseId) {
    const { data: phase } = await supabase.from('phases').select('project_id').eq('id', input.phaseId).maybeSingle()
    if (!phase || phase.project_id !== input.projectId) return { ok: false, error: 'Phase introuvable.' }
    const { error } = await supabase.from('phases').update(values).eq('id', input.phaseId)
    if (error) return { ok: false, error: `Échec de la modification : ${error.message}` }
    await supabase.from('audit_log').insert({ project_id: input.projectId, entity: 'phase', entity_id: input.phaseId, label: name, action: 'modifie', user_id: user.id })
  } else {
    const { count } = await supabase.from('phases').select('id', { count: 'exact', head: true }).eq('project_id', input.projectId)
    const { data: created, error } = await supabase.from('phases')
      .insert({ ...values, project_id: input.projectId, position: (count ?? 0) + 1 })
      .select('id').single()
    if (error) return { ok: false, error: `Échec de la création : ${error.message}` }
    await supabase.from('audit_log').insert({ project_id: input.projectId, entity: 'phase', entity_id: created?.id, label: name, action: 'cree', user_id: user.id })
  }
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

export interface TaskInput {
  phaseId: string
  taskId?: string
  title: string
  description: string
  assignee_id: string
  start_date: string
  end_date: string
  status: TaskStatus
  progress: number
}

export async function saveTask(input: TaskInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const { data: phase } = await supabase.from('phases').select('id, project_id').eq('id', input.phaseId).maybeSingle()
  if (!phase) return { ok: false, error: 'Phase introuvable.' }
  if (!(await canManageTasks(supabase, user.id, phase.project_id))) {
    return { ok: false, error: 'Gestion des tâches réservée aux membres du projet (chef, finances, contributeur) et aux admins.' }
  }

  const title = (input.title ?? '').trim()
  if (!title) return { ok: false, error: 'Le titre est obligatoire.' }
  if (!TASK_STATUSES.includes(input.status)) return { ok: false, error: 'Statut invalide.' }
  const progress = Math.round(Number(input.progress))
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    return { ok: false, error: "L'avancement doit être compris entre 0 et 100." }
  }
  if (input.start_date && input.end_date && input.end_date < input.start_date) {
    return { ok: false, error: 'La date de fin doit être postérieure au début.' }
  }

  const values = {
    title,
    description: input.description?.trim() || null,
    assignee_id: input.assignee_id || null,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    status: input.status,
    progress,
  }

  if (input.taskId) {
    const { data: task } = await supabase.from('tasks').select('id, status, phase_id').eq('id', input.taskId).maybeSingle()
    if (!task || task.phase_id !== input.phaseId) return { ok: false, error: 'Tâche introuvable.' }
    if (task.status === 'terminee') {
      return { ok: false, error: 'Cette tâche est terminée : utilisez la réouverture avec double confirmation (bouton Modifier réservé aux admins).' }
    }
    const { error } = await supabase.from('tasks').update(values).eq('id', input.taskId)
    if (error) return { ok: false, error: `Échec de la modification : ${error.message}` }
    await supabase.from('audit_log').insert({ project_id: phase.project_id, entity: 'task', entity_id: input.taskId, label: title, action: 'modifie', user_id: user.id })
  } else {
    const { data: created, error } = await supabase.from('tasks')
      .insert({ ...values, phase_id: input.phaseId, created_by: user.id })
      .select('id').single()
    if (error) return { ok: false, error: `Échec de la création : ${error.message}` }
    await supabase.from('audit_log').insert({ project_id: phase.project_id, entity: 'task', entity_id: created?.id, label: title, action: 'cree', user_id: user.id })
  }
  revalidatePath(`/projets/${phase.project_id}`)
  return { ok: true }
}
