import type { SupabaseClient } from '@supabase/supabase-js'

// ⚠️ Schéma RÉEL de production (différent de schema.sql du dépôt) :
//   profiles.auth_user_id (uuid) ← lien avec auth.uid()
//   profiles.id (text)           ← identifiant interne
//   profiles.org_id (text)       ← organisation de rattachement (unique)
//   profiles.is_org_admin (bool) ← admin de son organisation
//   organizations.name           ← pour distinguer YCID / LEY
// Il n'y a NI table `memberships`, NI colonne `is_platform_admin`.

// Renvoie la ligne profiles de l'utilisateur connecté (via auth_user_id).
export async function getCurrentProfile(supabase: SupabaseClient, authUserId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, email, org_id, is_org_admin, organizations:org_id(name)')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  return data
}

// Admin YCID/LEY : admin de son organisation, et cette organisation
// est YCID ou LEY. C'est le rôle qui débloque les écrans d'administration
// et la réouverture des tâches terminées.
export async function isUserAdmin(supabase: SupabaseClient, authUserId: string): Promise<boolean> {
  const profile = await getCurrentProfile(supabase, authUserId)
  if (!profile?.is_org_admin) return false
  const org = Array.isArray(profile.organizations) ? profile.organizations[0] : profile.organizations
  const name = String(org?.name ?? '').toUpperCase()
  return name.includes('YCID') || name.includes('LEY')
}

// Modifier une tâche terminée : réservé aux admins YCID/LEY.
export async function canEditCompletedTasks(supabase: SupabaseClient, authUserId: string): Promise<boolean> {
  return isUserAdmin(supabase, authUserId)
}

// Créer un projet : tout admin d'organisation (pas seulement YCID/LEY).
export async function canCreateProjects(supabase: SupabaseClient, authUserId: string): Promise<boolean> {
  const profile = await getCurrentProfile(supabase, authUserId)
  return !!profile?.is_org_admin
}
