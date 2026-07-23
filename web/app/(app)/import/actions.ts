'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isUserAdmin } from '@/lib/permissions'

export type ImportKind = 'projets' | 'phases' | 'taches' | 'budget'

export interface ImportResult {
  ok: boolean
  error?: string
  created: number
  skipped: number
  errors: string[]
}

// Normalise un libellé : minuscules, sans accents, espaces → _
function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_')
}

// Accepte AAAA-MM-JJ ou JJ/MM/AAAA, sinon null
function parseDate(s: unknown): string | null {
  const v = String(s ?? '').trim()
  if (!v) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

const PROJECT_STATUSES = new Set(['en_preparation', 'en_cours', 'suspendu', 'termine'])
const PHASE_STATUSES = new Set(['a_venir', 'en_cours', 'terminee'])
const TASK_STATUSES = new Set(['a_faire', 'en_cours', 'terminee', 'bloquee'])
const LINE_STATUSES = new Set(['prevue', 'active', 'cloturee'])
const LINE_CATEGORIES = new Set(['investissement', 'fonctionnement', 'projet', 'autre'])

export async function runImport(input: { kind: ImportKind; filename: string; rows: Record<string, string>[] }): Promise<ImportResult> {
  const fail = (error: string): ImportResult => ({ ok: false, error, created: 0, skipped: 0, errors: [] })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('Non authentifié.')
  if (!(await isUserAdmin(supabase, user.id))) return fail("L'import est réservé aux administrateurs YCID / LEY.")
  if (!input.rows?.length) return fail('Aucune ligne à importer.')
  if (input.rows.length > 500) return fail('500 lignes maximum par import.')

  // Référentiels pour résoudre les noms → identifiants
  const [{ data: orgs }, { data: projects }, { data: phases }, { data: profiles }] = await Promise.all([
    supabase.from('organizations').select('id, name'),
    supabase.from('projects').select('id, name'),
    supabase.from('phases').select('id, project_id, name'),
    supabase.from('profiles').select('id, email'),
  ])
  const orgByName = new Map((orgs ?? []).map(o => [norm(o.name), o.id]))
  const projectByName = new Map((projects ?? []).map(p => [norm(p.name), p.id]))
  const phaseByKey = new Map((phases ?? []).map(ph => [`${ph.project_id}::${norm(ph.name)}`, ph.id]))
  const profileByEmail = new Map((profiles ?? []).map(p => [String(p.email ?? '').toLowerCase(), p.id]))
  const phaseCountByProject = new Map<string, number>()
  for (const ph of phases ?? []) phaseCountByProject.set(ph.project_id, (phaseCountByProject.get(ph.project_id) ?? 0) + 1)

  const errors: string[] = []
  const kind = input.kind

  // Validation complète AVANT toute écriture ; chaque table est ensuite
  // insérée en un seul appel (une seule transaction PostgREST par table).
  const projectRows: Record<string, unknown>[] = []
  const projectOrgRows: Record<string, unknown>[] = []
  const projectMemberRows: Record<string, unknown>[] = []
  const phaseRows: Record<string, unknown>[] = []
  const taskRows: Record<string, unknown>[] = []
  const budgetRows: Record<string, unknown>[] = []

  input.rows.forEach((row, i) => {
    const line = i + 2 // ligne CSV (après l'en-tête)
    try {
      if (kind === 'projets') {
        const name = String(row.nom ?? '').trim()
        const orgId = orgByName.get(norm(row.organisation_porteuse))
        if (!name) throw new Error('nom manquant')
        if (projectByName.has(norm(name))) throw new Error(`projet « ${name} » existe déjà`)
        if (!orgId) throw new Error(`organisation porteuse inconnue : « ${row.organisation_porteuse} »`)
        const status = norm(row.statut) || 'en_preparation'
        if (!PROJECT_STATUSES.has(status)) throw new Error(`statut invalide : « ${row.statut} »`)
        const id = randomUUID()
        projectRows.push({
          id, name, description: String(row.description ?? '').trim() || null,
          country: String(row.pays ?? '').trim() || null, zone: String(row.zone ?? '').trim() || null,
          start_date: parseDate(row.date_debut), end_date: parseDate(row.date_fin),
          status, currency: 'EUR', lead_org_id: orgId, created_by: user.id,
        })
        projectOrgRows.push({ project_id: id, org_id: orgId, role: 'porteur' })
        projectMemberRows.push({ project_id: id, user_id: user.id, role: 'chef_projet' })
        projectByName.set(norm(name), id)
      } else if (kind === 'phases') {
        const projectId = projectByName.get(norm(row.projet))
        const name = String(row.phase ?? '').trim()
        if (!projectId) throw new Error(`projet inconnu : « ${row.projet} »`)
        if (!name) throw new Error('nom de phase manquant')
        if (phaseByKey.has(`${projectId}::${norm(name)}`)) throw new Error(`phase « ${name} » existe déjà dans ce projet`)
        const status = norm(row.statut) || 'a_venir'
        if (!PHASE_STATUSES.has(status)) throw new Error(`statut invalide : « ${row.statut} »`)
        const id = randomUUID()
        const position = (phaseCountByProject.get(projectId) ?? 0) + 1
        phaseCountByProject.set(projectId, position)
        phaseRows.push({
          id, project_id: projectId, name, position,
          start_date: parseDate(row.date_debut), end_date: parseDate(row.date_fin), status,
        })
        phaseByKey.set(`${projectId}::${norm(name)}`, id)
      } else if (kind === 'taches') {
        const projectId = projectByName.get(norm(row.projet))
        if (!projectId) throw new Error(`projet inconnu : « ${row.projet} »`)
        const phaseId = phaseByKey.get(`${projectId}::${norm(row.phase)}`)
        if (!phaseId) throw new Error(`phase inconnue : « ${row.phase} »`)
        const title = String(row.titre ?? '').trim()
        if (!title) throw new Error('titre manquant')
        const status = norm(row.statut) || 'a_faire'
        if (!TASK_STATUSES.has(status)) throw new Error(`statut invalide : « ${row.statut} »`)
        const progress = row.avancement ? Math.round(Number(row.avancement)) : 0
        if (!Number.isFinite(progress) || progress < 0 || progress > 100) throw new Error(`avancement invalide : « ${row.avancement} »`)
        const email = String(row.responsable_email ?? '').trim().toLowerCase()
        const assignee = email ? profileByEmail.get(email) : null
        if (email && !assignee) throw new Error(`responsable inconnu : « ${email} » (compte inexistant)`)
        taskRows.push({
          phase_id: phaseId, title, description: String(row.description ?? '').trim() || null,
          assignee_id: assignee ?? null, start_date: parseDate(row.date_debut), end_date: parseDate(row.date_fin),
          status, progress, comment: String(row.commentaire ?? '').trim() || null, created_by: user.id,
        })
      } else if (kind === 'budget') {
        const projectId = projectByName.get(norm(row.projet))
        if (!projectId) throw new Error(`projet inconnu : « ${row.projet} »`)
        const poste = String(row.poste ?? '').trim()
        if (!poste) throw new Error('poste manquant')
        const category = norm(row.categorie) || 'autre'
        if (!LINE_CATEGORIES.has(category)) throw new Error(`catégorie invalide : « ${row.categorie} »`)
        const amount = Number(String(row.montant_previsionnel ?? '').replace(/\s/g, '').replace(',', '.'))
        if (!Number.isFinite(amount) || amount < 0) throw new Error(`montant invalide : « ${row.montant_previsionnel} »`)
        const status = norm(row.statut) || 'prevue'
        if (!LINE_STATUSES.has(status)) throw new Error(`statut invalide : « ${row.statut} »`)
        const funder = row.financeur ? orgByName.get(norm(row.financeur)) : null
        if (row.financeur && !funder) throw new Error(`financeur inconnu : « ${row.financeur} »`)
        const owner = row.organisation_responsable ? orgByName.get(norm(row.organisation_responsable)) : null
        if (row.organisation_responsable && !owner) throw new Error(`organisation responsable inconnue : « ${row.organisation_responsable} »`)
        const phaseId = row.phase ? phaseByKey.get(`${projectId}::${norm(row.phase)}`) : null
        if (row.phase && !phaseId) throw new Error(`phase inconnue : « ${row.phase} »`)
        budgetRows.push({
          project_id: projectId, phase_id: phaseId ?? null, poste,
          description: String(row.description ?? '').trim() || null, category,
          funder_org_id: funder ?? null, owner_org_id: owner ?? null,
          year: row.annee ? Number(row.annee) : null, planned_amount: amount,
          is_valorisation: ['oui', 'true', '1', 'x'].includes(norm(row.valorisation)),
          status, comment: String(row.commentaire ?? '').trim() || null,
        })
      }
    } catch (e) {
      errors.push(`Ligne ${line} : ${e instanceof Error ? e.message : 'erreur inconnue'}`)
    }
  })

  const created = projectRows.length + phaseRows.length + taskRows.length + budgetRows.length
  let status = 'succes'

  if (created > 0) {
    const inserts: { table: string; rows: Record<string, unknown>[] }[] = [
      { table: 'projects', rows: projectRows },
      { table: 'project_organizations', rows: projectOrgRows },
      { table: 'project_members', rows: projectMemberRows },
      { table: 'phases', rows: phaseRows },
      { table: 'tasks', rows: taskRows },
      { table: 'budget_lines', rows: budgetRows },
    ]
    for (const { table, rows } of inserts) {
      if (!rows.length) continue
      const { error } = await supabase.from(table).insert(rows)
      if (error) {
        errors.push(`Écriture ${table} : ${error.message}`)
        status = 'echec'
        break
      }
    }
  } else {
    status = 'echec'
  }

  await supabase.from('import_runs').insert({
    kind, filename: input.filename || null,
    created_count: status === 'echec' ? 0 : created,
    skipped_count: errors.length,
    errors: errors.length ? errors.slice(0, 50) : null,
    status, by_user: user.id,
  })

  revalidatePath('/import')
  revalidatePath('/projets')
  return {
    ok: status !== 'echec',
    error: status === 'echec' ? (errors[0] ?? 'Aucune ligne valide.') : undefined,
    created: status === 'echec' ? 0 : created,
    skipped: errors.length,
    errors: errors.slice(0, 20),
  }
}
