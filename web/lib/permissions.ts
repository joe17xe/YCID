import type { SupabaseClient } from '@supabase/supabase-js'

// Rôle plateforme effectif. `is_platform_admin` ne dit PAS ce que son
// nom laisse croire : l'écran de gestion des comptes l'a longtemps posé
// à `role <> 'user'`, donc vrai pour tout rôle non ordinaire. On
// raisonne sur platform_role, avec repli sur le drapeau pour les comptes
// antérieurs à la migration 0017.
type PlatformRole = 'admin' | 'user'
async function platformRole(supabase: SupabaseClient, userId: string): Promise<PlatformRole> {
  const { data } = await supabase.from('profiles')
    .select('platform_role, is_platform_admin').eq('id', userId).maybeSingle()
  const role = data?.platform_role ?? (data?.is_platform_admin ? 'admin' : 'user')
  return (role === 'admin' ? 'admin' : 'user') as PlatformRole
}

// Administration de l'OUTIL : comptes, marque, IA, mentions légales,
// stockage. Le seul rôle « admin » (migration 0037).
//
// Le raccourci « admin d'organisation YCID / LEY » a été retiré : c'était
// un troisième chemin global vers l'administration, du même genre que le
// rôle « ycid » qu'on supprime. Piloter un programme ne veut pas dire
// configurer l'outil.
export async function isUserAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  return (await platformRole(supabase, userId)) === 'admin'
}

// Modifier une tâche terminée est réservé aux mêmes admins.
export async function canEditCompletedTasks(supabase: SupabaseClient, userId: string): Promise<boolean> {
  return isUserAdmin(supabase, userId)
}

// Créer un projet : admins plateforme/YCID/LEY ou admin d'une organisation
// (miroir de la policy RLS « Org admins create projects »).
export async function canCreateProjects(supabase: SupabaseClient, userId: string): Promise<boolean> {
  if (await isUserAdmin(supabase, userId)) return true
  const { data } = await supabase.from('memberships').select('org_id').eq('user_id', userId).eq('role', 'admin_org').limit(1)
  return (data ?? []).length > 0
}

// Rôle de l'utilisateur dans un projet (null s'il n'est pas membre direct).
export async function getProjectRole(supabase: SupabaseClient, userId: string, projectId: string): Promise<string | null> {
  const { data } = await supabase.from('project_members').select('role').eq('project_id', projectId).eq('user_id', userId).maybeSingle()
  return data?.role ?? null
}

// Gérer les phases : chef de projet ou admin (policies « Chef manage
// phases » + « Admins manage phases », migration 0011).
export async function canManagePhases(supabase: SupabaseClient, userId: string, projectId: string): Promise<boolean> {
  if (await isUserAdmin(supabase, userId)) return true
  const role = await getProjectRole(supabase, userId, projectId)
  return role === 'chef_projet' || role === 'referent_mairie'
}

// Gérer les tâches : chef de projet, resp. financier, contributeur ou admin
// (policies « Contributeur ... tasks » + « Admins manage tasks »).
export async function canManageTasks(supabase: SupabaseClient, userId: string, projectId: string): Promise<boolean> {
  if (await isUserAdmin(supabase, userId)) return true
  const role = await getProjectRole(supabase, userId, projectId)
  return role === 'chef_projet' || role === 'referent_mairie' || role === 'resp_financier' || role === 'contributeur'
}

// Gérer le budget et les indicateurs : chef, resp. financier ou admin
// (policies « Manage budget lines / indicators » + overrides admin 0013).
export async function canManageBudget(supabase: SupabaseClient, userId: string, projectId: string): Promise<boolean> {
  if (await isUserAdmin(supabase, userId)) return true
  const role = await getProjectRole(supabase, userId, projectId)
  return role === 'chef_projet' || role === 'referent_mairie' || role === 'resp_financier'
}

// Gérer les réunions et décisions COPIL : chef de projet ou admin.
export async function canManageMeetings(supabase: SupabaseClient, userId: string, projectId: string): Promise<boolean> {
  if (await isUserAdmin(supabase, userId)) return true
  const role = await getProjectRole(supabase, userId, projectId)
  return role === 'chef_projet' || role === 'referent_mairie'
}

// Arbitrage de la roadmap : une CAPACITÉ cochée sur le profil, pas un
// rôle. La gouvernance produit n'est ni un droit projet ni de
// l'administration technique — le Product Owner arbitre le backlog sans
// toucher aux comptes.
export async function canManageRoadmap(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles')
    .select('can_manage_roadmap, platform_role, is_platform_admin').eq('id', userId).maybeSingle()
  if (data?.can_manage_roadmap) return true
  return (data?.platform_role ?? (data?.is_platform_admin ? 'admin' : 'user')) === 'admin'
}
