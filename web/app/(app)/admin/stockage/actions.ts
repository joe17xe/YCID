'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isUserAdmin } from '@/lib/permissions'

// ============================================================
// PR 41 — Écran Stockage : inventaire et purge des orphelins
// ============================================================

export interface BucketStat { bucket: string; files: number; bytes: number }
export interface Orphan { path: string; bytes: number; createdAt: string }
export interface ProjectStat { projectId: string; projectName: string; files: number; bytes: number }

export async function loadStorage(): Promise<{
  ok: boolean; error?: string
  buckets?: BucketStat[]; orphans?: Orphan[]; projects?: ProjectStat[]
  // Point de contrôle des sauvegardes VPS (0052) : date de la dernière
  // réussie et son âge en heures — null tant qu'aucune n'a eu lieu ou
  // que la migration n'est pas passée (lecture tolérante).
  backup?: { at: string; ageHours: number } | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await isUserAdmin(supabase, user.id))) return { ok: false, error: 'Réservé aux administrateurs.' }

  const [stats, orphans, byProject] = await Promise.all([
    supabase.rpc('storage_stats'),
    supabase.rpc('storage_orphans'),
    supabase.rpc('storage_by_project'),
  ])
  // Migration 0034 non appliquée : on le dit, plutôt que d'afficher un
  // écran vide qui laisserait croire que le stockage est vide.
  if (stats.error) return { ok: false, error: `Statistiques indisponibles — la migration 0034 est-elle appliquée ? (${stats.error.message})` }

  const { data: bk } = await supabase.from('platform_settings').select('backup_last_at').maybeSingle()
  const backup = bk?.backup_last_at
    ? { at: bk.backup_last_at as string, ageHours: (Date.now() - new Date(bk.backup_last_at).getTime()) / 3600000 }
    : null

  return {
    ok: true,
    backup,
    buckets: ((stats.data ?? []) as { bucket: string; files: number; bytes: number }[])
      .map(b => ({ bucket: b.bucket, files: Number(b.files), bytes: Number(b.bytes) })),
    orphans: ((orphans.data ?? []) as { path: string; bytes: number; created_at: string }[])
      .map(o => ({ path: o.path, bytes: Number(o.bytes), createdAt: o.created_at })),
    projects: ((byProject.data ?? []) as { project_id: string; project_name: string; files: number; bytes: number }[])
      .map(p => ({ projectId: p.project_id, projectName: p.project_name, files: Number(p.files), bytes: Number(p.bytes) })),
  }
}

// Purge : on ne supprime QUE ce que la fonction SQL a désigné comme
// orphelin au moment de l'appel. Faire confiance à une liste de chemins
// venue du navigateur permettrait de supprimer n'importe quel fichier
// rattaché, en forgeant la requête.
export async function purgeOrphans(): Promise<{ ok: boolean; removed?: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await isUserAdmin(supabase, user.id))) return { ok: false, error: 'Réservé aux administrateurs.' }

  const { data, error } = await supabase.rpc('storage_orphans')
  if (error) return { ok: false, error: `Liste indisponible : ${error.message}` }
  const paths = ((data ?? []) as { path: string }[]).map(o => o.path).filter(Boolean)
  if (!paths.length) return { ok: true, removed: 0 }

  // Par lots : l'API Storage plafonne le nombre de chemins par appel.
  let removed = 0
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100)
    const { error: rmErr } = await supabase.storage.from('documents').remove(batch)
    if (rmErr) return { ok: false, removed, error: `Purge interrompue après ${removed} fichier(s) : ${rmErr.message}` }
    removed += batch.length
  }

  // C'est la seule trace de la purge : les fichiers effacés du bucket ne
  // laissent rien derrière eux, et `storage_orphans()` ne les listera
  // plus. Jusqu'à la 0050, `supprime` n'existait pas dans l'enum
  // `audit_action` — cet insert était donc rejeté par PostgreSQL, et son
  // erreur n'était même pas lue. Des fichiers disparaissaient du
  // stockage sans que rien, nulle part, ne dise qui les avait purgés.
  const trace = {
    project_id: null, entity: 'stockage', entity_id: null,
    label: 'Fichiers orphelins', action: 'supprime', user_id: user.id,
    comment: `${removed} fichier(s) orphelin(s) purgé(s) du bucket documents`,
  }
  const { error: auditErr } = await supabase.from('audit_log').insert(trace)
  // Même règle que les suppressions de projet (deleteTask,
  // projets/[id]/actions.ts) : les fichiers sont déjà effacés, répondre
  // `ok: false` ferait croire à l'administrateur qu'ils sont encore là.
  // Le journal serveur porte donc l'intégralité de la trace, de quoi la
  // réinscrire à la main.
  //
  // Une raison de plus d'y veiller ici : `project_id` est nul, donc la
  // policy « Insert audit » (0005) ne passe que par
  // `is_project_member(null)`, qui se réduit à `is_admin()` depuis la
  // 0037. La purge étant réservée aux administrateurs, c'est vrai — mais
  // cela tient à un enchaînement de trois migrations, pas à une règle
  // écrite quelque part. Si un jour la purge s'ouvre à un autre profil,
  // c'est ce log qui le dira.
  if (auditErr) {
    console.error('[audit] SUPPRESSION NON TRACÉE — à réinscrire à la main :',
      JSON.stringify(trace), '—', auditErr.message)
  }
  revalidatePath('/admin/stockage')
  return { ok: true, removed }
}
