'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { DOC_TYPES, DOC_TYPE_LABELS, type DocType } from '@/lib/documents'

// ============================================================
// PR 38a — Socle documentaire
// ============================================================
// Le fichier lui-même est envoyé au Storage depuis le navigateur (comme
// l'avatar) : le faire transiter par le serveur Next imposerait la
// limite de taille des server actions sans rien apporter, les policies
// Storage appliquant déjà les mêmes droits. Ces actions gèrent la ligne
// en base, la suppression et l'accès signé.

export interface SaveDocumentInput {
  projectId: string
  phaseId?: string | null
  taskId?: string | null
  budgetLineId?: string | null
  type: DocType
  filename: string
  storagePath: string
  amount?: string | null
}

export async function saveDocument(input: SaveDocumentInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  if (!DOC_TYPES.includes(input.type)) return { ok: false, error: 'Type de document invalide.' }
  const filename = (input.filename ?? '').trim()
  if (!filename) return { ok: false, error: 'Nom de fichier manquant.' }
  if (!input.storagePath?.startsWith(`projets/${input.projectId}/`)) {
    return { ok: false, error: 'Chemin de stockage incohérent avec le projet.' }
  }

  let amount: number | null = null
  if (input.amount != null && String(input.amount).trim() !== '') {
    amount = Number(String(input.amount).replace(',', '.'))
    if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: 'Montant invalide.' }
  }

  // Le droit de déposer est arbitré par la RLS (can_upload_document) :
  // l'insert échoue si l'utilisateur n'est pas autorisé, y compris pour
  // un appel qui contournerait l'interface.
  const { error } = await supabase.from('documents').insert({
    project_id: input.projectId,
    phase_id: input.phaseId || null,
    task_id: input.taskId || null,
    budget_line_id: input.budgetLineId || null,
    type: input.type,
    filename,
    storage_path: input.storagePath,
    amount,
    uploaded_by: user.id,
  })
  if (error) return { ok: false, error: `Échec de l'enregistrement : ${error.message}` }

  await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'document', entity_id: null,
    label: filename, action: 'cree', user_id: user.id,
    comment: `Pièce déposée (${DOC_TYPE_LABELS[input.type]})`,
  })
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

export async function deleteDocument(documentId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const { data: doc } = await supabase.from('documents')
    .select('id, project_id, filename, storage_path').eq('id', documentId).maybeSingle()
  if (!doc) return { ok: false, error: 'Document introuvable.' }

  // La ligne d'abord : si la RLS refuse, le fichier reste en place. Dans
  // l'ordre inverse, un refus laisserait une ligne pointant vers un
  // fichier supprimé.
  const { error } = await supabase.from('documents').delete().eq('id', documentId)
  if (error) return { ok: false, error: `Suppression refusée : ${error.message}` }

  if (doc.storage_path) {
    const { error: storageErr } = await supabase.storage.from('documents').remove([doc.storage_path])
    // Le fichier orphelin est signalé, pas masqué : la ligne a bien
    // disparu, l'utilisateur ne doit pas croire que tout est propre.
    if (storageErr) console.error('[deleteDocument] fichier non supprimé:', doc.storage_path, storageErr.message)
  }

  await supabase.from('audit_log').insert({
    project_id: doc.project_id, entity: 'document', entity_id: null,
    label: doc.filename, action: 'supprime', user_id: user.id,
  })
  revalidatePath(`/projets/${doc.project_id}`)
  return { ok: true }
}

// Bucket privé : l'accès se fait par URL signée à durée limitée, jamais
// par une URL publique devinable.
export async function getDocumentUrl(documentId: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const { data: doc } = await supabase.from('documents')
    .select('storage_path').eq('id', documentId).maybeSingle()
  if (!doc?.storage_path) return { ok: false, error: 'Document introuvable.' }

  const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 300)
  if (error || !data) return { ok: false, error: `Lien indisponible : ${error?.message ?? 'inconnu'}` }
  return { ok: true, url: data.signedUrl }
}
