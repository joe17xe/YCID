import type { ProjectMemberRole } from './types'

// ============================================================
// Registre central des permissions : qui accède à quoi
// ============================================================
// Ce fichier était une matrice d'AFFICHAGE : il décrivait les droits
// sans les gouverner, et l'écran Administration ▸ Accès & rôles
// annonçait lui-même que « les règles vivent ailleurs ». La vérité
// existait donc en trois exemplaires — les policies RLS, les tableaux
// recopiés dans la page projet, et cette matrice. Elles ont divergé :
//
//   · `documents.upload` était annoncé à TOUS les rôles, alors que
//     can_upload_document() (0029) en exclut le rôle de lecture ;
//   · `validations.decide` désignait le rôle « validateur », qui depuis
//     la 0036 ne décide plus rien — la décision vient de l'appartenance
//     à l'organisation sollicitée, pas du rôle projet.
//
// Un écran de droits qui ment est pire que pas d'écran du tout. La
// matrice devient donc la source que lit AUSSI l'application (voir
// `can()` ci-dessous). Le SQL reste maître pour la sécurité — c'est sa
// place, et lui seul est inviolable depuis le navigateur. Ce qui
// disparaît, c'est l'opinion séparée de l'interface.

// ------------------------------------------------------------
// Les rôles
// ------------------------------------------------------------
// Cinq rôles attribuables. « validateur » et « auditeur » ont été
// fusionnés dans « lecteur » (migration 0038, arbitrage du 26/07) :
//
//   · « validateur » ne validait plus rien depuis la 0036. Décider
//     revient au membre de l'organisation sollicitée — un mécanisme
//     d'appartenance, pas un rôle projet. Le libellé promettait un
//     pouvoir que le code avait retiré ;
//   · « auditeur » et « lecteur » étaient rigoureusement identiques :
//     aucun contrôle de l'application ne les distinguait.
//
// Un seul rôle de consultation, qui voit tout sans rien pouvoir
// modifier — journal d'audit compris. Masquer la traçabilité à un
// lecteur reviendrait à réintroduire la distinction qu'on supprime,
// alors que cette traçabilité est justement ce qu'on montre au
// financeur.
export const ASSIGNABLE_ROLES: ProjectMemberRole[] = [
  'chef_projet', 'referent_mairie', 'resp_financier', 'contributeur', 'lecteur',
]

// Conservés pour l'affichage des données antérieures à la 0038. Un
// enum PostgreSQL ne perd pas ses valeurs : elles ne sont plus
// proposées à la saisie, mais restent lisibles si une ligne y échappe.
export const LEGACY_ROLES: ProjectMemberRole[] = ['validateur', 'auditeur']

const ALL: ProjectMemberRole[] = [...ASSIGNABLE_ROLES, ...LEGACY_ROLES]

// Tout sauf la consultation. Nommé plutôt que recopié : c'est
// l'énumération qui divergeait le plus souvent d'un fichier à l'autre.
const CONTRIBUTORS: ProjectMemberRole[] = ['chef_projet', 'referent_mairie', 'resp_financier', 'contributeur']

export const ROLE_COLUMNS: { key: ProjectMemberRole; label: string }[] = [
  { key: 'chef_projet', label: 'Responsable projet · PM' },
  { key: 'referent_mairie', label: 'Référent Mairie' },
  { key: 'resp_financier', label: 'Resp. financier' },
  { key: 'contributeur', label: 'Contributeur · Terrain' },
  { key: 'lecteur', label: 'Lecteur' },
]

// ------------------------------------------------------------
// Les capacités
// ------------------------------------------------------------
export type Capability =
  | 'projets.view' | 'projets.update'
  | 'phases.manage' | 'taches.manage' | 'taches.reopen_terminee'
  | 'budget.view' | 'budget.manage'
  | 'documents.upload' | 'validations.decide'
  | 'indicateurs.manage' | 'mesures.add'
  | 'copil.manage' | 'decisions.manage'
  | 'audit.view' | 'users.manage' | 'orgs.create'

interface PermissionRow {
  key: Capability
  label: string
  note?: string
  admin: boolean
  roles: ProjectMemberRole[]
  // Policy SQL qui fait foi. Renseignée pour que la vérification
  // automatique sache où regarder, et pour qu'un lecteur humain puisse
  // remonter à la règle réelle sans fouiller quinze migrations.
  policy?: string
}

export const RBAC_MATRIX: PermissionRow[] = [
  { key: 'projets.view', label: 'Voir les projets dont on est membre', admin: true, roles: ALL, policy: 'is_project_member()' },
  { key: 'projets.update', label: 'Modifier un projet', admin: true, roles: ['chef_projet', 'referent_mairie'] },
  { key: 'phases.manage', label: 'Gérer les phases', admin: true, roles: ['chef_projet', 'referent_mairie'] },
  { key: 'taches.manage', label: 'Créer et modifier les tâches', admin: true, roles: CONTRIBUTORS },
  { key: 'taches.reopen_terminee', label: 'Rouvrir une tâche terminée', note: 'Double confirmation + journal d’audit', admin: true, roles: [], policy: '0005' },
  { key: 'budget.view', label: 'Voir le budget', admin: true, roles: ALL },
  { key: 'budget.manage', label: 'Gérer les lignes budgétaires', admin: true, roles: ['chef_projet', 'referent_mairie', 'resp_financier'] },
  // Corrigé : la matrice annonçait « tous les rôles ». Le rôle de
  // consultation ne dépose pas — c'est ce qui en fait un rôle de
  // consultation.
  { key: 'documents.upload', label: 'Déposer des documents', admin: true, roles: CONTRIBUTORS, policy: 'can_upload_document() — 0029' },
  // Corrigé : aucun rôle PROJET ne donne ce droit. Il vient de
  // l'appartenance à l'organisation sollicitée. Le chef de projet en a
  // été écarté par la 0036 — il est le plus souvent le déposant, et se
  // valider soi-même viderait le circuit de son sens.
  {
    key: 'validations.decide', label: 'Décider d’une validation (devis)',
    note: 'Membre de l’organisation sollicitée — indépendant du rôle projet. Recours administrateur motivé et tracé.',
    admin: true, roles: [], policy: '"Decide validation" — 0036',
  },
  { key: 'indicateurs.manage', label: 'Gérer les indicateurs d’impact', admin: true, roles: ['chef_projet', 'referent_mairie', 'resp_financier'] },
  { key: 'mesures.add', label: 'Saisir une mesure d’impact', admin: true, roles: ALL, policy: '"Add measure" — 0006' },
  { key: 'copil.manage', label: 'Gérer les réunions COPIL', admin: true, roles: ['chef_projet', 'referent_mairie'] },
  { key: 'decisions.manage', label: 'Gérer les décisions', note: 'Le responsable d’une décision peut aussi la mettre à jour', admin: true, roles: ['chef_projet', 'referent_mairie'] },
  { key: 'audit.view', label: 'Consulter le journal d’audit', note: 'Lecture seule, y compris pour le rôle Lecteur', admin: true, roles: ALL, policy: '"See audit" — 0001' },
  { key: 'users.manage', label: 'Gérer les utilisateurs et invitations', admin: true, roles: [] },
  { key: 'orgs.create', label: 'Créer une organisation', admin: true, roles: [] },
]

const BY_KEY = new Map(RBAC_MATRIX.map(r => [r.key, r]))

// ------------------------------------------------------------
// Le point d'entrée de l'application
// ------------------------------------------------------------
// L'interface pose désormais ses questions ici, au lieu de recopier des
// tableaux de rôles à chaque écran. Une divergence entre ce qu'on
// affiche et ce qu'on autorise devient impossible par construction —
// il ne reste qu'une seule liste à tenir juste.
//
// Ce n'est PAS un contrôle de sécurité : la RLS l'est. C'est ce qui
// décide d'afficher ou non un bouton. Proposer une action que le
// serveur refusera est un défaut d'interface ; l'inverse serait une
// faille, et c'est le SQL qui l'empêche.
export function can(role: string | null | undefined, capability: Capability): boolean {
  if (!role) return false
  const row = BY_KEY.get(capability)
  if (!row) return false
  return row.roles.includes(role as ProjectMemberRole)
}
