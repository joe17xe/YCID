'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { DOC_TYPES, DOC_TYPE_LABELS, DOC_MOMENTS, GALLERY_URL_TTL, type DocType, type DocMoment } from '@/lib/documents'

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
  // Photos de terrain uniquement (PR 38c) : un devis n'a pas d'« avant ».
  moment?: DocMoment | null
}

// `warning` : la pièce est bien enregistrée, mais quelque chose d'utile
// n'a pas eu lieu. Distinct de `error`, qui annule le dépôt.
export async function saveDocument(input: SaveDocumentInput): Promise<{ ok: boolean; error?: string; warning?: string }> {
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
  const { data: created, error } = await supabase.from('documents').insert({
    project_id: input.projectId,
    phase_id: input.phaseId || null,
    task_id: input.taskId || null,
    budget_line_id: input.budgetLineId || null,
    type: input.type,
    filename,
    storage_path: input.storagePath,
    amount,
    // Ignoré hors photo : un moment sur un devis n'aurait aucun sens et
    // polluerait la galerie.
    moment: input.type === 'photo' && input.moment && DOC_MOMENTS.includes(input.moment) ? input.moment : null,
    uploaded_by: user.id,
  }).select('id').single()
  if (error || !created) return { ok: false, error: `Échec de l'enregistrement : ${error?.message ?? 'document non créé'}` }

  // Un devis part automatiquement en validation (PR 38b) : le laisser à
  // la main ferait des devis oubliés en attente de rien, et « engagé »
  // ne compte que les devis validés.
  // Uniquement s'il est rattaché à une ligne : sans ligne à créditer, la
  // validation ne serait affichée nulle part et n'alimenterait aucun
  // montant — un circuit ouvert dans le vide.
  // L'échec de la mise en validation était avalé dans un console.error :
  // le devis s'affichait comme une pièce jointe ordinaire, sans « en
  // attente », et « engagé » restait à zéro sans que rien ne l'explique.
  // Une panne muette sur le chiffre qui pilote le financier est pire que
  // le refus du dépôt — elle se découvre en réunion.
  let warning: string | undefined
  if (input.type === 'devis' && input.budgetLineId) {
    const subErr = await submitForValidation(created.id)
    if (subErr) {
      console.error('[saveDocument] mise en validation impossible:', subErr)
      warning = `Le devis est enregistré, mais n'est PAS parti en validation : ${subErr} Tant qu'il n'est pas validé, il n'alimente pas le montant engagé.`
    }
  }

  const { error: auditErr } = await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'document', entity_id: null,
    label: filename, action: 'cree', user_id: user.id,
    comment: `Pièce déposée (${DOC_TYPE_LABELS[input.type]})`,
  })
  if (auditErr) console.error('[audit] trace NON enregistrée:', auditErr.message)
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true, warning }
}

// ------------------------------------------------------------
// Circuit de validation (PR 38b)
// ------------------------------------------------------------
// devis déposé → validé (ou refusé) → facture → payé.
// « engagé » = Σ des devis validés ; « payé » = Σ des factures et reçus
// marqués payés. Ce sont les deux sources du réalisé de la PR 39.

// Retourne un message d'erreur, ou null si tout s'est bien passé.
async function submitForValidation(documentId: string): Promise<string | null> {
  const supabase = await createClient()
  // À qui adresser : règles du projet si configurées, sinon financeur de
  // la ligne, sinon organisation porteuse (fonction SQL, migration 0030).
  const { data: orgs, error } = await supabase.rpc('validation_orgs_for_document', { doc_id: documentId })
  if (error) return `Destinataires de validation introuvables : ${error.message}`
  const orgIds = (orgs ?? []) as unknown as { validation_orgs_for_document: string }[] | string[]
  const ids = (Array.isArray(orgIds) ? orgIds : []).map((o: unknown) =>
    typeof o === 'string' ? o : (o as { validation_orgs_for_document: string }).validation_orgs_for_document,
  ).filter(Boolean)
  if (!ids.length) return "Aucune organisation à solliciter : renseignez le financeur de la ligne ou l'organisation porteuse du projet."

  const { error: insErr } = await supabase.from('validations')
    .insert(ids.map(org_id => ({ document_id: documentId, org_id, decision: 'en_attente' })))
  if (insErr) return `Mise en validation impossible : ${insErr.message}`
  return null
}

export async function decideValidation(input: {
  validationId: string; projectId: string; decision: 'valide' | 'refuse'; comment?: string
  // Décider À LA PLACE de l'organisation sollicitée : geste délibéré,
  // jamais un clic ordinaire (arbitrage YCID du 26/07).
  onBehalf?: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!['valide', 'refuse'].includes(input.decision)) return { ok: false, error: 'Décision invalide.' }

  const { data: v } = await supabase.from('validations')
    .select('id, document_id, org_id, decision, organizations:org_id(name), documents:document_id(filename, project_id)')
    .eq('id', input.validationId).maybeSingle()
  if (!v) return { ok: false, error: 'Validation introuvable.' }

  // Une décision déjà prise ne se rejoue pas en silence. Les boutons
  // n'apparaissent qu'en attente, mais deux personnes peuvent trancher
  // à quelques secondes d'écart : la seconde écrasait la première, y
  // compris un refus par une validation, sans que rien ne le signale.
  if (v.decision !== 'en_attente') {
    return {
      ok: false,
      error: `Déjà ${v.decision === 'valide' ? 'validé' : 'refusé'} — rafraîchissez la page. Pour revenir sur une décision, retirez le devis et redéposez-le.`,
    }
  }

  // Décider pour une organisation dont on n'est pas membre reste
  // possible — sans quoi un devis adressé à une organisation sans compte
  // actif resterait bloqué pour toujours — mais devient un acte explicite
  // et motivé, pas un clic qui se confond avec une décision légitime.
  const { data: membership } = await supabase.from('memberships')
    .select('org_id').eq('user_id', user.id).eq('org_id', v.org_id).maybeSingle()
  const org = Array.isArray(v.organizations) ? v.organizations[0] : v.organizations
  const orgName = org?.name ?? 'cette organisation'
  const onBehalf = !membership
  if (onBehalf) {
    if (!input.onBehalf) {
      return { ok: false, error: `Vous n'êtes pas membre de « ${orgName} » : cette décision exige une confirmation explicite.` }
    }
    if (!(input.comment ?? '').trim()) {
      return { ok: false, error: `Décider au nom de « ${orgName} » exige un motif, qui sera tracé au Journal.` }
    }
  }

  const { error } = await supabase.from('validations').update({
    decision: input.decision,
    decided_by: user.id,
    decided_at: new Date().toISOString(),
    comment: input.comment?.trim() || null,
  }).eq('id', input.validationId)
  if (error) return { ok: false, error: `Décision refusée : ${error.message}` }

  const doc = Array.isArray(v.documents) ? v.documents[0] : v.documents
  const { error: auditErr } = await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'validation', entity_id: input.validationId,
    label: doc?.filename ?? null, action: 'modifie', user_id: user.id,
    // La procuration est écrite NOIR SUR BLANC dans la trace : lue six
    // mois plus tard par un contrôleur, « validé » et « validé au nom de
    // LEY, qui n'a pas décidé » ne racontent pas la même histoire.
    comment: [
      `Devis ${input.decision === 'valide' ? 'validé' : 'refusé'}`,
      onBehalf ? ` AU NOM DE « ${orgName} » (décideur non membre de cette organisation)` : '',
      input.comment ? ` — ${input.comment.trim()}` : '',
    ].join(''),
  })
  if (auditErr) console.error('[audit] trace NON enregistrée:', auditErr.message)
  revalidatePath(`/projets/${input.projectId}`)
  return { ok: true }
}

// Marquer payé : c'est ce qui alimente le « payé » du prévu/engagé/réalisé.
// La date est demandée, pas déduite de l'instant du clic — un règlement
// se saisit souvent après coup.
export async function setDocumentPaid(input: {
  documentId: string; projectId: string; paid: boolean; paidAt?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  const { data: doc } = await supabase.from('documents')
    .select('id, filename, amount').eq('id', input.documentId).maybeSingle()
  if (!doc) return { ok: false, error: 'Document introuvable.' }

  const { error } = await supabase.from('documents').update({
    paid: input.paid,
    paid_at: input.paid ? (input.paidAt || new Date().toISOString().slice(0, 10)) : null,
  }).eq('id', input.documentId)
  if (error) return { ok: false, error: `Échec : ${error.message}` }

  const { error: auditErr } = await supabase.from('audit_log').insert({
    project_id: input.projectId, entity: 'document', entity_id: input.documentId,
    label: doc.filename, action: 'modifie', user_id: user.id,
    comment: input.paid ? `Marquée payée${doc.amount ? ` — ${doc.amount} €` : ''}` : 'Paiement annulé',
  })
  if (auditErr) console.error('[audit] trace NON enregistrée:', auditErr.message)
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

  const { error: auditErr } = await supabase.from('audit_log').insert({
    project_id: doc.project_id, entity: 'document', entity_id: null,
    label: doc.filename, action: 'supprime', user_id: user.id,
  })
  if (auditErr) console.error('[audit] trace NON enregistrée:', auditErr.message)
  revalidatePath(`/projets/${doc.project_id}`)
  return { ok: true }
}

// ------------------------------------------------------------
// Téléchargement groupé (PR 38d)
// ------------------------------------------------------------
// Signe en une fois les pièces sélectionnées, pour que le navigateur
// puisse les assembler en archive. Le filtrage a déjà eu lieu à
// l'écran ; on revérifie tout de même l'appartenance au projet, un
// identifiant pouvant être forgé.
export async function getDocumentUrls(input: { projectId: string; documentIds: string[] }): Promise<{
  ok: boolean; files?: { id: string; filename: string; url: string }[]; error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!input.documentIds?.length) return { ok: false, error: 'Aucune pièce sélectionnée.' }
  // Garde-fou : au-delà, l'assemblage en mémoire dans le navigateur
  // devient hasardeux sur mobile.
  if (input.documentIds.length > 200) return { ok: false, error: '200 pièces maximum par archive.' }

  const { data: docs, error } = await supabase.from('documents')
    .select('id, filename, storage_path')
    .eq('project_id', input.projectId)
    .in('id', input.documentIds)
  if (error) return { ok: false, error: `Lecture impossible : ${error.message}` }

  const paths = (docs ?? []).map(d => d.storage_path).filter(Boolean) as string[]
  if (!paths.length) return { ok: false, error: 'Aucun fichier disponible.' }
  const { data: signed, error: signErr } = await supabase.storage.from('documents').createSignedUrls(paths, GALLERY_URL_TTL)
  if (signErr) return { ok: false, error: `Liens indisponibles : ${signErr.message}` }

  const urlByPath = new Map((signed ?? []).map(s => [s.path ?? '', s.signedUrl]))
  const files = (docs ?? [])
    .filter(d => d.storage_path && urlByPath.get(d.storage_path))
    .map(d => ({ id: d.id, filename: d.filename, url: urlByPath.get(d.storage_path as string) as string }))
  return { ok: true, files }
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
