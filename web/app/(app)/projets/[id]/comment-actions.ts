'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { notifyPeople, leadOrgAdmins, programmeDirectors } from '@/lib/notify-circuit'
import { MAX_COMMENT } from '@/lib/constants'

// ============================================================
// 0067 — Commentaires de tâche
// ============================================================
// Demande du 28/08 : commenter une tâche, et prévenir à CHAQUE
// commentaire les organisations pilotes (YCID / LEY) et la direction du
// programme. Le fil vit dans `task_comments` ; les droits sont ceux de
// la RLS (appartenance au projet) — ces actions ne les recopient pas,
// elles laissent la base refuser.

export async function addTaskComment(input: {
  projectId: string
  taskId: string
  taskTitle: string
  body: string
  // 0068 — « merci de déposer le devis », adressé à quelqu'un. Vide, le
  // commentaire reste ce qu'il était : une remarque au fil.
  addressedTo?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const body = (input.body ?? '').trim()
  if (!body) return { ok: false, error: 'Le commentaire est vide.' }
  if (body.length > MAX_COMMENT) {
    return { ok: false, error: `Commentaire trop long (${body.length} caractères, ${MAX_COMMENT} maximum).` }
  }

  // `author_id` est écrit ici ET vérifié par la policy « Write task
  // comments » : la RLS refuse un commentaire signé du nom d'un autre,
  // y compris pour un appel qui contournerait cette action.
  // On ne s'adresse qu'à un MEMBRE du projet : hors du projet, la
  // personne ne verrait ni la tâche ni la demande — une notification
  // vers une porte fermée.
  const addressedTo = (input.addressedTo ?? '').trim() || null
  if (addressedTo) {
    const { data: member } = await supabase.from('project_members')
      .select('user_id').eq('project_id', input.projectId).eq('user_id', addressedTo).maybeSingle()
    if (!member) return { ok: false, error: "Cette personne n'est pas membre du projet : elle ne verrait pas la demande." }
  }

  const { error } = await supabase.from('task_comments').insert({
    task_id: input.taskId,
    author_id: user.id,
    body,
    addressed_to: addressedTo,
  })
  if (error) return { ok: false, error: `Échec de l'enregistrement : ${error.message}` }

  const { error: auditErr } = await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'task', entity_id: input.taskId,
    label: input.taskTitle, action: 'modifie', user_id: user.id,
    comment: addressedTo ? 'Demande adressée à un membre du projet' : 'Commentaire ajouté',
  })
  if (auditErr) console.error('[audit] trace NON enregistrée:', auditErr.message)

  // Les destinataires demandés, et l'assignée de la tâche avec eux : un
  // commentaire sur une tâche dont personne ne prévient la responsable
  // est un mot laissé sur une porte fermée.
  const { data: task } = await supabase.from('tasks')
    .select('assignee_id').eq('id', input.taskId).maybeSingle()
  const { data: project } = await supabase.from('projects')
    .select('name').eq('id', input.projectId).maybeSingle()
  const [leads, directors] = await Promise.all([leadOrgAdmins(), programmeDirectors(input.projectId)])
  const author = (await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()).data
  const who = author?.full_name ?? 'Un membre du projet'

  // L'auteur ne se notifie pas lui-même — il vient d'écrire le message.
  const inCopy = [...leads, ...directors, task?.assignee_id]
    .filter(x => x && x !== user.id && x !== addressedTo)

  // Notifier ne doit JAMAIS faire échouer le commentaire : il est déjà
  // en base, et le fil vaut mieux qu'une erreur rouge sur un envoi.
  try {
    // Le destinataire d'une demande reçoit un message À LUI, pas la
    // copie d'un fil. « Une demande vous attend » et « quelqu'un a
    // commenté » n'appellent pas le même geste, et se noyer dans le
    // second fait manquer le premier.
    if (addressedTo) {
      await notifyPeople([addressedTo], {
        type: 'task_question',
        title: `${who} vous demande quelque chose sur « ${input.taskTitle} »`,
        body: [
          `Projet : ${project?.name ?? 'projet'}`,
          `Tâche : ${input.taskTitle}`,
          '',
          body,
          '',
          'Cette demande reste signalée « en attente » sur la tâche jusqu’à ce qu’elle soit marquée comme réglée.',
        ],
        path: `/projets/${input.projectId}?tab=taches`,
        linkLabel: 'Voir la demande',
      })
    }
    if (inCopy.length) {
      await notifyPeople(inCopy, {
        type: 'task_comment',
        title: addressedTo
          ? `${who} a adressé une demande sur « ${input.taskTitle} »`
          : `${who} a commenté « ${input.taskTitle} »`,
        body: [
          `Projet : ${project?.name ?? 'projet'}`,
          `Tâche : ${input.taskTitle}`,
          '',
          body,
        ],
        path: `/projets/${input.projectId}?tab=taches`,
        linkLabel: 'Voir la tâche',
      })
    }
  } catch (e) {
    console.error('[comment-actions] notification non émise:', e)
  }

  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// Supprimer : l'auteur ou un administrateur, et c'est la RLS qui
// tranche. Un `delete` écarté ne lève aucune erreur — il touche zéro
// ligne et répond « succès » — d'où le `select` de contrôle : sans lui,
// l'écran annoncerait une suppression qui n'a pas eu lieu.
export async function deleteTaskComment(input: {
  commentId: string
  projectId: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const { data: removed, error } = await supabase.from('task_comments')
    .delete().eq('id', input.commentId).select('id')
  if (error) return { ok: false, error: `Échec : ${error.message}` }
  if (!removed?.length) {
    return { ok: false, error: "Suppression refusée : seuls l'auteur du commentaire et un administrateur peuvent le retirer." }
  }

  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// ------------------------------------------------------------
// Solder une demande — ou la rouvrir
// ------------------------------------------------------------
// « Merci de déposer la facture » se solde en DÉPOSANT la facture, pas
// en écrivant une réponse. Le geste est donc explicite, et ouvert à
// trois personnes : le destinataire (il a fait la chose), l'auteur (il a
// obtenu ce qu'il voulait) et l'administrateur. La RLS tranche — comme
// pour la suppression, un `update` écarté touche zéro ligne et répond
// « succès », d'où le `select` de contrôle.
export async function setQuestionAnswered(input: {
  commentId: string
  projectId: string
  answered: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const { data: comment } = await supabase.from('task_comments')
    .select('id, body, author_id, addressed_to, task_id').eq('id', input.commentId).maybeSingle()
  if (!comment) return { ok: false, error: 'Demande introuvable.' }
  if (!comment.addressed_to) return { ok: false, error: "Ce commentaire n'est pas une demande adressée." }

  const { data: updated, error } = await supabase.from('task_comments').update({
    answered_at: input.answered ? new Date().toISOString() : null,
    answered_by: input.answered ? user.id : null,
  }).eq('id', input.commentId).select('id')
  if (error) return { ok: false, error: `Échec : ${error.message}` }
  if (!updated?.length) {
    return { ok: false, error: 'Refusé : seuls le destinataire de la demande, son auteur et un administrateur peuvent la solder.' }
  }

  const { data: task } = await supabase.from('tasks')
    .select('title').eq('id', comment.task_id).maybeSingle()
  const { error: auditErr } = await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'task', entity_id: comment.task_id,
    label: task?.title ?? 'Tâche', action: 'modifie', user_id: user.id,
    comment: input.answered ? 'Demande marquée comme réglée' : 'Demande rouverte',
  })
  if (auditErr) console.error('[audit] trace NON enregistrée:', auditErr.message)

  // Celui qui a demandé apprend que c'est fait — sans quoi il faudrait
  // rouvrir la tâche pour le découvrir, ce qui est exactement le travail
  // que la demande devait éviter.
  if (input.answered && comment.author_id && comment.author_id !== user.id) {
    const me = (await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()).data
    try {
      await notifyPeople([comment.author_id], {
        type: 'task_question_answered',
        title: `${me?.full_name ?? 'Un membre du projet'} a réglé votre demande sur « ${task?.title ?? 'une tâche'} »`,
        body: ['Votre demande :', comment.body],
        path: `/projets/${input.projectId}?tab=taches`,
        linkLabel: 'Voir la tâche',
      })
    } catch (e) {
      console.error('[comment-actions] notification de réponse non émise:', e)
    }
  }

  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}
