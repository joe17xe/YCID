import type { SupabaseClient } from '@supabase/supabase-js'
import { can, type Capability } from './rbac'

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

// Les quatre fonctions ci-dessous énuméraient chacune ses rôles à la
// main — quatre listes de plus, à côté de celles de la page projet et
// de la matrice d'affichage. Elles interrogent désormais lib/rbac.ts,
// qui devient la seule liste à tenir juste côté application. Les
// policies RLS restent la règle opposable ; ceci n'en est que le reflet
// fidèle, et le reflet cesse d'avoir sa propre opinion.
async function hasCapability(
  supabase: SupabaseClient, userId: string, projectId: string, capability: Capability,
): Promise<boolean> {
  if (await isUserAdmin(supabase, userId)) return true
  return can(await getProjectRole(supabase, userId, projectId), capability)
}

// Gérer les phases (policies « Chef manage phases » + « Admins manage
// phases », migration 0011).
export async function canManagePhases(supabase: SupabaseClient, userId: string, projectId: string): Promise<boolean> {
  return hasCapability(supabase, userId, projectId, 'phases.manage')
}

// Gérer les membres du projet. Séparé de `phases.manage` le 27/07 : la
// même autorisation servait à créer une phase et à décider qui a accès
// au projet.
export async function canManageMembers(supabase: SupabaseClient, userId: string, projectId: string): Promise<boolean> {
  return hasCapability(supabase, userId, projectId, 'membres.manage')
}

// Nommer ou retirer un AUDITEUR. Aucun rôle projet ne l'accorde : le
// contrôlé ne choisit pas son contrôleur (0047). Ce n'est donc pas une
// capacité de projet mais de plateforme — d'où l'absence de
// `hasCapability`, qui commencerait par accorder le droit à l'admin
// puis irait interroger un rôle projet pour rien.
export async function canManageAuditors(supabase: SupabaseClient, userId: string): Promise<boolean> {
  return isUserAdmin(supabase, userId)
}

// Gérer les tâches (policies « Contributeur ... tasks » + « Admins
// manage tasks »).
export async function canManageTasks(supabase: SupabaseClient, userId: string, projectId: string): Promise<boolean> {
  return hasCapability(supabase, userId, projectId, 'taches.manage')
}

// Gérer le budget et les indicateurs (policies « Manage budget lines /
// indicators » + overrides admin 0013).
export async function canManageBudget(supabase: SupabaseClient, userId: string, projectId: string): Promise<boolean> {
  return hasCapability(supabase, userId, projectId, 'budget.manage')
}

// Gérer les réunions et décisions COPIL.
export async function canManageMeetings(supabase: SupabaseClient, userId: string, projectId: string): Promise<boolean> {
  return hasCapability(supabase, userId, projectId, 'copil.manage')
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
