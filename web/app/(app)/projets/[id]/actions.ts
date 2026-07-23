'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canEditCompletedTasks } from '@/lib/permissions'
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
