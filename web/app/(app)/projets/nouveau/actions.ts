'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canCreateProjects } from '@/lib/permissions'
import type { ProjectStatus } from '@/lib/types'

const PROJECT_STATUSES: ProjectStatus[] = ['en_preparation', 'en_cours', 'suspendu', 'termine']

export interface CreateProjectInput {
  name: string
  description: string
  country: string
  zone: string
  start_date: string
  end_date: string
  status: ProjectStatus
  budget: string
  lead_org_id: string
}

export async function createProject(input: CreateProjectInput): Promise<{ ok: boolean; error?: string; projectId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }

  if (!(await canCreateProjects(supabase, user.id))) {
    return { ok: false, error: 'La création de projet est réservée aux administrateurs.' }
  }

  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Le nom du projet est obligatoire.' }
  if (!input.lead_org_id) return { ok: false, error: "L'organisation porteuse est obligatoire." }
  if (!PROJECT_STATUSES.includes(input.status)) return { ok: false, error: 'Statut invalide.' }
  const budget = input.budget ? Number(input.budget) : null
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
    return { ok: false, error: 'Le budget doit être un nombre positif.' }
  }
  if (input.start_date && input.end_date && input.end_date < input.start_date) {
    return { ok: false, error: 'La date de fin doit être postérieure à la date de début.' }
  }

  const { data: project, error: insertError } = await supabase
    .from('projects')
    .insert({
      name,
      description: input.description?.trim() || null,
      country: input.country?.trim() || null,
      zone: input.zone?.trim() || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      status: input.status,
      budget,
      currency: 'EUR',
      lead_org_id: input.lead_org_id,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (insertError || !project) {
    return { ok: false, error: `Échec de la création : ${insertError?.message ?? 'erreur inconnue'}` }
  }

  // Organisation porteuse + créateur chef de projet (policies « bootstrap » 0008)
  const [{ error: orgError }, { error: memberError }] = await Promise.all([
    supabase.from('project_organizations').insert({ project_id: project.id, org_id: input.lead_org_id, role: 'porteur' }),
    supabase.from('project_members').insert({ project_id: project.id, user_id: user.id, role: 'chef_projet' }),
  ])
  if (orgError || memberError) {
    return {
      ok: false,
      error: `Projet créé mais rattachements incomplets : ${(orgError ?? memberError)?.message}. Vérifiez la migration 0008.`,
      projectId: project.id,
    }
  }

  await supabase.from('audit_log').insert({
    project_id: project.id,
    entity: 'project',
    entity_id: project.id,
    label: name,
    action: 'cree',
    user_id: user.id,
  })

  revalidatePath('/projets')
  return { ok: true, projectId: project.id }
}
