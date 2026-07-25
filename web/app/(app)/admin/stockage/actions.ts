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

  return {
    ok: true,
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

  await supabase.from('audit_log').insert({
    project_id: null, entity: 'stockage', entity_id: null,
    label: 'Fichiers orphelins', action: 'supprime', user_id: user.id,
    comment: `${removed} fichier(s) orphelin(s) purgé(s) du bucket documents`,
  })
  revalidatePath('/admin/stockage')
  return { ok: true, removed }
}
