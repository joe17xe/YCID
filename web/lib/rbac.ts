import type { ProjectMemberRole } from './types'

// Registre central des permissions : qui accède à quoi.
// La colonne « admin » couvre les admins plateforme et les admins
// d'organisation YCID / LEY. Les rôles projet correspondent aux
// policies RLS Supabase (migrations 0001 à 0007) — toute évolution
// des policies doit être répercutée ici.

export const ROLE_COLUMNS: { key: ProjectMemberRole; label: string }[] = [
  { key: 'chef_projet', label: 'Chef de projet' },
  { key: 'resp_financier', label: 'Resp. financier' },
  { key: 'contributeur', label: 'Contributeur' },
  { key: 'validateur', label: 'Validateur' },
  { key: 'auditeur', label: 'Auditeur' },
  { key: 'lecteur', label: 'Lecteur' },
]

interface PermissionRow {
  key: string
  label: string
  note?: string
  admin: boolean
  roles: ProjectMemberRole[]
}

const ALL: ProjectMemberRole[] = ['chef_projet', 'resp_financier', 'contributeur', 'validateur', 'auditeur', 'lecteur']

export const RBAC_MATRIX: PermissionRow[] = [
  { key: 'projets.view', label: 'Voir les projets dont on est membre', admin: true, roles: ALL },
  { key: 'projets.update', label: 'Modifier un projet', admin: true, roles: ['chef_projet'] },
  { key: 'phases.manage', label: 'Gérer les phases', admin: true, roles: ['chef_projet'] },
  { key: 'taches.manage', label: 'Créer et modifier les tâches', admin: true, roles: ['chef_projet', 'resp_financier', 'contributeur'] },
  { key: 'taches.reopen_terminee', label: 'Rouvrir une tâche terminée', note: 'Double confirmation + journal d’audit', admin: true, roles: [] },
  { key: 'budget.view', label: 'Voir le budget', admin: true, roles: ALL },
  { key: 'budget.manage', label: 'Gérer les lignes budgétaires', admin: true, roles: ['chef_projet', 'resp_financier'] },
  { key: 'documents.upload', label: 'Déposer des documents', admin: true, roles: ALL },
  { key: 'validations.decide', label: 'Valider un devis / une facture', note: 'Selon l’organisation validante du circuit', admin: true, roles: ['validateur'] },
  { key: 'indicateurs.manage', label: 'Gérer les indicateurs d’impact', admin: true, roles: ['chef_projet', 'resp_financier'] },
  { key: 'mesures.add', label: 'Saisir une mesure d’impact', admin: true, roles: ALL },
  { key: 'copil.manage', label: 'Gérer les réunions COPIL', admin: true, roles: ['chef_projet'] },
  { key: 'decisions.manage', label: 'Gérer les décisions', note: 'Le responsable d’une décision peut aussi la mettre à jour', admin: true, roles: ['chef_projet'] },
  { key: 'audit.view', label: 'Consulter le journal d’audit', admin: true, roles: ALL },
  { key: 'users.manage', label: 'Gérer les utilisateurs et invitations', admin: true, roles: [] },
  { key: 'orgs.create', label: 'Créer une organisation', admin: true, roles: [] },
]
