'use server'

import { randomBytes, randomUUID } from 'crypto'
import { EMAIL_RE } from '@/lib/email'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { adminCreateUser } from '@/lib/supabase/auth-admin'
import { canEditCompletedTasks, canManagePhases, canManageMembers, canManageAuditors, canManageTasks, canManageBudget, canManageMeetings, isUserAdmin } from '@/lib/permissions'
import { notifyUser } from '@/lib/notify'
import { fmtDate } from '@/lib/constants'
import { isEngagedDoc, isPaidDoc, fmtEur, type DocLike } from '@/lib/budget'
import { ASSIGNABLE_ROLES, isAuditorSeat } from '@/lib/rbac'
import { notifyPeople, projectLeads, membersOfOrgs } from '@/lib/notify-circuit'
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
  // ----------------------------------------------------------
  // Une trace de suppression qui n'atterrit pas — règle commune
  // ----------------------------------------------------------
  // Le raisonnement vaut pour les cinq suppressions de l'application
  // (tâche ici, phase, ligne budgétaire, pièce jointe, purge du
  // stockage) ; les autres s'y réfèrent.
  //
  // On ne casse PAS le geste. Quand on arrive ici, la ligne est déjà
  // supprimée : il n'y a plus rien à annuler — ces appels ne partagent
  // aucune transaction — et répondre `ok: false` mentirait. L'utilisateur
  // retenterait, et lirait « Tâche introuvable » sur une tâche qu'il
  // vient de faire disparaître. Un refus après coup n'est pas un refus,
  // c'est une confusion de plus.
  //
  // Mais on ne se contente plus de dire QUE la trace a échoué. Jusqu'à
  // la 0058, cette ligne de log affichait le message de PostgreSQL et
  // rien d'autre : même en la lisant, on ne savait pas quelle
  // suppression n'avait pas été inscrite. Elle porte désormais TOUT ce
  // que la trace aurait porté. Après une suppression, c'est le dernier
  // témoin de ce qui a disparu, et il doit suffire à réinscrire
  // l'entrée à la main.
  //
  // Pourquoi cette exigence ici et pas sur les traces de création ou de
  // modification, qui gardent leur `console.error` bref : leur objet
  // existe toujours en base, la trace manquante s'y reconstitue. Ici,
  // non.
  //
  // Ce qui manque encore, faute de pouvoir toucher aux écrans : rien
  // n'en remonte à l'utilisateur. Le journal serveur est lu par
  // l'exploitant, pas par le chef de projet.
  if (auditErr) {
    console.error('[audit] SUPPRESSION NON TRACÉE — à réinscrire à la main :',
      JSON.stringify({ project_id: input.projectId, entity: 'task', label: task.title, user_id: user.id }),
      '—', auditErr.message)
  }

  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// ------------------------------------------------------------
// Suppressions mesurées — protocole commun aux deux qui suivent
// ------------------------------------------------------------
// `deleteProject` (plus bas) exige la recopie du nom d'emblée : un
// projet emporte toujours tout, le danger y est constant. Une phase ou
// une ligne, non — vide, elle ne détruit rien ; pleine, elle détruit
// beaucoup. Imposer la recopie dans les deux cas reproduirait le défaut
// même qu'on corrige : le Product Owner n'arrivait pas à retirer ses
// lignes « TEST T11 — à supprimer » à 1 €, et un remède qui lui demande
// de les recopier une à une ne lui rend pas service.
//
// D'où deux temps. Premier appel, sans confirmation : on MESURE ce que
// la suppression emporterait. Rien à perdre → elle a lieu. Sinon refus,
// avec `needsConfirmation` et les comptes déjà faits, pour que le
// dialogue s'écrive à partir de la réponse — l'interface n'a ni requête
// à refaire ni règle à réinventer. Second appel, muni de la
// confirmation : exécution.
//
// `needsConfirmation` sépare le refus LEVABLE du refus ferme (droit
// manquant, ligne engagée). Sans lui, l'interface proposerait de
// confirmer ce que rien ne débloquera jamais.
export interface DeleteOutcome {
  ok: boolean
  error?: string
  needsConfirmation?: boolean
  // Comptés par le premier appel, pour libeller le dialogue sans
  // recompter côté client.
  taskCount?: number
  documentCount?: number
  // Les tâches qu'une ligne budgétaire finance, et pour combien.
  // Mesurées AVANT la suppression : `budget_line_tasks.budget_line_id`
  // est en `on delete cascade` (0028), et après coup plus rien ne dit
  // quelles tâches viennent de perdre leur budget. Une liste et pas un
  // compte, parce qu'il faut pouvoir les NOMMER — « 3 tâches » ne se
  // relit pas, « Forage (30 000 €) » se relit.
  fundedTasks?: { title: string; amount: number }[]
}

// « 1 tâches » se lit comme un message de machine, et on cesse alors de
// lire le reste — or c'est justement ici qu'il faut le lire.
const plural = (n: number) => (n > 1 ? 's' : '')

// Les deux suppressions qui suivent ont d'abord tracé `archive`, faute
// de mieux : `supprime` n'existait pas dans l'enum `audit_action`
// (0001:31), et les trois appels qui l'employaient déjà voyaient leur
// insert rejeté par PostgreSQL. La 0058 ajoute la valeur ; le
// contournement est levé, ici comme ailleurs — devant un financeur,
// « archivé » et « supprimé » ne désignent pas le même geste, et une
// phase supprimée ne se retrouve dans aucune archive.
//
// Ce que le contournement avait de juste et qu'on garde : le libellé
// DIT ce qui s'est passé (« Phase … supprimée ») et le commentaire dit
// ce que la suppression a emporté. `action` seule ne suffit pas à se
// relire six mois plus tard.
//
// `removeProjectMember` (plus bas) reste sur `archive` à dessein : un
// membre retiré d'un projet n'est pas supprimé — son compte, ses
// écritures et ses traces demeurent.

// ------------------------------------------------------------
// Supprimer une phase
// ------------------------------------------------------------
// Le danger n'est pas la phase, c'est `tasks.phase_id ... on delete
// cascade` (0001) : la base supprime SES TÂCHES sans rien dire, et
// `budget_line_tasks.task_id on delete cascade` (0028) emporte leurs
// affectations budgétaires avec elles. Un clic peut donc effacer dix
// tâches.
//
// Refuser tant que la phase porte des tâches a été écarté après
// vérification : une tâche ne peut PAS changer de phase — `saveTask`
// rejette un taskId dont le `phase_id` diffère, et rien d'autre dans
// l'application n'écrit cette colonne. Le refus ne laisserait donc
// qu'une issue, supprimer les tâches une par une : la même destruction
// en N gestes, et N traces isolées au lieu d'une qui dise ce que la
// phase emportait. On confirme donc, mais en nommant ce qu'on détruit.
//
// La recopie du nom se justifie ici, et pas pour une ligne budgétaire :
// les phases se ressemblent dans une liste (« Phase 2 », « Diagnostic »)
// et l'erreur qu'on redoute n'est pas de mal comprendre la cascade, c'est
// de cliquer sur la mauvaise ligne. Recopier oblige à lire laquelle. Une
// phase VIDE part en un clic — il n'y a rien à perdre. « Vide » veut dire
// ni tâche, ni ligne budgétaire, ni pièce : une phase qui ne détruit rien
// mais DÉFAIT quelque chose se confirme comme les autres (voir `enJeu`).
//
// Ce que la suppression ne touche pas se dit aussi, parce que c'est la
// première inquiétude et que c'est vrai : les lignes budgétaires
// survivent (`budget_lines.phase_id ... on delete set null`) et repassent
// « hors phase », leur argent reste au projet ; les pièces rattachées
// perdent leur phase, pas leur fichier.
export async function deletePhase(input: {
  phaseId: string; projectId: string; confirmation?: string
}): Promise<DeleteOutcome> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  // Appartenance vérifiée ici comme dans deleteTask, avant le droit : un
  // phaseId d'un autre projet doit sortir sur « introuvable », pas sur un
  // refus de droits qui confirmerait son existence.
  const { data: phase } = await supabase.from('phases')
    .select('id, name, project_id, tasks(id, title)')
    .eq('id', input.phaseId).maybeSingle()
  if (!phase || phase.project_id !== input.projectId) return { ok: false, error: 'Phase introuvable.' }
  if (!(await canManagePhases(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Suppression des phases réservée au chef de projet et aux admins.' }
  }

  const tasks = (phase.tasks ?? []) as { id: string; title: string }[]
  const name = (phase.name ?? '').trim()

  // Ce que la cascade rend au « non affecté » des lignes. L'argent n'est
  // pas perdu, mais il change de place : c'est la première question qui
  // sera posée au compte rendu, autant y répondre dans la trace.
  let releasedAmount = 0
  if (tasks.length) {
    const { data: allocations } = await supabase.from('budget_line_tasks')
      .select('amount').in('task_id', tasks.map(t => t.id))
    releasedAmount = (allocations ?? []).reduce((s, a) => s + Number(a.amount ?? 0), 0)
  }
  const [{ count: lineCount }, { count: docCount }] = await Promise.all([
    supabase.from('budget_lines').select('id', { count: 'exact', head: true }).eq('phase_id', input.phaseId),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('phase_id', input.phaseId),
  ])
  const lines = lineCount ?? 0
  const pieces = docCount ?? 0

  // ----------------------------------------------------------
  // Ce qui déclenche la confirmation
  // ----------------------------------------------------------
  // La condition ne regardait QUE les tâches. Une phase portant 0 tâche
  // et 6 lignes budgétaires partait donc en un clic : les 6 lignes
  // survivaient (`budget_lines.phase_id ... on delete set null`, 0001) et
  // repassaient « hors phase » sans que rien ne l'ait annoncé. Aucun euro
  // perdu, mais le regroupement sur lequel se lit le budget disparaissait
  // en silence — et le paragraphe qui explique cette survie n'était
  // construit que dans la branche « avec tâches », donc jamais montré
  // dans le seul cas où il aurait servi. Même raisonnement pour les
  // pièces rattachées à la phase.
  //
  // Le principe du Product Owner tient, il est seulement mesuré
  // correctement : ce qui n'a RIEN à perdre reste à un clic. `enJeu` dit
  // exactement cela — zéro tâche, zéro ligne, zéro pièce : la phase ne
  // fait que disparaître elle-même, il n'y a rien à faire lire.
  const enJeu = tasks.length + lines + pieces

  // ----------------------------------------------------------
  // Une phase sans nom ne peut pas être confirmée
  // ----------------------------------------------------------
  // La garde comparait la saisie au nom : quand `name` valait '', le
  // premier appel — qui ne porte aucune confirmation — évaluait
  // `'' !== ''`, donc FAUX. La garde ne se déclenchait pas et la phase
  // partait au premier clic, tâches comprises, sans confirmation ni
  // avertissement. Le pire des cas : le nom manquant n'est pas un
  // détail cosmétique, c'est justement ce qui aurait permis de
  // reconnaître la phase qu'on détruit.
  //
  // `phases.name` est `not null` (0001) — ce qui n'interdit NI la chaîne
  // vide NI une suite d'espaces. Les deux écritures applicatives
  // (`savePhase`, l'import CSV) refusent un nom vide ; restent le
  // seed, le SQL Editor et l'existant. Une garde de suppression ne peut
  // pas reposer sur une hygiène de données qu'elle ne contrôle pas.
  //
  // Recopier '' ne prouve rien : c'est ce que tout le monde saisit sans
  // le savoir. Un mot de passe de substitution (« SUPPRIMER ») ne
  // fonctionne pas davantage ici — l'écran verrouille son bouton tant
  // que la saisie ne vaut pas `phaseName.trim()`, soit la chaîne vide :
  // taper quoi que ce soit le désactiverait, et la phase deviendrait
  // indestructible. On refuse donc FERMEMENT (pas de
  // `needsConfirmation` : rien à lever tant que le nom manque) en
  // indiquant la sortie, qui existe vraiment et relève du même droit —
  // nommer la phase avec « Modifier », `savePhase` exigeant un nom non
  // vide. La confirmation redevient alors possible ET sensée.
  //
  // Une phase sans nom et sans rien à perdre part toujours en un clic :
  // c'est l'enregistrement fantôme, celui qu'on veut pouvoir nettoyer
  // sans cérémonie.
  if (enJeu && !name) {
    const porte = [
      tasks.length ? `${tasks.length} tâche${plural(tasks.length)}` : '',
      lines ? `${lines} ligne${plural(lines)} budgétaire${plural(lines)}` : '',
      pieces ? `${pieces} pièce${plural(pieces)}` : '',
    ].filter(Boolean).join(', ')
    return {
      ok: false, taskCount: tasks.length, documentCount: pieces,
      error: `Cette phase n'a pas de nom, et elle porte ${porte}. La confirmation consiste à recopier le nom `
        + `exact de la phase : sans nom, il n'y a rien à recopier, donc rien qui prouve qu'on supprime la bonne. `
        + `Donnez-lui d'abord un nom avec « Modifier », puis recommencez.`,
    }
  }

  if (enJeu && (input.confirmation ?? '').trim() !== name) {
    const message = [
      tasks.length
        ? `Supprimer « ${name} » supprimera aussi ses ${tasks.length} tâche${plural(tasks.length)}, définitivement`
          + (releasedAmount > 0
            ? `, et rendra ${fmtEur(releasedAmount)} d'affectations au « non affecté » de leurs lignes budgétaires.`
            : '.')
        // Rien à détruire au-delà de la phase, mais un regroupement à
        // défaire : c'est précisément ce que le silence d'avant ne
        // disait pas.
        : `« ${name} » ne porte aucune tâche : rien ne sera détruit hormis la phase elle-même, `
          + `mais le regroupement qu'elle portait sera défait.`,
      lines
        ? `${lines} ligne${plural(lines)} budgétaire${plural(lines)} ${lines > 1 ? 'sont conservées' : 'est conservée'} : `
          + `${lines > 1 ? 'elles repassent' : 'elle repasse'} « hors phase », ${lines > 1 ? 'leur' : 'son'} montant reste au projet.`
        : '',
      pieces
        ? `${pieces} pièce${plural(pieces)} ${pieces > 1 ? 'sont conservées' : 'est conservée'} : `
          + `${pieces > 1 ? 'elles perdent' : 'elle perd'} le rattachement à la phase, pas le fichier.`
        : '',
      tasks.length
        ? `Aucune tâche ne peut être déplacée vers une autre phase : s'il y en a à garder, renoncez à supprimer la phase.`
        : '',
      `Pour confirmer, recopiez le nom exact de la phase : « ${name} ».`,
    ].filter(Boolean).join(' ')
    return { ok: false, needsConfirmation: true, error: message, taskCount: tasks.length, documentCount: pieces }
  }

  const { error } = await supabase.from('phases').delete().eq('id', input.phaseId)
  if (error) return { ok: false, error: `Suppression refusée : ${error.message}` }

  // Les titres des tâches emportées, et pas seulement leur nombre : « 3
  // tâches supprimées » ne se relit pas, « Forage, Clôture, Réception »
  // se relit. Bornés à cinq — au-delà, le compte suffit à ce qu'on
  // vérifie.
  const emportees = tasks.slice(0, 5).map(t => `« ${t.title} »`).join(', ')
  // Nommée plutôt qu'écrite en ligne, pour que le journal serveur puisse
  // la reprendre telle quelle si l'insert échoue (voir deleteTask).
  const trace = {
    project_id: input.projectId, entity: 'phase', entity_id: null,
    // Seule une phase sans nom ET sans rien à perdre arrive ici avec un
    // nom vide : « Phase «  » supprimée » ne se relit pas, on le dit.
    label: name ? `Phase « ${name} » supprimée` : 'Phase sans nom supprimée (vide)',
    action: 'supprime', user_id: user.id,
    comment: [
      tasks.length
        ? `${tasks.length} tâche${plural(tasks.length)} supprimée${plural(tasks.length)} avec elle : ${emportees}`
          + (tasks.length > 5 ? ` et ${tasks.length - 5} autre${plural(tasks.length - 5)}` : '')
        // « Phase vide » ne se dit que d'une phase VRAIMENT vide : une
        // phase sans tâche mais portant six lignes budgétaires n'est pas
        // vide, et l'écrire ferait mentir la seule trace qui restera.
        : (enJeu ? 'Aucune tâche emportée' : 'Phase vide — rien à emporter'),
      releasedAmount > 0 ? ` — ${fmtEur(releasedAmount)} d'affectations rendues au non affecté` : '',
      lines ? ` — ${lines} ligne${plural(lines)} budgétaire${plural(lines)} conservée${plural(lines)}, désormais hors phase` : '',
      pieces ? ` — ${pieces} pièce${plural(pieces)} conservée${plural(pieces)}, sans phase` : '',
    ].join(''),
  }
  const { error: auditErr } = await supabase.from('audit_log').insert(trace)
  // Règle commune aux suppressions, exposée dans deleteTask : la phase
  // est déjà détruite, on ne casse pas le geste — mais la ligne de log
  // doit permettre de réinscrire la trace à la main.
  if (auditErr) {
    console.error('[audit] SUPPRESSION NON TRACÉE — à réinscrire à la main :',
      JSON.stringify(trace), '—', auditErr.message)
  }

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

  // Appartenance vérifiée avant tout appel : un lineId d'un autre projet
  // sort sur « introuvable ». La 0061 refait ce contrôle — elle est
  // atteignable sans passer par cet écran — mais c'est ici qu'il rend le
  // message lisible.
  if (input.lineId) {
    const { data: line } = await supabase.from('budget_lines').select('project_id').eq('id', input.lineId).maybeSingle()
    if (!line || line.project_id !== input.projectId) return { ok: false, error: 'Ligne introuvable.' }
  }

  // ----------------------------------------------------------
  // Un seul appel, une seule transaction (migration 0061)
  // ----------------------------------------------------------
  // Cette branche tenait en trois requêtes : purger `budget_line_tasks`,
  // écrire la ligne, réinsérer la répartition. Trois requêtes HTTP,
  // donc trois transactions — et la purge validée AVANT de savoir si
  // l'écriture allait réussir. Quand le trigger de cohérence (0028)
  // refusait la mise à jour, l'utilisateur lisait « Échec de la
  // modification », phrase qui dit que rien n'a bougé, alors que TOUTES
  // les affectations de tâches de la ligne venaient d'être détruites.
  // Le symétrique existait à l'insert : « Ligne enregistrée, mais la
  // répartition a échoué » laissait la ligne enregistrée sans aucune
  // affectation.
  //
  // La perte ne se voyait pas là où l'on regardait : l'onglet Budget
  // montrait une ligne au bon montant, et c'est l'onglet Tâches qui
  // avait changé. Le budget d'une tâche EST la somme de ses affectations
  // (0028) — il n'existe nulle part ailleurs — et il sert de poids à
  // l'avancement de sa phase (page.tsx, moyenne pondérée à plancher).
  // Une répartition à moitié détruite déplace donc un pourcentage
  // d'avancement lu par un financeur.
  //
  // L'ordre purge-puis-écriture n'était pas le problème et n'a pas
  // changé : le trigger refuserait une baisse de montant ou un
  // changement de phase en voyant encore l'ancienne répartition. Ce qui
  // manquait, c'est la transaction — elle est dans la 0061, avec le
  // raisonnement complet, y compris pourquoi la fonction est
  // `security invoker` et non `security definer`.
  const { data: saved, error: saveErr } = await supabase.rpc('save_budget_line', {
    p_project_id: input.projectId,
    p_line_id: input.lineId ?? null,
    p_poste: poste,
    p_description: values.description,
    p_category: values.category,
    p_funder_org_id: values.funder_org_id,
    p_owner_org_id: values.owner_org_id,
    p_phase_id: values.phase_id,
    p_year: values.year,
    p_planned_amount: values.planned_amount,
    p_is_valorisation: values.is_valorisation,
    p_status: values.status,
    p_comment: values.comment,
    p_allocations: allocations,
  })
  if (saveErr) {
    // Application déployée avant sa migration : PostgREST ne trouve pas
    // la fonction. On nomme le fichier à appliquer plutôt que de laisser
    // « Could not find the function » à l'écran — même remède que la
    // 0021 dans `setPublicPage`. Rien n'a été écrit, et c'est le bon
    // sens de l'erreur : un blocage, pas une perte.
    if (saveErr.code === 'PGRST202') {
      console.error('[budget] save_budget_line introuvable — 0061 non appliquée, ou cache de schéma PostgREST périmé :', saveErr.message)
      return {
        ok: false,
        error: "Enregistrement impossible : la migration 0061_budget_line_save_transaction.sql n'est pas appliquée sur cette base "
          + "(ou l'API n'a pas rechargé son schéma). Rien n'a été modifié. Signalez-le à l'administrateur, puis recommencez.",
      }
    }
    // Le message dit désormais quelque chose de VRAI, et c'est tout
    // l'objet de la 0061 : l'échec n'a rien laissé derrière lui.
    return {
      ok: false,
      error: `${input.lineId ? 'Échec de la modification' : 'Échec de la création'} : ${saveErr.message}`
        + ' — rien n\'a été enregistré, la ligne et sa répartition sont restées telles quelles.',
    }
  }
  const result = (saved ?? {}) as { line_id?: string; before_count?: number; before_amount?: number }
  const lineId = result.line_id ?? input.lineId ?? null

  // La répartition d'avant, relevée PAR la transaction avant d'être
  // effacée : après coup, plus rien ne peut la dire. C'est la troisième
  // suppression de ce fichier, et la plus discrète — elle ne s'annonce
  // pas comme telle. Enregistrer la ligne avec une répartition vidée
  // SUPPRIME ses affectations de tâches, et le journal n'en disait rien :
  // « ligne modifiée », sans un mot sur 40 000 € qui viennent de quitter
  // leurs tâches. Le geste, lui, reste une modification — la ligne et
  // son montant survivent, d'où l'action `modifie` et le `console.error`
  // bref des traces de modification (le raisonnement est dans
  // deleteTask). Ce qui manquait, c'est de DIRE le mouvement.
  if (input.lineId) {
    const beforeCount = Number(result.before_count ?? 0)
    const beforeAmount = Number(result.before_amount ?? 0)
    const changed = beforeCount !== allocations.length || beforeAmount !== allocated
    const { error: auditErr } = await supabase.from('audit_log').insert({
      project_id: input.projectId, entity: 'budget_line', entity_id: input.lineId,
      label: poste, action: 'modifie', user_id: user.id,
      comment: changed
        ? `Ligne modifiée — RÉPARTITION : ${beforeCount} affectation${plural(beforeCount)} (${fmtEur(beforeAmount)}) `
          + `→ ${allocations.length} (${fmtEur(allocated)})`
          + (allocations.length === 0 && beforeCount > 0 ? ', répartition supprimée' : '')
        : null,
    })
    if (auditErr) console.error('[audit] trace NON enregistrée:', auditErr.message)
  } else {
    await supabase.from('audit_log').insert({ project_id: input.projectId, entity: 'budget_line', entity_id: lineId, label: poste, action: 'cree', user_id: user.id })
  }

  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// ------------------------------------------------------------
// Supprimer une ligne budgétaire
// ------------------------------------------------------------
// Une ligne qui porte de l'argent RÉEL — un devis validé, donc de
// l'engagé, ou une pièce payée — est refusée, et ce n'est pas une
// prudence de principe. `documents.budget_line_id ... on delete set
// null` (0001:193) : les pièces SURVIVENT à la ligne, détachées. Un devis
// validé de 300 € ne disparaîtrait donc pas — il flotterait. Plus aucune
// ligne pour le totaliser, plus aucun « engagé » où il compte, et un
// engagement d'argent public sorti du compte rendu sans que personne
// l'ait décidé. Aucune confirmation ne répare cela : recopier un nom ne
// rétablit pas une comptabilité, et le prix de l'erreur ne se paie pas
// au moment du clic mais six mois plus tard, devant le financeur. D'où
// le refus ferme — assorti des deux issues qui existent VRAIMENT dans
// l'application : passer la ligne en « clôturée » (elle reste au budget
// et cesse d'être active), ou supprimer d'abord ses pièces, une à une,
// si la ligne était bien une erreur de saisie.
//
// Sans engagé ni payé, la ligne se supprime. Si elle porte encore des
// pièces sans argent (devis en attente, justificatif), on demande une
// confirmation simple qui les COMPTE et les nomme : elles deviendront
// orphelines et RIEN dans l'application ne permet de les rattacher
// ailleurs — `saveDocument` insère, il ne redirige pas. On ne fait pas
// recopier le poste pour autant : la pièce survit, l'erreur se rattrape,
// et le geste doit rester praticable. Une ligne nue — « TEST T11 — à
// supprimer », 1 € — part en un clic, sans rien à recopier. C'est le cas
// qui a motivé cette action.
//
// ------------------------------------------------------------
// Les TÂCHES financées, dites elles aussi
// ------------------------------------------------------------
// Ce paragraphe a longtemps affirmé le contraire de ce qui se passe :
// « elle emporte ses affectations de tâches, le montant retourne au non
// affecté des tâches, il n'est pas perdu ». C'est vrai quand on supprime
// une TÂCHE (son montant redevient disponible sur la ligne, qui existe
// toujours) ; c'est faux dans ce sens-ci. Ici c'est la LIGNE qui
// disparaît, avec son argent : `budget_line_tasks.budget_line_id ... on
// delete cascade` (0028) retire son financement à chaque tâche qu'elle
// portait, et il n'y a plus aucune ligne pour le reprendre.
//
// Ce n'est pas une nuance comptable. Le budget d'une tâche EST la somme
// de ses affectations — il n'existe nulle part ailleurs — et il sert de
// POIDS à l'avancement de sa phase (page.tsx : moyenne des avancements
// pondérée par le budget des tâches, plancher à 2 %). Supprimer une
// ligne déplace donc le pourcentage d'avancement qu'un financeur lit,
// exactement comme une baisse de montant — à cette différence près que
// la baisse de montant, elle, est refusée par le trigger de cohérence
// (0028) tant que la répartition dépasse.
//
// `DeleteTaskButton` fait déjà l'inverse correctement : il dit ce que la
// suppression d'une tâche détache. La symétrie manquait ici — le
// dialogue parlait des pièces et se taisait sur les tâches, c'est-à-dire
// sur le seul effet que personne ne peut plus annuler. Les affectations
// sont donc mesurées AVANT la suppression, nommées dans le message,
// renvoyées à l'écran comme `documentCount` l'est déjà, et inscrites au
// journal. Le protocole en deux temps ne bouge pas : une ligne sans
// pièce ET sans affectation n'a rien à perdre, elle part en un clic.
//
// Le calcul de l'engagé et du payé n'est pas refait ici : `isEngagedDoc`
// et `isPaidDoc` viennent de lib/budget.ts, qui sert aussi le tableau
// budgétaire et le rapport IA. Une seconde règle locale rouvrirait
// exactement la divergence que ce module a été écrit pour fermer — une
// ligne jugée vide par la suppression et engagée par l'écran.

// `DocLike` porte ce dont les deux prédicats ont besoin ; on n'y ajoute
// que de quoi NOMMER les pièces dans le message et dans la trace. Un
// compte seul (« 3 pièces détachées ») ne permet pas de les retrouver.
type AttachedDoc = DocLike & { id: string; filename: string }

// Ce que la cascade emporte, dans la forme où on le montre. Le titre
// vient de `tasks`, le montant de l'affectation : ni l'un ni l'autre ne
// survit au `delete`.
type FundedTask = { title: string; amount: number }

export async function deleteBudgetLine(input: {
  lineId: string; projectId: string; confirm?: boolean
}): Promise<DeleteOutcome> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  // `is_valorisation` est lu ici parce qu'il change ce qu'on doit dire
  // des tâches financées : une valorisation ne compte ni dans leur
  // budget ni dans la pondération de l'avancement (page.tsx, elle
  // alimente `valoByTask` et non `plannedByTask`). Annoncer un
  // avancement déplacé sur une ligne de bénévolat serait faux — et une
  // phrase fausse dans un avertissement apprend à ne plus les lire.
  const { data: line } = await supabase.from('budget_lines')
    .select('id, project_id, poste, planned_amount, is_valorisation')
    .eq('id', input.lineId).maybeSingle()
  if (!line || line.project_id !== input.projectId) return { ok: false, error: 'Ligne introuvable.' }
  if (!(await canManageBudget(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Suppression du budget réservée au chef de projet, au resp. financier et aux admins.' }
  }

  const { data: docRows } = await supabase.from('documents')
    .select('id, filename, type, amount, paid, validations(decision)')
    .eq('budget_line_id', input.lineId)
  const docs: AttachedDoc[] = docRows ?? []
  const engaged = docs.filter(isEngagedDoc).reduce((s, d) => s + (d.amount ?? 0), 0)
  const paid = docs.filter(isPaidDoc).reduce((s, d) => s + (d.amount ?? 0), 0)

  // ----------------------------------------------------------
  // Les affectations, mesurées AVANT toute décision
  // ----------------------------------------------------------
  // Relevées ici et pas plus bas : le premier appel doit pouvoir
  // AVERTIR, ce qui suppose de savoir avant de refuser. Après le
  // `delete`, plus rien ne dirait quelles tâches viennent de perdre
  // leur budget — la cascade ne laisse pas de trace.
  //
  // Le titre est joint plutôt que compté : « 3 affectations » ne permet
  // ni de vérifier qu'on supprime la bonne ligne, ni de retrouver les
  // tâches à re-financer ensuite.
  const { data: allocRows } = await supabase.from('budget_line_tasks')
    .select('amount, tasks:task_id(title)')
    .eq('budget_line_id', input.lineId)
  const fundedTasks: FundedTask[] = ((allocRows ?? []) as {
    amount: number | null
    tasks: { title: string } | { title: string }[] | null
  }[]).map(a => {
    // PostgREST rend l'imbriquée tantôt en objet, tantôt en tableau
    // selon la relation qu'il devine : les deux formes sont admises,
    // comme partout ailleurs dans ce fichier.
    const t = Array.isArray(a.tasks) ? a.tasks[0] : a.tasks
    return { title: (t?.title ?? '').trim() || 'Tâche sans titre', amount: Number(a.amount ?? 0) }
  // Du plus financé au moins financé : la liste est tronquée à cinq
  // dans le message, et ce sont les gros montants qu'il faut voir.
  }).sort((a, b) => b.amount - a.amount)
  const fundedAmount = fundedTasks.reduce((s, t) => s + t.amount, 0)
  const fundedCount = fundedTasks.length
  const nommees = (n: number) =>
    fundedTasks.slice(0, n).map(t => `« ${t.title} » (${fmtEur(t.amount)})`).join(', ')
      + (fundedCount > n ? ` et ${fundedCount - n} autre${plural(fundedCount - n)}` : '')

  const poste = (line.poste ?? '').trim()
  if (engaged > 0 || paid > 0) {
    const porte = [
      engaged > 0 ? `${fmtEur(engaged)} engagés` : '',
      paid > 0 ? `${fmtEur(paid)} payés` : '',
    ].filter(Boolean).join(' et ')
    return {
      ok: false,
      documentCount: docs.length,
      error: `« ${poste} » porte de l'argent réel : ${porte}. La supprimer ne supprimerait pas ces pièces — `
        + `elles resteraient au projet sans aucune ligne pour les totaliser, et l'engagement disparaîtrait du `
        + `compte rendu. Passez son statut à « clôturée » : la ligne reste au budget et cesse d'être active. `
        + `Si elle était vraiment une erreur de saisie, supprimez d'abord ses ${docs.length} pièce${plural(docs.length)} `
        + `depuis le panneau Pièces de la ligne, puis recommencez.`,
    }
  }

  // Deux motifs de confirmation, un seul dialogue. La condition ne
  // regardait que les pièces : une ligne sans pièce finançant quatre
  // tâches pour 40 000 € partait donc en UN CLIC, et les quatre tâches
  // perdaient leur budget sans que rien ne l'ait annoncé. Le principe
  // du Product Owner tient — ce qui n'a rien à perdre part en un clic —
  // il est seulement mesuré complètement.
  if ((docs.length || fundedCount) && !input.confirm) {
    const message = [
      docs.length
        ? `« ${poste} » porte ${docs.length} pièce${plural(docs.length)} : `
          + `${docs.slice(0, 5).map(d => `« ${d.filename} »`).join(', ')}`
          + `${docs.length > 5 ? ` et ${docs.length - 5} autre${plural(docs.length - 5)}` : ''}. `
          + `${docs.length > 1 ? 'Elles ne seront pas supprimées' : 'Elle ne sera pas supprimée'}, mais `
          + `${docs.length > 1 ? 'elles perdront' : 'elle perdra'} le rattachement à cette ligne, et rien ne permet `
          + `de ${docs.length > 1 ? 'les' : 'la'} rattacher à une autre.`
        : '',
      // Une valorisation ne pèse ni dans le budget d'une tâche ni dans
      // la pondération de l'avancement : le dire autrement serait
      // exact sur la forme et faux sur le fond.
      fundedCount && line.is_valorisation
        ? `${docs.length ? 'Elle affecte aussi' : `« ${poste} » affecte`} ${fmtEur(fundedAmount)} en nature `
          + `à ${fundedCount} tâche${plural(fundedCount)} : ${nommees(5)}. Cet apport ne compte ni dans leur budget `
          + `ni dans l'avancement de la phase, mais il disparaîtra de leur fiche — et pour le MEAE, la valorisation `
          + `fait partie du cofinancement.`
        : '',
      fundedCount && !line.is_valorisation
        ? `${docs.length ? 'Elle finance aussi' : `« ${poste} » finance`} ${fundedCount} tâche${plural(fundedCount)} `
          + `pour ${fmtEur(fundedAmount)} : ${nommees(5)}. `
          + `${fundedCount > 1 ? 'Ces tâches ne seront pas supprimées' : 'Cette tâche ne sera pas supprimée'}, mais `
          + `${fundedCount > 1 ? 'elles perdent' : 'elle perd'} ce financement, et le budget d'une tâche sert de poids `
          + `à l'avancement de sa phase : le pourcentage lu par un financeur bougera. Rien ne reporte ces affectations `
          + `ailleurs — pour les conserver, affectez ${fundedCount > 1 ? 'ces tâches' : 'cette tâche'} à une autre ligne `
          + `de la même phase, depuis son dialogue de répartition, avant de supprimer celle-ci.`
        : '',
      // La dernière phrase et le bouton du dialogue disent la même
      // chose, mot pour mot : lire une promesse et en cliquer une autre
      // fait douter d'avoir compris.
      (fundedCount
        ? `Confirmez pour supprimer la ligne et ses ${fundedCount} affectation${plural(fundedCount)}`
        : 'Confirmez pour supprimer la ligne malgré tout')
        + (docs.length ? `, ou supprimez ${docs.length > 1 ? 'ces pièces' : 'cette pièce'} d'abord.` : '.'),
    ].filter(Boolean).join(' ')
    return { ok: false, needsConfirmation: true, documentCount: docs.length, fundedTasks, error: message }
  }

  const { error } = await supabase.from('budget_lines').delete().eq('id', input.lineId)
  if (error) return { ok: false, error: `Suppression refusée : ${error.message}` }

  const trace = {
    project_id: input.projectId, entity: 'budget_line', entity_id: null,
    label: `Ligne budgétaire « ${poste} » supprimée`, action: 'supprime', user_id: user.id,
    comment: [
      `Prévu ${fmtEur(Number(line.planned_amount ?? 0))}, ni engagé ni payé`,
      // Les tâches NOMMÉES, et pas seulement comptées : ce sont elles
      // qui viennent de perdre leur budget, et la trace est le seul
      // endroit où l'on pourra encore lire lesquelles. Le commentaire
      // disait « rendus au non affecté » — c'est ce qui se passe quand
      // on supprime une TÂCHE ; ici la ligne disparaît avec son argent,
      // et plus aucune ligne ne finance ces tâches.
      fundedCount
        ? ` — ${fundedCount} affectation${plural(fundedCount)} de tâche supprimée${plural(fundedCount)} `
          + `(${fmtEur(fundedAmount)}${line.is_valorisation ? ' en nature' : ''}), `
          + `${fundedCount > 1 ? 'ces tâches perdent' : 'cette tâche perd'} ce financement : ${nommees(5)}`
        : '',
      docs.length
        ? ` — ${docs.length} pièce${plural(docs.length)} conservée${plural(docs.length)}, désormais sans ligne : `
          + `${docs.map(d => `« ${d.filename} »`).join(', ')}`
        : '',
    ].join(''),
  }
  const { error: auditErr } = await supabase.from('audit_log').insert(trace)
  // Même règle que deleteTask : la ligne n'existe plus, le geste tient,
  // et le journal serveur porte de quoi réinscrire la trace.
  if (auditErr) {
    console.error('[audit] SUPPRESSION NON TRACÉE — à réinscrire à la main :',
      JSON.stringify(trace), '—', auditErr.message)
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
  // Calendrier des réunions (0051). Le dialogue n'envoie ces champs
  // que lorsque la migration est passée — absents, la réunion se crée
  // comme avant.
  start_time?: string
  location?: string
  // Lien visio (0054) — collé par l'organisateur, jamais généré.
  video_url?: string
  participantIds?: string[]
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

  const values: Record<string, unknown> = {
    project_id: input.projectId, title, kind: input.kind, date: input.date,
    minutes: input.minutes?.trim() || null, created_by: user.id,
  }
  // Colonnes de la 0051 — ajoutées seulement si fournies : tant que la
  // migration n'est pas passée, le dialogue ne les envoie pas et
  // l'insert ne nomme pas de colonne inexistante.
  if (input.start_time?.trim()) values.start_time = input.start_time
  if (input.location?.trim()) values.location = input.location.trim()
  const videoUrl = (input.video_url ?? '').trim()
  if (videoUrl) {
    // Un lien de visio est une URL, pas un texte : « salle 2 » collé
    // ici donnerait un bouton « Rejoindre » qui ne mène nulle part.
    if (!/^https:\/\/\S+$/i.test(videoUrl)) {
      return { ok: false, error: 'Le lien visio doit être une adresse https (Teams, Meet…).' }
    }
    values.video_url = videoUrl
  }

  const { data: created, error } = await supabase.from('meetings').insert(values).select('id').single()
  if (error) return { ok: false, error: `Échec de la création : ${error.message}` }
  await supabase.from('audit_log').insert({ project_id: input.projectId, entity: 'meeting', entity_id: created?.id, label: title, action: 'cree', user_id: user.id })

  // Invitations (0051) : la ligne de l'organisateur naît « acceptée »
  // (il programme, il vient) ; les autres naissent « en attente » et
  // sont prévenus — cloche + email — avec de quoi répondre en
  // connaissance de cause. `response` est TOUJOURS explicite : dans un
  // insert groupé aux lignes hétérogènes, PostgREST remplit les champs
  // absents avec null — pas avec le défaut SQL — et viole le not null
  // dès que l'organisateur s'invite en même temps que d'autres.
  const invitees = [...new Set(input.participantIds ?? [])]
  if (created && invitees.length) {
    const { error: mpError } = await supabase.from('meeting_participants').insert(
      invitees.map(uid => uid === user.id
        ? { meeting_id: created.id, user_id: uid, response: 'acceptee', responded_at: new Date().toISOString() }
        : { meeting_id: created.id, user_id: uid, response: 'en_attente', responded_at: null })
    )
    if (mpError) {
      return { ok: false, error: `Réunion créée, mais invitations non enregistrées : ${mpError.message}` }
    }
    const when = `${fmtDate(input.date)}${input.start_time?.trim() ? ` à ${input.start_time.trim().slice(0, 5)}` : ''}`
    await notifyPeople(invitees.filter(uid => uid !== user.id), {
      type: 'meeting_invite',
      title: `Invitation — ${title}`,
      body: [
        `Vous êtes invité·e à la réunion « ${title} », le ${when}${input.location?.trim() ? `, ${input.location.trim()}` : ''}.`,
        ...(videoUrl ? [`Rejoindre en visio : ${videoUrl}`] : []),
        'Merci d\'accepter ou de refuser depuis l\'onglet COPIL du projet.',
      ],
      path: `/projets/${input.projectId}?tab=copil`,
      linkLabel: 'Répondre dans Solid’Pilot',
    })
  }
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// ------------------------------------------------------------
// Modifier une réunion (28/07 soir)
// ------------------------------------------------------------
// « Une réunion créée est non modifiable, n'est-ce pas ? » — exact, et
// c'était un manque : une coquille dans le titre ou un report de date
// étaient définitifs. La modification suit les règles de la création,
// avec deux comportements en plus :
//  · les invités AJOUTÉS reçoivent l'invitation, les retirés sortent ;
//  · si la DATE ou l'HEURE change, toutes les réponses (sauf celle de
//    l'auteur du changement) repassent « en attente » et les invités
//    sont prévenus — un « accepté » pour mardi ne vaut pas pour jeudi.
export async function updateMeeting(input: MeetingInput & { meetingId: string }): Promise<{ ok: boolean; error?: string }> {
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

  const { data: before } = await supabase.from('meetings')
    .select('title, date, created_by').eq('id', input.meetingId).maybeSingle()
  if (!before) return { ok: false, error: 'Réunion introuvable.' }

  const values: Record<string, unknown> = {
    title, kind: input.kind, date: input.date,
    minutes: input.minutes?.trim() || null,
  }
  // En modification, vider un champ doit VIDER la colonne — mais un
  // champ absent (migration 0051/0054 non passée, dialogue réduit) ne
  // touche à rien.
  if (input.start_time !== undefined) values.start_time = input.start_time.trim() || null
  if (input.location !== undefined) values.location = input.location.trim() || null
  if (input.video_url !== undefined) {
    const videoUrl = input.video_url.trim()
    if (videoUrl && !/^https:\/\/\S+$/i.test(videoUrl)) {
      return { ok: false, error: 'Le lien visio doit être une adresse https (Teams, Meet…).' }
    }
    values.video_url = videoUrl || null
  }

  // .select() : la policy « Chef manage meetings » est plus étroite que
  // le droit applicatif — un refus silencieux (0 ligne) doit se DIRE,
  // pas laisser croire à une modification réussie.
  const { data: updated, error } = await supabase.from('meetings')
    .update(values).eq('id', input.meetingId).select('id')
  if (error) return { ok: false, error: `Échec de la modification : ${error.message}` }
  if (!updated?.length) return { ok: false, error: 'La base a refusé la modification (droits insuffisants sur cette réunion).' }

  const dateChanged = before.date !== input.date
  await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'meeting', entity_id: input.meetingId,
    label: title, action: 'modifie', user_id: user.id,
    comment: `Réunion modifiée${dateChanged ? ` — DATE : ${fmtDate(before.date)} → ${fmtDate(input.date)}` : ''}`,
  })

  const when = `${fmtDate(input.date)}${input.start_time?.trim() ? ` à ${input.start_time.trim().slice(0, 5)}` : ''}`

  // Invités : ajouts invités, retraits sortis — même périmètre que la
  // création. Ignoré si la 0051 n'est pas passée (champ absent).
  let currentIds: string[] = []
  if (input.participantIds !== undefined) {
    const { data: current } = await supabase.from('meeting_participants')
      .select('user_id').eq('meeting_id', input.meetingId)
    const beforeIds = new Set((current ?? []).map(r => r.user_id))
    const after = new Set(input.participantIds)
    const toAdd = [...after].filter(id => !beforeIds.has(id))
    const toRemove = [...beforeIds].filter(id => !after.has(id))
    if (toRemove.length) {
      await supabase.from('meeting_participants')
        .delete().eq('meeting_id', input.meetingId).in('user_id', toRemove)
    }
    if (toAdd.length) {
      // `response` explicite sur chaque ligne — même raison qu'à la
      // création : l'insert groupé hétérogène met null, pas le défaut.
      const { error: addErr } = await supabase.from('meeting_participants').insert(
        toAdd.map(uid => uid === user.id
          ? { meeting_id: input.meetingId, user_id: uid, response: 'acceptee', responded_at: new Date().toISOString() }
          : { meeting_id: input.meetingId, user_id: uid, response: 'en_attente', responded_at: null })
      )
      if (addErr) return { ok: false, error: `Réunion modifiée, mais invitations non enregistrées : ${addErr.message}` }
      await notifyPeople(toAdd.filter(uid => uid !== user.id), {
        type: 'meeting_invite',
        title: `Invitation — ${title}`,
        body: [
          `Vous êtes invité·e à la réunion « ${title} », le ${when}${input.location?.trim() ? `, ${input.location.trim()}` : ''}.`,
          ...(input.video_url?.trim() ? [`Rejoindre en visio : ${input.video_url.trim()}`] : []),
          'Merci d\'accepter ou de refuser depuis l\'onglet COPIL du projet.',
        ],
        path: `/projets/${input.projectId}?tab=copil`,
        linkLabel: 'Répondre dans Solid’Pilot',
      })
    }
    currentIds = [...after]
  }

  if (dateChanged && currentIds.length) {
    // La date a bougé : les réponses données ne valent plus. Reset —
    // sauf l'auteur du changement — et nouvelle sollicitation.
    await supabase.from('meeting_participants')
      .update({ response: 'en_attente', responded_at: null })
      .eq('meeting_id', input.meetingId).neq('user_id', user.id)
    await notifyPeople(currentIds.filter(uid => uid !== user.id), {
      type: 'meeting_update',
      title: `Réunion déplacée — ${title}`,
      body: [
        `La réunion « ${title} » est déplacée au ${when}.`,
        'Votre réponse précédente a été remise à zéro : merci d\'accepter ou de refuser à nouveau.',
      ],
      path: `/projets/${input.projectId}?tab=copil`,
      linkLabel: 'Répondre dans Solid’Pilot',
    })
  }

  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// ------------------------------------------------------------
// Répondre à une invitation (0051)
// ------------------------------------------------------------
// Chacun répond pour lui-même — la RLS ne laisse modifier que SA
// ligne. La réponse est notifiée à l'organisateur : une réunion se
// prépare avec ceux qui viennent, pas avec ceux qu'on espère.
export async function respondToMeeting(input: { projectId: string; meetingId: string; response: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!['acceptee', 'refusee'].includes(input.response)) {
    return { ok: false, error: 'Réponse invalide.' }
  }

  const { data: updated, error } = await supabase.from('meeting_participants')
    .update({ response: input.response, responded_at: new Date().toISOString() })
    .eq('meeting_id', input.meetingId).eq('user_id', user.id)
    .select('meeting_id')
  if (error) return { ok: false, error: `Échec de la réponse : ${error.message}` }
  if (!updated?.length) return { ok: false, error: 'Vous n\'êtes pas dans la liste des invités de cette réunion.' }

  const accepted = input.response === 'acceptee'
  const { data: meeting } = await supabase.from('meetings')
    .select('title, created_by').eq('id', input.meetingId).maybeSingle()
  const { data: me } = await supabase.from('profiles')
    .select('full_name').eq('id', user.id).maybeSingle()
  const who = me?.full_name ?? 'Un invité'

  await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'meeting', entity_id: input.meetingId,
    label: meeting?.title ?? 'Réunion', action: 'modifie', user_id: user.id,
    comment: `Invitation ${accepted ? 'acceptée' : 'refusée'}`,
  })

  if (meeting?.created_by && meeting.created_by !== user.id) {
    await notifyPeople([meeting.created_by], {
      type: 'meeting_response',
      title: `${who} a ${accepted ? 'accepté' : 'refusé'} — ${meeting.title}`,
      body: [`${who} a ${accepted ? 'accepté' : 'refusé'} l'invitation à « ${meeting.title} ».`],
      path: `/projets/${input.projectId}?tab=copil`,
      linkLabel: 'Voir la réunion',
    })
  }
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
    if (!EMAIL_RE.test(email)) return { ok: false, error: 'Adresse email invalide.' }
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
  // Suppression de ligne, donc même exigence que les cinq autres sites
  // (motif complet dans deleteTask) : le rattachement n'existe plus, et
  // avec lui la seule preuve que cette personne a été membre du projet —
  // son rôle, et donc ce qu'elle avait le droit d'y faire. Aucune
  // relecture de la base ne le reconstituera. La trace ne relevait
  // pourtant même pas son erreur : elle disparaissait sans un mot.
  //
  // `archive` et non `supprime`, à dessein : un membre retiré n'est pas
  // supprimé — son compte, ses écritures et ses traces demeurent.
  const trace = {
    project_id: input.projectId, entity: 'project_member', entity_id: input.userId,
    label: `${profile?.full_name ?? input.userId} retiré du projet`, action: 'archive', user_id: user.id,
  }
  const { error: auditErr } = await supabase.from('audit_log').insert(trace)
  if (auditErr) {
    console.error('[audit] RETRAIT NON TRACÉ — à réinscrire à la main :',
      JSON.stringify(trace), '—', auditErr.message)
  }
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

// ------------------------------------------------------------
// Supprimer un projet
// ------------------------------------------------------------
// La plus destructrice des six suppressions de l'application : phases,
// tâches, lignes budgétaires, pièces, validations, indicateurs,
// réunions, décisions partent en cascade, et c'est la seule dont il ne
// reste ensuite RIEN à examiner. Elle n'écrivait aucune trace — pas un
// oubli d'inattention : la 0016 avait posé `audit_log.project_id ... on
// delete cascade`, qui détruisait le journal du projet avec lui et
// faisait rejeter (23503) toute trace insérée après coup sous son
// identifiant. La 0060 retire cette clé étrangère et explique
// longuement pourquoi ce geste-là plutôt qu'un autre.
//
// Ce qui n'est PAS ajouté ici, et le mérite d'être dit : aucun refus sur
// l'argent. `deleteBudgetLine` bloque une ligne portant de l'engagé ou
// du payé, parce que ses pièces lui survivraient détachées et
// fausseraient le compte rendu. Ici les pièces partent AVEC le projet :
// il ne reste pas de comptabilité à fausser, il ne reste rien. Un
// administrateur qui recopie le nom exact d'un projet exerce une
// décision que l'application n'a pas à discuter ; ce qu'elle doit, c'est
// en garder mémoire, et dire dans cette mémoire combien d'argent était
// suivi là — de quoi mesurer, six mois plus tard, ce qui a disparu.
export async function deleteProject(input: { projectId: string; confirmation: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await isUserAdmin(supabase, user.id))) {
    return { ok: false, error: 'La suppression de projet est réservée aux administrateurs YCID / LEY.' }
  }
  const { data: project } = await supabase.from('projects').select('name, budget').eq('id', input.projectId).maybeSingle()
  if (!project) return { ok: false, error: 'Projet introuvable.' }

  const name = (project.name ?? '').trim()
  // Même défaut que sur les phases, et à l'endroit où il coûte le plus
  // cher : `projects.name` est `not null` (0001), ce qui n'interdit ni
  // la chaîne vide ni une suite d'espaces. La comparaison ci-dessous
  // évaluait alors `'' !== ''`, donc FAUX — et le projet entier partait
  // sans qu'on ait rien saisi, l'écran ayant lui aussi déverrouillé son
  // bouton pour la même raison. On refuse, en indiquant la sortie :
  // nommer le projet (« Modifier la fiche », `updateProject` exige un
  // nom non vide), après quoi la recopie retrouve son sens.
  if (!name) {
    return {
      ok: false,
      error: 'Ce projet n\'a pas de nom : la confirmation consiste à recopier son nom exact, et sans nom '
        + 'il n\'y a rien à recopier — donc rien qui prouve qu\'on supprime le bon projet. Donnez-lui d\'abord '
        + 'un nom depuis « Modifier la fiche du projet », puis recommencez.',
    }
  }
  // Double confirmation : saisir le nom exact du projet
  if ((input.confirmation ?? '').trim() !== name) {
    return { ok: false, error: 'Le nom saisi ne correspond pas — suppression annulée.' }
  }

  // ----------------------------------------------------------
  // Ce que la suppression emporte, mesuré AVANT
  // ----------------------------------------------------------
  // Après le `delete`, plus rien ne pourra répondre : les compteurs
  // n'existent nulle part ailleurs. C'est le contenu même de la trace —
  // « projet supprimé » sans ordre de grandeur ne se relit pas devant un
  // financeur, « 4 phases, 27 tâches, 31 lignes pour 312 400 € prévus et
  // 58 pièces » se relit.
  const { data: phaseRows } = await supabase.from('phases').select('id').eq('project_id', input.projectId)
  const phaseIds = (phaseRows ?? []).map((p: { id: string }) => p.id)
  // Les tâches pendent aux phases, pas au projet : sans phase, il n'y a
  // pas de tâche, et `in` sur une liste vide n'a pas à être tenté.
  let taskCount = 0
  if (phaseIds.length) {
    const { count } = await supabase.from('tasks').select('id', { count: 'exact', head: true }).in('phase_id', phaseIds)
    taskCount = count ?? 0
  }

  const [{ data: lineRows }, { data: docRows }] = await Promise.all([
    supabase.from('budget_lines').select('planned_amount, is_valorisation').eq('project_id', input.projectId),
    supabase.from('documents').select('id, type, amount, paid, storage_path, validations(decision)').eq('project_id', input.projectId),
  ])
  // Le prévu est HORS valorisation (spec §10.4) : du bénévolat et des
  // locaux prêtés ne se votent ni ne se paient, et les additionner
  // gonflerait le montant que la trace annonce comme disparu. Ils sont
  // dits À CÔTÉ, jamais dedans — pour le MEAE l'apport en nature fait
  // partie du cofinancement.
  const allLines = lineRows ?? []
  const realLines = allLines.filter((l: { is_valorisation: boolean }) => !l.is_valorisation)
  const valoLines = allLines.filter((l: { is_valorisation: boolean }) => l.is_valorisation)
  const plannedReal = realLines.reduce((s: number, l: { planned_amount: number | null }) => s + Number(l.planned_amount ?? 0), 0)
  const plannedValo = valoLines.reduce((s: number, l: { planned_amount: number | null }) => s + Number(l.planned_amount ?? 0), 0)

  // Engagé et payé viennent de lib/budget.ts, comme partout ailleurs :
  // une règle recalculée ici finirait par annoncer dans le journal un
  // montant que l'écran n'a jamais affiché.
  const docs: (DocLike & { storage_path: string | null })[] = docRows ?? []
  const engaged = docs.filter(isEngagedDoc).reduce((s, d) => s + (d.amount ?? 0), 0)
  const paid = docs.filter(isPaidDoc).reduce((s, d) => s + (d.amount ?? 0), 0)
  // Les LIGNES `documents` partent en cascade ; les FICHIERS du bucket,
  // eux, ne sont supprimés par personne — Postgres n'a pas la main
  // dessus, et ce chemin ne passe pas par `deleteDocument`. Ils
  // deviennent des orphelins, que seul l'écran Administration ▸ Stockage
  // sait retrouver. Le dire dans la trace, c'est laisser à l'exploitant
  // la seule indication qu'il aura d'un espace à récupérer.
  const files = docs.filter(d => d.storage_path).length

  const { error } = await supabase.from('projects').delete().eq('id', input.projectId)
  if (error) return { ok: false, error: `Échec de la suppression : ${error.message}` }

  // Le nom ET l'identifiant : le nom pour se relire, l'identifiant parce
  // qu'il n'existe plus nulle part ailleurs et qu'il est la clé qui
  // regroupe, dans `audit_log`, tout ce que ce projet a laissé.
  const trace = {
    project_id: input.projectId, entity: 'project', entity_id: input.projectId,
    label: `Projet « ${name} » supprimé`, action: 'supprime', user_id: user.id,
    comment: [
      `Identifiant ${input.projectId}`,
      // `fmtEur(null)` rend « — », qui dans une phrase se lit comme un
      // tiret de ponctuation et non comme une absence. La fiche projet
      // écrit « non renseigné » ; la trace dit la même chose.
      ` — montant voté ${project.budget == null ? 'non renseigné' : fmtEur(project.budget)}`,
      ` — emporté : ${phaseIds.length} phase${plural(phaseIds.length)}, ${taskCount} tâche${plural(taskCount)}, `,
      `${realLines.length} ligne${plural(realLines.length)} budgétaire${plural(realLines.length)} `,
      `(${fmtEur(plannedReal)} prévus)`,
      valoLines.length
        ? `, ${valoLines.length} valorisation${plural(valoLines.length)} (${fmtEur(plannedValo)}, hors prévu)`
        : '',
      `, ${docs.length} pièce${plural(docs.length)}`,
      engaged > 0 || paid > 0 ? ` dont ${fmtEur(engaged)} engagés et ${fmtEur(paid)} payés` : '',
      `. Validations, indicateurs, réunions et décisions supprimés avec le projet.`,
      files
        ? ` ${files} fichier${plural(files)} ${files > 1 ? 'restent' : 'reste'} dans le bucket « documents », `
          + `désormais orphelin${plural(files)} : purge depuis Administration ▸ Stockage.`
        : '',
    ].join(''),
  }
  const { error: auditErr } = await supabase.from('audit_log').insert(trace)
  // ----------------------------------------------------------
  // Règle commune aux suppressions (exposée dans deleteTask), plus un
  // repli propre à celle-ci
  // ----------------------------------------------------------
  // On ne casse pas le geste : le projet est détruit, répondre
  // `ok: false` ferait croire à l'administrateur qu'il est encore là.
  //
  // Le repli, lui, ne vaut que le temps d'un déploiement. Tant que la
  // 0060 n'est pas appliquée, `audit_log.project_id` référence encore
  // `projects(id)` : la trace ci-dessus, portant l'identifiant d'un
  // projet qui vient de disparaître, se fait rejeter (23503). Plutôt que
  // de tout perdre au pire moment, on réinscrit la MÊME trace avec
  // `project_id: null` — la forme qu'emploie déjà la purge du stockage.
  // Elle perd son rattachement, pas son contenu : l'identifiant reste
  // écrit en toutes lettres dans le commentaire. Le journal serveur dit
  // que le repli a joué, parce qu'une trace détachée après application
  // de la 0060 signifierait tout autre chose.
  if (auditErr) {
    if (auditErr.code === '23503') {
      console.error('[audit] 0060 non appliquée — trace de suppression détachée du projet :', input.projectId)
      const { error: retryErr } = await supabase.from('audit_log').insert({ ...trace, project_id: null })
      if (retryErr) {
        console.error('[audit] SUPPRESSION NON TRACÉE — à réinscrire à la main :',
          JSON.stringify(trace), '—', retryErr.message)
      }
    } else {
      console.error('[audit] SUPPRESSION NON TRACÉE — à réinscrire à la main :',
        JSON.stringify(trace), '—', auditErr.message)
    }
  }

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
  // Programme de rattachement (0055). Absent tant que la migration
  // n'est pas passée — le dialogue ne l'envoie pas.
  programme_id?: string
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
    // Rattachement au programme (0055) : le déclencheur pose les
    // appartenances des directeurs du nouveau programme et retire
    // celles de l'ancien (via_programme uniquement).
    ...(input.programme_id !== undefined ? { programme_id: input.programme_id || null } : {}),
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

// ------------------------------------------------------------
// Les villes du projet (0050)
// ------------------------------------------------------------
// Le travail est ENTRE des villes : une triade en implique deux ou
// trois, un échange deux villes libanaises. Les villes vivent dans un
// référentiel partagé (`cities`) et se rattachent au projet par
// `project_cities` — la carte du tableau de bord agrège ensuite tout
// le monde sur les mêmes repères. Les droits sont ceux de la fiche
// (phases.manage, comme le bouton « Modifier »), doublés par la RLS.

export async function createCity(input: { name: string; country: string; lat: string; lng: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non connecté.' }

  const name = input.name?.trim()
  const country = input.country?.trim()
  if (!name || !country) return { ok: false, error: 'Le nom et le pays de la ville sont obligatoires.' }
  // Une ville sans position ne placerait aucun repère : elle donnerait
  // l'impression d'une saisie réussie qui ne montre rien (même règle
  // que le lot 3).
  const lat = (input.lat ?? '').trim() ? Number(input.lat) : null
  const lng = (input.lng ?? '').trim() ? Number(input.lng) : null
  if (lat === null || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, error: 'La latitude doit être un nombre décimal entre -90 et 90.' }
  }
  if (lng === null || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { ok: false, error: 'La longitude doit être un nombre décimal entre -180 et 180.' }
  }

  const { data: created, error } = await supabase.from('cities')
    .insert({ name, country, lat, lng }).select('id').single()
  if (!error) return { ok: true, id: created.id }

  // Doublon (name, country) : la ville existe déjà — créée depuis un
  // autre projet. Ce n'est pas une erreur pour l'utilisateur : on la
  // retrouve et on la lui rend, prête à cocher.
  if (error.code === '23505') {
    const { data: existing } = await supabase.from('cities')
      .select('id').eq('name', name).eq('country', country).maybeSingle()
    if (existing) return { ok: true, id: existing.id }
  }
  return { ok: false, error: `Échec de la création : ${error.message}` }
}

export async function setProjectCities(input: { projectId: string; cityIds: string[] }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non connecté.' }
  if (!await canManagePhases(supabase, user.id, input.projectId)) {
    return { ok: false, error: 'Vous n\'avez pas le droit de modifier les villes de ce projet.' }
  }

  const { data: current, error: readErr } = await supabase.from('project_cities')
    .select('city_id').eq('project_id', input.projectId)
  if (readErr) return { ok: false, error: `Lecture impossible : ${readErr.message}` }

  const before = new Set((current ?? []).map(r => r.city_id))
  const after = new Set(input.cityIds)
  const toAdd = [...after].filter(id => !before.has(id))
  const toRemove = [...before].filter(id => !after.has(id))
  if (!toAdd.length && !toRemove.length) return { ok: true }

  if (toRemove.length) {
    const { error } = await supabase.from('project_cities')
      .delete().eq('project_id', input.projectId).in('city_id', toRemove)
    if (error) return { ok: false, error: `Échec du retrait : ${error.message}` }
  }
  if (toAdd.length) {
    const { error } = await supabase.from('project_cities')
      .insert(toAdd.map(city_id => ({ project_id: input.projectId, city_id })))
    if (error) return { ok: false, error: `Échec de l'ajout : ${error.message}` }
  }

  // Le Journal dit lesquelles : « Villes du projet modifiées » seul ne
  // permettrait pas de comprendre, six mois plus tard, quand une ville
  // est entrée ou sortie du périmètre.
  const { data: cityRows } = await supabase.from('cities')
    .select('id, name').in('id', [...toAdd, ...toRemove])
  const nameOf = (id: string) => cityRows?.find(c => c.id === id)?.name ?? id
  const parts = [
    toAdd.length ? `ajout : ${toAdd.map(nameOf).join(', ')}` : '',
    toRemove.length ? `retrait : ${toRemove.map(nameOf).join(', ')}` : '',
  ].filter(Boolean).join(' — ')
  const { error: auditErr } = await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'project', entity_id: input.projectId,
    label: 'Villes du projet', action: 'modifie', user_id: user.id,
    comment: `Villes concernées modifiées — ${parts}`,
  })
  if (auditErr) console.error('[audit] trace NON enregistrée:', auditErr.message)

  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// ============================================================
// Appels de fonds (0066) — promesses annuelles et relances
// ============================================================
// Un appel de fonds est un FLUX entre organisations (qui verse quoi, à
// qui, pour quelle année) — jamais une ligne budgétaire : le budget est
// la référence, la promesse la réalité politique, et l'écran les
// compare sans les confondre. Les droits sont ceux du budget
// (budget.manage), la lecture celle de l'appartenance au projet.

const FUNDING_STATUSES = ['promis', 'demande', 'recu'] as const
export type FundingStatus = (typeof FUNDING_STATUSES)[number]

export interface FundingCallInput {
  projectId: string
  callId?: string
  year: string | number
  payerOrgId: string
  beneficiaryOrgId?: string | null
  amount: string | number
  note?: string
}

// Libellé de Journal : l'année, qui paie, combien. Le Journal survit à
// la suppression de la promesse — le libellé doit donc se suffire.
async function fundingLabel(supabase: Awaited<ReturnType<typeof createClient>>, year: number, payerOrgId: string, amount: number): Promise<string> {
  const { data: org } = await supabase.from('organizations').select('name').eq('id', payerOrgId).maybeSingle()
  return `${year} · ${org?.name ?? 'organisation'} · ${fmtEur(amount)}`
}

export async function saveFundingCall(input: FundingCallInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canManageBudget(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Gestion des appels de fonds réservée au chef de projet, au resp. financier et aux admins — comme le budget.' }
  }

  const year = Math.floor(Number(input.year))
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return { ok: false, error: "L'année doit être comprise entre 2000 et 2100." }
  }
  if (!input.payerOrgId) return { ok: false, error: "L'organisation qui s'engage à payer est obligatoire." }
  // La virgule du clavier français, comme partout ailleurs.
  const amount = Number(String(input.amount ?? '').replace(',', '.'))
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: 'Montant invalide.' }
  const beneficiary = input.beneficiaryOrgId || null
  if (beneficiary && beneficiary === input.payerOrgId) {
    return { ok: false, error: 'Une organisation ne peut pas se verser à elle-même — laissez le bénéficiaire vide pour « réserver ».' }
  }

  const values = {
    year,
    payer_org_id: input.payerOrgId,
    beneficiary_org_id: beneficiary,
    amount,
    note: input.note?.trim() || null,
  }

  if (input.callId) {
    const { error } = await supabase.from('funding_calls')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', input.callId).eq('project_id', input.projectId)
    if (error) return { ok: false, error: `Échec de la modification : ${error.message}` }
    await supabase.from('audit_log').insert({
      project_id: input.projectId, entity: 'funding_call', entity_id: input.callId,
      label: await fundingLabel(supabase, year, input.payerOrgId, amount), action: 'modifie', user_id: user.id,
    })
  } else {
    const { data: created, error } = await supabase.from('funding_calls')
      .insert({ project_id: input.projectId, ...values, created_by: user.id }).select('id').single()
    if (error) return { ok: false, error: `Échec de la création : ${error.message}` }
    await supabase.from('audit_log').insert({
      project_id: input.projectId, entity: 'funding_call', entity_id: created?.id,
      label: await fundingLabel(supabase, year, input.payerOrgId, amount), action: 'cree', user_id: user.id,
    })
  }
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// promis → demandé → reçu, chacun daté. Le retour en arrière est permis
// (une promesse « reçue » par erreur se corrige) et EFFACE les dates
// des états quittés : une date qui survit à l'état qu'elle date est un
// mensonge en attente.
export async function setFundingCallStatus(input: { projectId: string; callId: string; status: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canManageBudget(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Gestion des appels de fonds réservée au chef de projet, au resp. financier et aux admins.' }
  }
  if (!FUNDING_STATUSES.includes(input.status as FundingStatus)) return { ok: false, error: 'Statut invalide.' }

  const { data: call } = await supabase.from('funding_calls')
    .select('year, payer_org_id, amount, requested_at')
    .eq('id', input.callId).eq('project_id', input.projectId).maybeSingle()
  if (!call) return { ok: false, error: 'Appel de fonds introuvable.' }

  const now = new Date().toISOString()
  const patch =
    input.status === 'promis' ? { status: 'promis', requested_at: null, received_at: null }
    : input.status === 'demande' ? { status: 'demande', requested_at: call.requested_at ?? now, received_at: null }
    : { status: 'recu', received_at: now }
  const { error } = await supabase.from('funding_calls')
    .update({ ...patch, updated_at: now })
    .eq('id', input.callId).eq('project_id', input.projectId)
  if (error) return { ok: false, error: `Échec du changement d'état : ${error.message}` }

  const STATUS_LABELS: Record<FundingStatus, string> = { promis: 'promis', demande: 'demandé', recu: 'reçu' }
  await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'funding_call', entity_id: input.callId,
    label: `${await fundingLabel(supabase, call.year, call.payer_org_id, call.amount)} — ${STATUS_LABELS[input.status as FundingStatus]}`,
    action: 'modifie', user_id: user.id,
  })
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

export async function deleteFundingCall(input: { projectId: string; callId: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canManageBudget(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Gestion des appels de fonds réservée au chef de projet, au resp. financier et aux admins.' }
  }
  // Le libellé se lit AVANT la suppression — après, il n'y a plus rien à
  // lire, et le Journal doit pouvoir dire ce qui a disparu (0058).
  const { data: call } = await supabase.from('funding_calls')
    .select('year, payer_org_id, amount')
    .eq('id', input.callId).eq('project_id', input.projectId).maybeSingle()
  if (!call) return { ok: false, error: 'Appel de fonds introuvable.' }
  const label = await fundingLabel(supabase, call.year, call.payer_org_id, call.amount)

  const { error } = await supabase.from('funding_calls')
    .delete().eq('id', input.callId).eq('project_id', input.projectId)
  if (error) return { ok: false, error: `Échec de la suppression : ${error.message}` }
  await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'funding_call', entity_id: input.callId,
    label, action: 'supprime', user_id: user.id,
  })
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// La relance est MANUELLE — relancer une mairie est un geste politique,
// c'est la responsable qui appuie, jamais un robot (arbitrage roadmap).
// Elle part aux comptes MEMBRES de l'organisation payeuse (cloche +
// email, canal notifyPeople). Si l'organisation n'a aucun compte, on le
// DIT au lieu de laisser croire qu'un rappel est parti.
export async function sendFundingReminder(input: { projectId: string; callId: string }): Promise<{ ok: boolean; error?: string; sent?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canManageBudget(supabase, user.id, input.projectId))) {
    return { ok: false, error: 'Les relances suivent les droits du budget — chef de projet, resp. financier, admins.' }
  }

  const [{ data: call }, { data: project }] = await Promise.all([
    supabase.from('funding_calls')
      .select('year, amount, note, status, payer_org_id, beneficiary_org_id')
      .eq('id', input.callId).eq('project_id', input.projectId).maybeSingle(),
    supabase.from('projects').select('name').eq('id', input.projectId).maybeSingle(),
  ])
  if (!call) return { ok: false, error: 'Appel de fonds introuvable.' }
  if (call.status === 'recu') return { ok: false, error: 'Ce versement est déjà marqué reçu — rien à relancer.' }

  const orgIds = [call.payer_org_id, call.beneficiary_org_id].filter((x): x is string => !!x)
  const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', orgIds)
  const orgName = (oid: string | null) => (orgs ?? []).find(o => o.id === oid)?.name ?? 'une organisation'
  const payerName = orgName(call.payer_org_id)

  const recipients = await membersOfOrgs([call.payer_org_id])
  if (!recipients.length) {
    return {
      ok: false,
      error: `Aucun compte n'appartient à « ${payerName} » : le rappel n'est PAS parti. Créez un compte depuis l'écran Organisations (bouton + personne), ou contactez l'organisation directement.`,
    }
  }

  const projectName = project?.name ?? 'un projet'
  await notifyPeople(recipients, {
    type: 'funding_reminder',
    title: `Rappel de financement — ${projectName}`,
    body: [
      call.beneficiary_org_id
        ? `« ${payerName} » s'est engagée à verser ${fmtEur(call.amount)} à « ${orgName(call.beneficiary_org_id)} » pour le projet « ${projectName} » (${call.year}).`
        : `« ${payerName} » s'est engagée à réserver ${fmtEur(call.amount)} pour le projet « ${projectName} » (${call.year}).`,
      ...(call.note?.trim() ? [`Note : ${call.note.trim()}`] : []),
      'Merci de faire le nécessaire, puis de prévenir la personne qui pilote le budget du projet.',
    ],
    path: `/projets/${input.projectId}?tab=budget`,
    linkLabel: 'Ouvrir le budget du projet',
  })

  const now = new Date().toISOString()
  // La relance vaut demande : une promesse encore « promise » passe
  // « demandée » — c'est le même geste, daté du même jour.
  const { error } = await supabase.from('funding_calls')
    .update({
      last_reminder_at: now, last_reminder_by: user.id, updated_at: now,
      ...(call.status === 'promis' ? { status: 'demande', requested_at: now } : {}),
    })
    .eq('id', input.callId).eq('project_id', input.projectId)
  if (error) return { ok: false, error: `Rappel envoyé, mais la trace n'a pas pu être posée : ${error.message}` }

  await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'funding_call', entity_id: input.callId,
    label: `${await fundingLabel(supabase, call.year, call.payer_org_id, call.amount)} — rappel envoyé (${recipients.length} compte${recipients.length > 1 ? 's' : ''})`,
    action: 'modifie', user_id: user.id,
  })
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true, sent: recipients.length }
}
