'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canEditCompletedTasks, canManagePhases, canManageTasks, canManageBudget, canManageMeetings, isUserAdmin } from '@/lib/permissions'
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

// ============================================================
// PR 15 — Budget, indicateurs & COPIL
// ============================================================

const LINE_STATUSES = ['prevue', 'active', 'cloturee']
const LINE_CATEGORIES = ['investissement', 'fonctionnement', 'projet', 'autre']

export interface BudgetLineInput {
  projectId: string
  lineId?: string
  poste: string
  description: string
  category: string
  funder_org_id: string
  owner_org_id: string
  phase_id: string
  year: string
  planned_amount: string
  is_valorisation: boolean
  status: string
  comment: string
}

export async function saveBudgetLine(input: BudgetLineInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canManageBudget(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Gestion du budget réservée au chef de projet, au resp. financier et aux admins.' }
  }
  const poste = (input.poste ?? '').trim()
  if (!poste) return { ok: false, error: 'Le poste est obligatoire.' }
  if (!LINE_CATEGORIES.includes(input.category)) return { ok: false, error: 'Catégorie invalide.' }
  if (!LINE_STATUSES.includes(input.status)) return { ok: false, error: 'Statut invalide.' }
  const amount = Number(String(input.planned_amount ?? '').replace(',', '.'))
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: 'Montant prévisionnel invalide.' }

  const values = {
    poste,
    description: input.description?.trim() || null,
    category: input.category,
    funder_org_id: input.funder_org_id || null,
    owner_org_id: input.owner_org_id || null,
    phase_id: input.phase_id || null,
    year: input.year ? Number(input.year) : null,
    planned_amount: amount,
    is_valorisation: !!input.is_valorisation,
    status: input.status,
    comment: input.comment?.trim() || null,
  }

  if (input.lineId) {
    const { data: line } = await supabase.from('budget_lines').select('project_id').eq('id', input.lineId).maybeSingle()
    if (!line || line.project_id !== input.projectId) return { ok: false, error: 'Ligne introuvable.' }
    const { error } = await supabase.from('budget_lines').update(values).eq('id', input.lineId)
    if (error) return { ok: false, error: `Échec de la modification : ${error.message}` }
    await supabase.from('audit_log').insert({ project_id: input.projectId, entity: 'budget_line', entity_id: input.lineId, label: poste, action: 'modifie', user_id: user.id })
  } else {
    const { data: created, error } = await supabase.from('budget_lines').insert({ ...values, project_id: input.projectId }).select('id').single()
    if (error) return { ok: false, error: `Échec de la création : ${error.message}` }
    await supabase.from('audit_log').insert({ project_id: input.projectId, entity: 'budget_line', entity_id: created?.id, label: poste, action: 'cree', user_id: user.id })
  }
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

export interface IndicatorInput {
  projectId: string
  name: string
  description: string
  kind: string
  unit: string
  target: string
  baseline: string
  phase_id: string
}

export async function createIndicator(input: IndicatorInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canManageBudget(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Gestion des indicateurs réservée au chef de projet, au resp. financier et aux admins.' }
  }
  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: "Le nom de l'indicateur est obligatoire." }
  if (!['quantitatif', 'qualitatif'].includes(input.kind)) return { ok: false, error: 'Type invalide.' }
  const target = Number(String(input.target ?? '').replace(',', '.'))
  if (!Number.isFinite(target)) return { ok: false, error: 'Cible invalide.' }
  const baseline = input.baseline ? Number(String(input.baseline).replace(',', '.')) : null
  if (baseline !== null && !Number.isFinite(baseline)) return { ok: false, error: 'Valeur initiale invalide.' }

  const { data: created, error } = await supabase.from('indicators').insert({
    project_id: input.projectId, name,
    description: input.description?.trim() || null,
    kind: input.kind, unit: input.unit?.trim() || null,
    target, baseline, phase_id: input.phase_id || null,
  }).select('id').single()
  if (error) return { ok: false, error: `Échec de la création : ${error.message}` }
  await supabase.from('audit_log').insert({ project_id: input.projectId, entity: 'indicator', entity_id: created?.id, label: name, action: 'cree', user_id: user.id })
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

export interface MeasureInput {
  indicatorId: string
  period: string
  value: string
  comment: string
}

export async function addMeasure(input: MeasureInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  const { data: indicator } = await supabase.from('indicators').select('id, name, project_id').eq('id', input.indicatorId).maybeSingle()
  if (!indicator) return { ok: false, error: 'Indicateur introuvable.' }
  const period = (input.period ?? '').trim()
  if (!period) return { ok: false, error: 'La période est obligatoire (ex. 2026-T3).' }
  const value = Number(String(input.value ?? '').replace(',', '.'))
  if (!Number.isFinite(value)) return { ok: false, error: 'Valeur invalide.' }

  const { error } = await supabase.from('indicator_measures').insert({
    indicator_id: indicator.id, period, value,
    comment: input.comment?.trim() || null, entered_by: user.id,
  })
  if (error) return { ok: false, error: `Échec de la saisie : ${error.message}` }
  await supabase.from('audit_log').insert({ project_id: indicator.project_id, entity: 'indicator_measure', entity_id: indicator.id, label: `${indicator.name} — ${period} : ${value}`, action: 'cree', user_id: user.id })
  revalidatePath(`/projets/${indicator.project_id}`)
  return { ok: true }
}

export interface MeetingInput {
  projectId: string
  title: string
  kind: string
  date: string
  minutes: string
}

export async function createMeeting(input: MeetingInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canManageMeetings(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Gestion des réunions réservée au chef de projet et aux admins.' }
  }
  const title = (input.title ?? '').trim()
  if (!title) return { ok: false, error: 'Le titre est obligatoire.' }
  if (!['copil', 'technique', 'terrain'].includes(input.kind)) return { ok: false, error: 'Type de réunion invalide.' }
  if (!input.date) return { ok: false, error: 'La date est obligatoire.' }

  const { data: created, error } = await supabase.from('meetings').insert({
    project_id: input.projectId, title, kind: input.kind, date: input.date,
    minutes: input.minutes?.trim() || null, created_by: user.id,
  }).select('id').single()
  if (error) return { ok: false, error: `Échec de la création : ${error.message}` }
  await supabase.from('audit_log').insert({ project_id: input.projectId, entity: 'meeting', entity_id: created?.id, label: title, action: 'cree', user_id: user.id })
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

export interface DecisionInput {
  projectId: string
  meetingId: string
  decisionId?: string
  text: string
  owner_user_id: string
  due_date: string
  status: string
}

export async function saveDecision(input: DecisionInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canManageMeetings(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Gestion des décisions réservée au chef de projet et aux admins.' }
  }
  const text = (input.text ?? '').trim()
  if (!text) return { ok: false, error: 'Le texte de la décision est obligatoire.' }
  if (!['a_faire', 'en_cours', 'fait'].includes(input.status)) return { ok: false, error: 'Statut invalide.' }

  const values = {
    text, owner_user_id: input.owner_user_id || null,
    due_date: input.due_date || null, status: input.status,
  }

  if (input.decisionId) {
    const { data: decision } = await supabase.from('decisions').select('project_id').eq('id', input.decisionId).maybeSingle()
    if (!decision || decision.project_id !== input.projectId) return { ok: false, error: 'Décision introuvable.' }
    const { error } = await supabase.from('decisions').update(values).eq('id', input.decisionId)
    if (error) return { ok: false, error: `Échec de la modification : ${error.message}` }
    await supabase.from('audit_log').insert({ project_id: input.projectId, entity: 'decision', entity_id: input.decisionId, label: text.slice(0, 80), action: 'modifie', user_id: user.id })
  } else {
    const { data: created, error } = await supabase.from('decisions').insert({
      ...values, project_id: input.projectId, meeting_id: input.meetingId || null,
    }).select('id').single()
    if (error) return { ok: false, error: `Échec de la création : ${error.message}` }
    await supabase.from('audit_log').insert({ project_id: input.projectId, entity: 'decision', entity_id: created?.id, label: text.slice(0, 80), action: 'cree', user_id: user.id })
  }
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// ============================================================
// Gestion des membres du projet
// ============================================================

const MEMBER_ROLES = ['chef_projet', 'resp_financier', 'contributeur', 'validateur', 'auditeur', 'lecteur']

export async function addProjectMember(input: { projectId: string; userId: string; role: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canManagePhases(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Gestion des membres réservée au chef de projet et aux admins.' }
  }
  if (!input.userId) return { ok: false, error: 'Choisissez un utilisateur.' }
  if (!MEMBER_ROLES.includes(input.role)) return { ok: false, error: 'Rôle invalide.' }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', input.userId).maybeSingle()
  if (!profile) return { ok: false, error: 'Utilisateur introuvable.' }

  const { error } = await supabase.from('project_members').insert({
    project_id: input.projectId, user_id: input.userId, role: input.role,
  })
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Cet utilisateur est déjà membre du projet.' }
    return { ok: false, error: `Échec de l'ajout : ${error.message}` }
  }
  await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'project_member', entity_id: input.userId,
    label: `${profile.full_name} — ${input.role}`, action: 'cree', user_id: user.id,
  })
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

export async function removeProjectMember(input: { projectId: string; userId: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canManagePhases(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Gestion des membres réservée au chef de projet et aux admins.' }
  }
  // Garde-fou : ne pas retirer le dernier chef de projet
  const { data: chefs } = await supabase.from('project_members')
    .select('user_id').eq('project_id', input.projectId).eq('role', 'chef_projet')
  const isLastChef = (chefs ?? []).length === 1 && chefs?.[0]?.user_id === input.userId
  if (isLastChef) return { ok: false, error: 'Impossible de retirer le dernier chef de projet.' }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', input.userId).maybeSingle()
  const { error } = await supabase.from('project_members')
    .delete().eq('project_id', input.projectId).eq('user_id', input.userId)
  if (error) return { ok: false, error: `Échec du retrait : ${error.message}` }
  await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'project_member', entity_id: input.userId,
    label: `${profile?.full_name ?? input.userId} retiré du projet`, action: 'archive', user_id: user.id,
  })
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// ============================================================
// Suppression de projet (admin, double confirmation)
// ============================================================


export async function deleteProject(input: { projectId: string; confirmation: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await isUserAdmin(supabase, user.id))) {
    return { ok: false, error: 'La suppression de projet est réservée aux administrateurs YCID / LEY.' }
  }
  const { data: project } = await supabase.from('projects').select('name').eq('id', input.projectId).maybeSingle()
  if (!project) return { ok: false, error: 'Projet introuvable.' }
  // Double confirmation : saisir le nom exact du projet
  if ((input.confirmation ?? '').trim() !== project.name.trim()) {
    return { ok: false, error: 'Le nom saisi ne correspond pas — suppression annulée.' }
  }
  const { error } = await supabase.from('projects').delete().eq('id', input.projectId)
  if (error) return { ok: false, error: `Échec de la suppression : ${error.message}` }
  revalidatePath('/projets')
  return { ok: true }
}
