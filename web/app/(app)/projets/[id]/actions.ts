'use server'

import { randomBytes, randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { adminCreateUser } from '@/lib/supabase/auth-admin'
import { canEditCompletedTasks, canManagePhases, canManageMembers, canManageAuditors, canManageTasks, canManageBudget, canManageMeetings, isUserAdmin } from '@/lib/permissions'
import { notifyUser } from '@/lib/notify'
import { ASSIGNABLE_ROLES, isAuditorSeat } from '@/lib/rbac'
import { notifyPeople, projectLeads } from '@/lib/notify-circuit'
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
  if (input.start_date && input.end_date && input.end_date < input.start_date) {
    return { ok: false, error: 'La date de fin doit être postérieure au début.' }
  }

  const values = {
    name,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    status: input.status,
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

  let previousAssignee: string | null = null
  if (input.taskId) {
    const { data: task } = await supabase.from('tasks').select('id, status, phase_id, assignee_id').eq('id', input.taskId).maybeSingle()
    if (!task || task.phase_id !== input.phaseId) return { ok: false, error: 'Tâche introuvable.' }
    if (task.status === 'terminee') {
      return { ok: false, error: 'Cette tâche est terminée : utilisez la réouverture avec double confirmation (bouton Modifier réservé aux admins).' }
    }
    previousAssignee = task.assignee_id ?? null
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

  // Notification à l'assigné (nouvelle assignation seulement, jamais soi-même)
  if (values.assignee_id && values.assignee_id !== user.id && values.assignee_id !== previousAssignee) {
    const { data: project } = await supabase.from('projects').select('name').eq('id', phase.project_id).maybeSingle()
    await notifyUser(values.assignee_id, 'task_assigned', {
      title: `Tâche « ${title} » vous a été assignée${project?.name ? ` — ${project.name}` : ''}`,
      href: `/projets/${phase.project_id}`,
    })
  }

  // Tâche achevée : prévenir les responsables du projet (arbitrage du
  // 25/07 — « des mails à chaque notification, surtout de validation ou
  // d'action terminée »). Le responsable n'est pas toujours celui qui
  // exécute ; sans cela il découvre l'avancement en rouvrant l'écran.
  if (input.status === 'terminee') {
    const { data: project } = await supabase.from('projects').select('name').eq('id', phase.project_id).maybeSingle()
    const leads = (await projectLeads(phase.project_id)).filter(id => id !== user.id)
    await notifyPeople(leads, {
      type: 'tache_terminee',
      title: `Tâche terminée : « ${title} » — ${project?.name ?? 'projet'}`,
      body: [
        `La tâche « ${title} » vient d'être marquée terminée.`,
        `Une tâche achevée sans pièce jointe reste signalée « sans justificatif » : c'est le moment de vérifier.`,
      ],
      path: `/projets/${phase.project_id}?tab=taches`,
      linkLabel: 'Voir la tâche',
    })
  }

  revalidatePath(`/projets/${phase.project_id}`)
  return { ok: true }
}

// ------------------------------------------------------------
// Supprimer une tâche
// ------------------------------------------------------------
// Absente jusqu'ici : les policies de suppression existaient depuis la
// 0005, mais aucune action ni aucun bouton ne les utilisait. Une tâche
// créée par erreur — deux clics sur « Créer la tâche » suffisent —
// restait donc définitivement dans le projet.
//
// Une tâche TERMINÉE reste protégée par le même verrou que sa
// modification : seuls les profils habilités peuvent y toucher, et la
// base tranche de toute façon.
export async function deleteTask(input: { taskId: string; projectId: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const { data: task } = await supabase.from('tasks')
    .select('id, title, status, phases:phase_id(project_id)')
    .eq('id', input.taskId).maybeSingle()
  if (!task) return { ok: false, error: 'Tâche introuvable.' }
  const phase = Array.isArray(task.phases) ? task.phases[0] : task.phases
  if (!phase || phase.project_id !== input.projectId) return { ok: false, error: 'Tâche introuvable.' }
  if (!(await canManageTasks(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Suppression réservée aux membres du projet (chef, finances, contributeur) et aux admins.' }
  }

  // Ce que la suppression emporte, dit AVANT de la faire : les pièces
  // jointes perdent leur rattachement (task_id passe à null) et les
  // affectations budgétaires disparaissent. Le montant retourne au
  // « non affecté » de sa ligne, il n'est pas perdu.
  const { error } = await supabase.from('tasks').delete().eq('id', input.taskId)
  if (error) {
    return {
      ok: false,
      error: task.status === 'terminee'
        ? 'Cette tâche est terminée : sa suppression est réservée aux administrateurs.'
        : `Suppression refusée : ${error.message}`,
    }
  }

  const { error: auditErr } = await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'task', entity_id: null,
    label: task.title, action: 'supprime', user_id: user.id,
  })
  if (auditErr) console.error('[audit] trace NON enregistrée:', auditErr.message)

  revalidatePath(`/projets/${input.projectId}`)
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
  // Répartition sur les tâches (PR 40b) : une ligne de 40 000 € peut se
  // découper en 10 000 € + 30 000 €. Liste vide = ligne non répartie
  // (valorisation, frais de structure).
  allocations: { task_id: string; amount: string }[]
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

  // Répartition : validée ici pour rendre un message lisible, et de
  // nouveau par le trigger — l'import CSV n'emprunte pas ce chemin.
  const allocations: { task_id: string; amount: number }[] = []
  for (const a of input.allocations ?? []) {
    if (!a.task_id) continue
    const v = Number(String(a.amount ?? '').replace(',', '.') || '0')
    if (!Number.isFinite(v) || v < 0) return { ok: false, error: 'Montant de répartition invalide.' }
    if (allocations.some(x => x.task_id === a.task_id)) {
      return { ok: false, error: 'Une même tâche ne peut apparaître deux fois dans la répartition.' }
    }
    allocations.push({ task_id: a.task_id, amount: v })
  }
  const allocated = allocations.reduce((s, a) => s + a.amount, 0)
  if (allocated > amount) {
    return { ok: false, error: `La répartition (${allocated} €) dépasse le montant de la ligne (${amount} €).` }
  }

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

  let lineId: string
  if (input.lineId) {
    const { data: line } = await supabase.from('budget_lines').select('project_id').eq('id', input.lineId).maybeSingle()
    if (!line || line.project_id !== input.projectId) return { ok: false, error: 'Ligne introuvable.' }
    // Purger la répartition AVANT d'écrire la ligne : baisser le montant
    // ou changer de phase serait sinon rejeté par le trigger, qui voit
    // encore l'ancienne répartition.
    const { error: clearErr } = await supabase.from('budget_line_tasks').delete().eq('budget_line_id', input.lineId)
    if (clearErr) return { ok: false, error: `Échec de la mise à jour de la répartition : ${clearErr.message}` }
    const { error } = await supabase.from('budget_lines').update(values).eq('id', input.lineId)
    if (error) return { ok: false, error: `Échec de la modification : ${error.message}` }
    lineId = input.lineId
    await supabase.from('audit_log').insert({ project_id: input.projectId, entity: 'budget_line', entity_id: input.lineId, label: poste, action: 'modifie', user_id: user.id })
  } else {
    const { data: created, error } = await supabase.from('budget_lines').insert({ ...values, project_id: input.projectId }).select('id').single()
    if (error || !created) return { ok: false, error: `Échec de la création : ${error?.message ?? 'ligne non créée'}` }
    lineId = created.id
    await supabase.from('audit_log').insert({ project_id: input.projectId, entity: 'budget_line', entity_id: created.id, label: poste, action: 'cree', user_id: user.id })
  }

  if (allocations.length) {
    const { error: allocErr } = await supabase.from('budget_line_tasks')
      .insert(allocations.map(a => ({ budget_line_id: lineId, task_id: a.task_id, amount: a.amount })))
    if (allocErr) return { ok: false, error: `Ligne enregistrée, mais la répartition a échoué : ${allocErr.message}` }
  }
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// ------------------------------------------------------------
// Création croisée (PR 40) : depuis une ligne, créer la tâche
// ------------------------------------------------------------
// Le rattachement seul suppose que la tâche ET la ligne existent déjà —
// il fallait donc saisir deux fois avant de pouvoir relier. Ce raccourci
// crée la tâche à partir du poste de la ligne et lui affecte le montant
// non encore réparti. Le sens inverse (depuis une tâche, ajouter une
// ligne) ne demande pas d'action dédiée : le dialogue de ligne est
// simplement pré-rempli.
export async function createTaskFromBudgetLine(input: { projectId: string; lineId: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const { data: line } = await supabase.from('budget_lines')
    .select('id, project_id, poste, phase_id, planned_amount')
    .eq('id', input.lineId).maybeSingle()
  if (!line || line.project_id !== input.projectId) return { ok: false, error: 'Ligne introuvable.' }

  // Les deux droits sont requis : l'opération crée une tâche ET modifie
  // la répartition budgétaire.
  const [okTasks, okBudget] = await Promise.all([
    canManageTasks(supabase, user.id, line.project_id),
    canManageBudget(supabase, user.id, line.project_id),
  ])
  if (!okTasks || !okBudget) {
    return { ok: false, error: 'Création réservée aux profils autorisés à la fois sur les tâches et sur le budget.' }
  }
  if (!line.phase_id) {
    return { ok: false, error: "Rattachez d'abord cette ligne à une phase : une tâche appartient toujours à une phase." }
  }

  const title = (line.poste ?? '').trim()
  if (!title) return { ok: false, error: 'Le poste de la ligne est vide : impossible d\'en tirer un titre de tâche.' }

  // Garde-fou d'idempotence. Le bouton pouvait être actionné deux fois
  // sur la même ligne : la première création affectait le montant, la
  // seconde naissait vide, et la phase se retrouvait avec deux tâches
  // strictement homonymes — constaté en production. Rien dans le nom ne
  // permet ensuite de les distinguer.
  const { data: twin } = await supabase.from('tasks')
    .select('id').eq('phase_id', line.phase_id).eq('title', title).maybeSingle()
  if (twin) {
    return {
      ok: false,
      error: `Une tâche « ${title} » existe déjà dans cette phase. Rattachez-la depuis le dialogue de la ligne plutôt que d'en créer une seconde.`,
    }
  }

  // Montant restant à répartir : créer une tâche ne doit pas faire
  // dépasser le total de la ligne (le trigger le refuserait de toute façon).
  const { data: existing } = await supabase.from('budget_line_tasks')
    .select('amount').eq('budget_line_id', line.id)
  const allocated = (existing ?? []).reduce((s, a) => s + (a.amount ?? 0), 0)
  const rest = Math.max(0, (line.planned_amount ?? 0) - allocated)

  const { data: task, error: taskErr } = await supabase.from('tasks')
    .insert({ phase_id: line.phase_id, title, status: 'a_faire', progress: 0, created_by: user.id })
    .select('id').single()
  if (taskErr || !task) return { ok: false, error: `Échec de la création de la tâche : ${taskErr?.message ?? 'tâche non créée'}` }

  const { error: allocErr } = await supabase.from('budget_line_tasks')
    .insert({ budget_line_id: line.id, task_id: task.id, amount: rest })
  if (allocErr) {
    // La tâche existe désormais sans financement : on le dit plutôt que
    // de laisser croire que le lien est fait.
    return { ok: false, error: `Tâche « ${title} » créée, mais son rattachement au budget a échoué : ${allocErr.message}` }
  }

  await supabase.from('audit_log').insert({
    project_id: line.project_id, entity: 'task', entity_id: task.id,
    label: title, action: 'cree', user_id: user.id,
    comment: `Tâche créée depuis la ligne budgétaire « ${title} » — ${rest} € affectés`,
  })
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

// Attribuables seulement : « validateur » et « auditeur » subsistent
// dans l'enum PostgreSQL, qui ne perd jamais ses valeurs, mais ne
// doivent plus être posés sur personne (0038).
const MEMBER_ROLES: string[] = ASSIGNABLE_ROLES

export async function addProjectMember(input: { projectId: string; userId: string; role: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canManageMembers(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Gestion des membres réservée au responsable projet et aux admins.' }
  }
  // Le contrôlé ne choisit pas son contrôleur (0047). La base le refuse
  // aussi : ce contrôle-ci ne fait que remplacer une erreur Postgres
  // brute par une phrase qui dit pourquoi.
  if (isAuditorSeat(input.role) && !(await canManageAuditors(supabase, user.id))) {
    return { ok: false, error: 'Nommer un auditeur est réservé à l’administrateur : le contrôlé ne choisit pas son contrôleur.' }
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

  // Notification au nouveau membre
  if (input.userId !== user.id) {
    const { data: project } = await supabase.from('projects').select('name').eq('id', input.projectId).maybeSingle()
    await notifyUser(input.userId, 'member_added', {
      title: `Vous avez été ajouté au projet${project?.name ? ` « ${project.name} »` : ''}`,
      href: `/projets/${input.projectId}`,
    })
  }

  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// ------------------------------------------------------------
// PR 29 — Délégation : le chef de projet crée un compte rattaché
// à SON projet uniquement. Le compte est toujours « Utilisateur »
// (jamais admin), invisible ailleurs. Modèle validé le 24/07/2026 :
// admin → tout ; YCID → tout sauf admins ; asso → son projet.
// ------------------------------------------------------------
export async function createProjectUser(input: {
  projectId: string; fullName: string; email: string; role: string
}): Promise<{ ok: boolean; error?: string; tempPassword?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Non authentifié.' }
    if (!(await canManageMembers(supabase, user.id, input.projectId))) {
      return { ok: false, error: 'Invitation réservée au responsable projet et aux admins.' }
    }
    if (isAuditorSeat(input.role) && !(await canManageAuditors(supabase, user.id))) {
      return { ok: false, error: 'Nommer un auditeur est réservé à l’administrateur : le contrôlé ne choisit pas son contrôleur.' }
    }
    const fullName = (input.fullName ?? '').trim()
    if (!fullName) return { ok: false, error: 'Le nom complet est obligatoire.' }
    const email = (input.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Adresse email invalide.' }
    if (!MEMBER_ROLES.includes(input.role)) return { ok: false, error: 'Rôle invalide.' }

    const admin = adminClient()
    if (!admin) return { ok: false, error: "Invitation non configurée : ajoutez SUPABASE_SERVICE_ROLE_KEY au serveur." }

    // Mot de passe temporaire (16 caractères) montré une seule fois au chef
    const tempPassword = randomBytes(12).toString('base64url')

    // Appel direct à l'API Auth admin (cf. lib/supabase/auth-admin.ts)
    const created = await adminCreateUser({ email, password: tempPassword, fullName })
    if (!created.ok || !created.userId) {
      if (created.status === 422) {
        return { ok: false, error: 'Un compte existe déjà avec cet email — ajoutez-le comme membre via « Ajouter un membre ».' }
      }
      return { ok: false, error: created.error ?? 'Échec de la création du compte.' }
    }
    const newUserId = created.userId

    // Toujours simple Utilisateur — la délégation ne crée jamais d'admin
    const { error: pErr } = await admin.from('profiles').update({
      full_name: fullName, platform_role: 'user', is_platform_admin: false, active: true,
    }).eq('id', newUserId)
    if (pErr) console.error('[createProjectUser] profil non complété:', pErr.message)

    const { error: mErr } = await admin.from('project_members').insert({
      project_id: input.projectId, user_id: newUserId, role: input.role,
    })
    if (mErr) {
      console.error('[createProjectUser] rattachement projet échoué:', mErr.message)
      return { ok: false, error: `Compte créé mais rattachement au projet échoué : ${mErr.message}`, tempPassword }
    }

    await supabase.from('audit_log').insert({
      project_id: input.projectId, entity: 'project_member', entity_id: newUserId,
      label: `${fullName} — ${input.role}`, action: 'cree', user_id: user.id,
      comment: 'Compte créé par délégation (chef de projet)',
    })

    revalidatePath(`/projets/${input.projectId}`)
    return { ok: true, tempPassword }
  } catch (e) {
    console.error('[createProjectUser] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

export async function removeProjectMember(input: { projectId: string; userId: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canManageMembers(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Gestion des membres réservée au responsable projet et aux admins.' }
  }
  // Retirer l'auditeur de son propre projet, c'est retirer le contrôle
  // (0047). Le geste reste possible — un auditeur peut changer — mais il
  // remonte à l'administrateur.
  {
    const { data: target } = await supabase.from('project_members')
      .select('role').eq('project_id', input.projectId).eq('user_id', input.userId).maybeSingle()
    if (isAuditorSeat(target?.role) && !(await canManageAuditors(supabase, user.id))) {
      return { ok: false, error: 'Retirer un auditeur est réservé à l’administrateur : le contrôlé ne choisit pas son contrôleur.' }
    }
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


// ------------------------------------------------------------
// PR 28 — Page vitrine publique (opt-in, jeton non devinable)
// ------------------------------------------------------------
export async function setPublicPage(projectId: string, enabled: boolean): Promise<{ ok: boolean; error?: string; token?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Non authentifié.' }
    if (!(await canManagePhases(supabase, user.id, projectId))) {
      return { ok: false, error: 'Page publique réservée au chef de projet et aux admins.' }
    }
    const admin = adminClient()
    if (!admin) return { ok: false, error: 'Non configuré : ajoutez SUPABASE_SERVICE_ROLE_KEY au serveur.' }

    const token = enabled ? randomUUID() : null
    const { error } = await admin.from('projects').update({ public_token: token }).eq('id', projectId)
    if (error) {
      const missing = /public_token|column .* does not exist/i.test(`${error.message}`)
      return { ok: false, error: missing ? 'Appliquez la migration 0021_public_page.sql dans le SQL Editor Supabase.' : `Échec : ${error.message}` }
    }
    await supabase.from('audit_log').insert({
      project_id: projectId, entity: 'project', entity_id: projectId,
      label: enabled ? 'Page publique activée' : 'Page publique désactivée',
      action: 'modifie', user_id: user.id,
    })
    revalidatePath(`/projets/${projectId}`)
    return { ok: true, token: token ?? undefined }
  } catch (e) {
    console.error('[setPublicPage] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

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

// ============================================================
// Édition de la fiche projet (J4)
// ============================================================
// Rien ne permettait de modifier un projet après sa création : ni le
// nom, ni les dates, ni surtout le MONTANT VOTÉ, devenu la référence du
// pilotage financier avec la PR 39. Une erreur de saisie à la création
// était définitive — figée par accident, pas par choix (seuls
// `public_token` et `programme` avaient un chemin de mise à jour).

export interface ProjectEditInput {
  projectId: string
  name: string
  description: string
  country: string
  zone: string
  programme: string
  start_date: string
  end_date: string
  status: string
  budget: string
  // L'organisation porteuse décide du PREMIER échelon de validation
  // (0041). Elle se figeait à la création : impossible de la corriger le
  // jour où le portage change.
  lead_org_id: string
  // Position sur la carte du tableau de bord (V1, Lot 3) — saisie
  // manuelle, jamais géocodée
  lat: string
  lng: string
}

const PROJECT_STATUSES = ['en_preparation', 'en_cours', 'suspendu', 'termine']

export async function updateProject(input: ProjectEditInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  // Même droit que la gestion des phases : piloter le projet.
  if (!(await canManagePhases(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Modification du projet réservée au responsable projet et aux admins.' }
  }

  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Le nom du projet est obligatoire.' }
  if (!PROJECT_STATUSES.includes(input.status)) return { ok: false, error: 'Statut invalide.' }
  const budget = (input.budget ?? '').trim() ? Number(input.budget) : null
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
    return { ok: false, error: 'Le montant voté doit être un nombre positif.' }
  }
  if (input.start_date && input.end_date && input.end_date < input.start_date) {
    return { ok: false, error: 'La date de fin doit être postérieure à la date de début.' }
  }
  // Les deux coordonnées vont ensemble : une latitude seule ne place
  // aucun repère, elle ne ferait que DONNER L'IMPRESSION d'une saisie
  // réussie — le refus explicite vaut mieux que le silence.
  const lat = (input.lat ?? '').trim() ? Number(input.lat) : null
  const lng = (input.lng ?? '').trim() ? Number(input.lng) : null
  if ((lat === null) !== (lng === null)) {
    return { ok: false, error: 'Latitude et longitude vont ensemble : renseignez les deux, ou aucune.' }
  }
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
    return { ok: false, error: 'La latitude doit être un nombre décimal entre -90 et 90.' }
  }
  if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
    return { ok: false, error: 'La longitude doit être un nombre décimal entre -180 et 180.' }
  }

  const { data: before } = await supabase.from('projects')
    .select('name, budget, lead_org_id').eq('id', input.projectId).maybeSingle()
  if (!before) return { ok: false, error: 'Projet introuvable.' }

  const leadOrgId = (input.lead_org_id ?? '').trim() || null
  if (!leadOrgId) return { ok: false, error: "L'organisation porteuse est obligatoire : c'est elle qui valide en premier." }
  const leadChanged = (before.lead_org_id ?? null) !== leadOrgId

  const { error } = await supabase.from('projects').update({
    lead_org_id: leadOrgId,
    name,
    description: input.description?.trim() || null,
    country: input.country?.trim() || null,
    zone: input.zone?.trim() || null,
    programme: input.programme?.trim() || null,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    status: input.status,
    budget,
    lat,
    lng,
  }).eq('id', input.projectId)
  if (error) return { ok: false, error: `Échec de la modification : ${error.message}` }

  // Le montant voté est une donnée contractuelle : son changement se
  // trace nommément, avec l'ancienne et la nouvelle valeur. « Projet
  // modifié » ne suffirait pas six mois plus tard devant un financeur
  // qui demande pourquoi l'enveloppe a bougé.
  // Changer le porteur change QUI valide en premier. Le rôle « porteur »
  // de project_organizations doit suivre, sans quoi l'écran et la chaîne
  // de validation désigneraient deux organisations différentes — une
  // divergence silencieuse, qui enverrait le devis au mauvais endroit.
  let leadNote = ''
  if (leadChanged) {
    if (before.lead_org_id) {
      // L'ancienne porteuse reste rattachée au projet, mais redevient
      // partenaire : la retirer perdrait son historique.
      await supabase.from('project_organizations')
        .update({ role: 'partenaire' })
        .eq('project_id', input.projectId).eq('org_id', before.lead_org_id).eq('role', 'porteur')
    }
    // Clé composite (project_id, org_id) : cette table n'a pas d'`id`.
    // L'upsert sur la clé primaire couvre les deux cas — l'organisation
    // était déjà rattachée au projet, ou elle ne l'était pas.
    const { error: poErr } = await supabase.from('project_organizations')
      .upsert({ project_id: input.projectId, org_id: leadOrgId, role: 'porteur' },
              { onConflict: 'project_id,org_id' })
    if (poErr) {
      return { ok: false, error: `Le projet est modifié, mais le rôle « porteur » n'a pas suivi : ${poErr.message}. Signalez-le — l'écran et le circuit de validation désigneraient deux organisations différentes.` }
    }
    const { data: orgs } = await supabase.from('organizations')
      .select('id, name').in('id', [before.lead_org_id, leadOrgId].filter(Boolean) as string[])
    const nameOf = (id: string | null) => orgs?.find(o => o.id === id)?.name ?? 'non renseignée'
    leadNote = ` — ORGANISATION PORTEUSE : ${nameOf(before.lead_org_id)} → ${nameOf(leadOrgId)} (change le premier échelon de validation)`
  }

  const eur = (n: number | null) => n == null ? 'non renseigné' : `${Math.round(n).toLocaleString('fr-FR')} €`
  const budgetChanged = (before.budget ?? null) !== budget
  const { error: auditErr } = await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'project', entity_id: input.projectId,
    label: name, action: 'modifie', user_id: user.id,
    comment: [
      'Fiche projet modifiée',
      budgetChanged ? ` — MONTANT VOTÉ : ${eur(before.budget)} → ${eur(budget)}` : '',
      leadNote,
    ].join(''),
  })
  if (auditErr) console.error('[audit] trace NON enregistrée:', auditErr.message)

  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// ------------------------------------------------------------
// Changer le rôle d'un membre
// ------------------------------------------------------------
// Il n'existait qu'ajouter et retirer. Pour remplacer un responsable, il
// fallait donc en ajouter un second puis retirer le premier — le garde-fou
// « ne pas retirer le dernier chef de projet » l'imposait. Et pour
// rétrograder quelqu'un, le retirer puis le rajouter, ce qui efface son
// historique d'appartenance.
export async function updateProjectMemberRole(input: { projectId: string; userId: string; role: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canManageMembers(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Gestion des membres réservée au responsable projet et aux admins.' }
  }
  if (!MEMBER_ROLES.includes(input.role)) return { ok: false, error: 'Rôle invalide.' }

  const { data: current } = await supabase.from('project_members')
    .select('role').eq('project_id', input.projectId).eq('user_id', input.userId).maybeSingle()
  if (!current) return { ok: false, error: 'Ce membre ne fait pas partie du projet.' }
  if (current.role === input.role) return { ok: true }

  // Les deux sens comptent (0047) : rétrograder un auditeur le fait
  // disparaître du contrôle, en promouvoir un le fait apparaître. Un
  // seul des deux gardes laisserait la moitié de la porte ouverte.
  if ((isAuditorSeat(current.role) || isAuditorSeat(input.role))
      && !(await canManageAuditors(supabase, user.id))) {
    return { ok: false, error: 'Le siège d’auditeur est réservé à l’administrateur : le contrôlé ne choisit pas son contrôleur.' }
  }

  // Même garde-fou que le retrait : rétrograder le dernier responsable
  // laisserait le projet sans personne pour le piloter. Le contournement
  // reste le bon geste — nommer le suivant d'abord.
  if (current.role === 'chef_projet') {
    const { data: chefs } = await supabase.from('project_members')
      .select('user_id').eq('project_id', input.projectId).eq('role', 'chef_projet')
    if ((chefs ?? []).length === 1) {
      return { ok: false, error: 'Ce compte est le dernier responsable projet : nommez son remplaçant avant de changer son rôle.' }
    }
  }

  const { error } = await supabase.from('project_members')
    .update({ role: input.role }).eq('project_id', input.projectId).eq('user_id', input.userId)
  if (error) return { ok: false, error: `Échec du changement de rôle : ${error.message}` }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', input.userId).maybeSingle()
  const { error: auditErr } = await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'project_member', entity_id: input.userId,
    label: profile?.full_name ?? input.userId, action: 'modifie', user_id: user.id,
    comment: `Rôle projet : ${current.role} → ${input.role}`,
  })
  if (auditErr) console.error('[audit] trace NON enregistrée:', auditErr.message)

  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}
