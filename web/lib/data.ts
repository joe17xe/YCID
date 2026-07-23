import type { SupabaseClient } from '@supabase/supabase-js'

// ⚠️ Accès aux données sur le schéma RÉEL de production.
// Les jointures sont faites en JS sur les identifiants texte
// (ids courts type "p1", "o2", "u3"), car :
//   - le lien projet ↔ organisations est stocké dans projects.orgs
//     (jsonb : [{ "role": "...", "orgId": "..." }]) et non dans une
//     table project_organizations ;
//   - on ne dépend d'aucune clé étrangère PostgREST (non garanties ici).

export interface ResolvedOrg { orgId: string; role: string; name?: string; type?: string }

export interface ProjectOverview {
  id: string
  name: string
  description?: string
  country?: string
  zone?: string
  start_date?: string
  end_date?: string
  status: string
  budget?: number
  currency?: string
  lead_org_id?: string
  orgsResolved: ResolvedOrg[]
  phases: PhaseWithTasks[]
}

export interface PhaseWithTasks {
  id: string
  project_id: string
  name: string
  status?: string
  budget?: number
  tasks: TaskRow[]
}

export interface TaskRow {
  id: string
  phase_id: string
  title: string
  status: string
  progress: number
  end_date?: string
  [k: string]: unknown
}

// Progression moyenne d'un ensemble de tâches (0-100).
export function avgProgress(tasks: { progress?: number }[]): number {
  if (!tasks.length) return 0
  return Math.round(tasks.reduce((s, t) => s + (t.progress ?? 0), 0) / tasks.length)
}

// Tous les projets enrichis (phases, tâches, organisations résolues),
// triés par nom. Une seule série de requêtes à plat.
export async function getProjectsOverview(supabase: SupabaseClient): Promise<{ projects: ProjectOverview[]; error: string | null }> {
  const [projectsRes, phasesRes, tasksRes, orgsRes] = await Promise.all([
    supabase.from('projects').select('*'),
    supabase.from('phases').select('id, project_id, name, status, budget'),
    supabase.from('tasks').select('id, phase_id, title, status, progress, end_date'),
    supabase.from('organizations').select('id, name, type'),
  ])
  const error = projectsRes.error?.message ?? phasesRes.error?.message ?? tasksRes.error?.message ?? orgsRes.error?.message ?? null

  const orgMap = new Map((orgsRes.data ?? []).map((o: any) => [o.id, o]))

  const tasksByPhase = new Map<string, TaskRow[]>()
  for (const t of (tasksRes.data ?? []) as TaskRow[]) {
    const arr = tasksByPhase.get(t.phase_id) ?? []
    arr.push(t)
    tasksByPhase.set(t.phase_id, arr)
  }

  const phasesByProject = new Map<string, PhaseWithTasks[]>()
  for (const ph of (phasesRes.data ?? []) as any[]) {
    const withTasks: PhaseWithTasks = { ...ph, tasks: tasksByPhase.get(ph.id) ?? [] }
    const arr = phasesByProject.get(ph.project_id) ?? []
    arr.push(withTasks)
    phasesByProject.set(ph.project_id, arr)
  }

  const projects: ProjectOverview[] = (projectsRes.data ?? [])
    .map((p: any) => {
      const orgList = Array.isArray(p.orgs) ? p.orgs : []
      return {
        ...p,
        orgsResolved: orgList.map((o: any) => ({
          orgId: o.orgId,
          role: o.role,
          name: orgMap.get(o.orgId)?.name,
          type: orgMap.get(o.orgId)?.type,
        })),
        phases: phasesByProject.get(p.id) ?? [],
      }
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'))

  return { projects, error }
}
