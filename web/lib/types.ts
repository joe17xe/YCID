export type OrgType = 'association'|'collectivite'|'partenaire_local'|'partenaire_medical'|'financeur'|'financeur_public'|'mecene'|'autre'
export type OrgStatus = 'active'|'inactive'
export type ProjectStatus = 'en_preparation'|'en_cours'|'suspendu'|'termine'
export type ProjectOrgRole = 'porteur'|'partenaire'|'financeur'|'observateur'|'partenaire_terrain'|'partenaire_medical'|'beneficiaire'
export type ProjectMemberRole = 'chef_projet'|'resp_financier'|'contributeur'|'validateur'|'auditeur'|'lecteur'
export type PhaseStatus = 'a_venir'|'en_cours'|'terminee'
export type TaskStatus = 'a_faire'|'en_cours'|'terminee'|'bloquee'
export type DocType = 'devis'|'facture'|'recu'|'justificatif'|'convention'|'note'|'etude'|'photo'|'livrable'|'rapport'
export type ReviewState = 'brouillon'|'soumis'|'en_revue'|'valide'|'rejete'
export type LineStatus = 'prevue'|'active'|'cloturee'
export type LineCategory = 'investissement'|'fonctionnement'|'projet'|'autre'
export type DecisionStatus = 'a_faire'|'en_cours'|'fait'
export type MeetingKind = 'copil'|'technique'|'terrain'

export interface Profile {
  id: string
  email: string
  full_name: string
  is_platform_admin: boolean
  created_at: string
}

export interface Organization {
  id: string
  name: string
  type: OrgType
  country: string
  email?: string
  status: OrgStatus
  created_at: string
}

export interface Project {
  id: string
  name: string
  description?: string
  country?: string
  zone?: string
  lat?: number
  lng?: number
  start_date?: string
  end_date?: string
  status: ProjectStatus
  budget?: number
  currency: string
  lead_org_id?: string
  created_by?: string
  created_at: string
  // joined
  project_organizations?: ProjectOrganization[]
  project_members?: ProjectMember[]
  phases?: Phase[]
}

export interface ProjectOrganization {
  project_id: string
  org_id: string
  role: ProjectOrgRole
  organizations?: Organization
}

export interface ProjectMember {
  project_id: string
  user_id: string
  role: ProjectMemberRole
  profiles?: Profile
}

export interface Phase {
  id: string
  project_id: string
  name: string
  position: number
  start_date?: string
  end_date?: string
  status: PhaseStatus
  budget?: number
  tasks?: Task[]
}

export interface Task {
  id: string
  phase_id: string
  title: string
  description?: string
  assignee_id?: string
  start_date?: string
  end_date?: string
  status: TaskStatus
  progress: number
  comment?: string
  created_by?: string
  created_at: string
  profiles?: Profile
  documents?: Document[]
}

export interface Document {
  id: string
  task_id?: string
  budget_line_id?: string
  type: DocType
  filename: string
  storage_path?: string
  amount?: number
  paid: boolean
  uploaded_by?: string
  uploaded_at: string
  profiles?: Profile
}

export interface BudgetLine {
  id: string
  project_id: string
  phase_id?: string
  poste: string
  description?: string
  category: LineCategory
  funder_org_id?: string
  owner_org_id?: string
  year?: number
  planned_amount: number
  is_valorisation: boolean
  status: LineStatus
  comment?: string
  created_at: string
  funder?: Organization
  owner?: Organization
  phase?: Phase
}

export interface Indicator {
  id: string
  project_id: string
  name: string
  description?: string
  kind: 'quantitatif'|'qualitatif'
  unit?: string
  periodicity: string
  source: string
  baseline?: number
  target: number
  phase_id?: string
  created_at: string
  measures?: IndicatorMeasure[]
}

export interface IndicatorMeasure {
  id: string
  indicator_id: string
  period: string
  value: number
  comment?: string
  entered_by?: string
  at: string
}

export interface Meeting {
  id: string
  project_id: string
  title: string
  kind: MeetingKind
  date: string
  attendees?: string[]
  minutes?: string
  created_by?: string
  decisions?: Decision[]
}

export interface Decision {
  id: string
  meeting_id?: string
  project_id: string
  text: string
  owner_user_id?: string
  due_date?: string
  status: DecisionStatus
  task_id?: string
  created_at: string
  owner?: Profile
}

export interface AuditEntry {
  id: string
  project_id?: string
  entity: string
  entity_id?: string
  label?: string
  action: string
  user_id?: string
  at: string
  comment?: string
  profiles?: Profile
}
