import type { SupabaseClient } from '@supabase/supabase-js'

// Modifier une tâche terminée est réservé aux admins plateforme
// et aux admins d'organisation YCID / LEY.
export async function canEditCompletedTasks(supabase: SupabaseClient, userId: string): Promise<boolean> {
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
