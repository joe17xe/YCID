import type { SupabaseClient } from '@supabase/supabase-js'

// Admins de la plateforme : admins plateforme (is_platform_admin)
// et admins d'organisation YCID / LEY.
export async function isUserAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const [{ data: profile }, { data: adminOrgs }] = await Promise.all([
    supabase.from('profiles').select('is_platform_admin').eq('id', userId).single(),
    supabase.from('memberships').select('role, organizations:org_id(name)').eq('user_id', userId).eq('role', 'admin_org'),
  ])
  if (profile?.is_platform_admin) return true
  return (adminOrgs ?? []).some(m => {
    // supabase-js peut typer la jointure to-one comme objet ou tableau
    const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations
    const name = String(org?.name ?? '').toUpperCase()
    return name.includes('YCID') || name.includes('LEY')
  })
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
