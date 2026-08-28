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
  const { error } = await supabase.from('task_comments').insert({
    task_id: input.taskId,
    author_id: user.id,
    body,
  })
  if (error) return { ok: false, error: `Échec de l'enregistrement : ${error.message}` }

  const { error: auditErr } = await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'task', entity_id: input.taskId,
    label: input.taskTitle, action: 'modifie', user_id: user.id,
    comment: 'Commentaire ajouté',
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
  const recipients = [...leads, ...directors, task?.assignee_id].filter(x => x && x !== user.id)

  // Notifier ne doit JAMAIS faire échouer le commentaire : il est déjà
  // en base, et le fil vaut mieux qu'une erreur rouge sur un envoi.
  try {
    await notifyPeople(recipients, {
      type: 'task_comment',
      title: `${who} a commenté « ${input.taskTitle} »`,
      body: [
        `Projet : ${project?.name ?? 'projet'}`,
        `Tâche : ${input.taskTitle}`,
        '',
        body,
      ],
      path: `/projets/${input.projectId}?tab=taches`,
      linkLabel: 'Voir la tâche',
    })
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
