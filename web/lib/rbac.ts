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
// Cinq rôles attribuables. « validateur » et « lecteur » ont été
// retirés (migration 0038, arbitrage du 26/07) :
//
//   · « validateur » ne validait plus rien depuis la 0036. Décider
//     revient au membre de l'organisation sollicitée — un mécanisme
//     d'appartenance, pas un rôle projet. Le libellé promettait un
//     pouvoir que le code avait retiré ;
//   · « lecteur » n'avait pas de raison d'être : un compte qui ne sert
//     qu'à regarder duplique deux choses qui existent déjà mieux, le
//     rapport d'expert IA et la page vitrine publique (0021). Créer un
//     compte, gérer son mot de passe et son cycle de vie pour un
//     spectateur, c'est du coût sans contrepartie.
//
// « auditeur » subsiste et devient le seul rôle de consultation, parce
// qu'il a une mission que ni un rapport ni une vitrine ne remplissent :
// contrôler. Il lui faut le journal d'audit, qui ne se transmet pas.
export const ASSIGNABLE_ROLES: ProjectMemberRole[] = [
  'chef_projet', 'referent_mairie', 'resp_financier', 'contributeur', 'auditeur',
]

// Conservés pour l'affichage des données antérieures à la 0038. Un
// enum PostgreSQL ne perd pas ses valeurs : elles ne sont plus
// proposées à la saisie, mais restent lisibles si une ligne y échappe.
export const LEGACY_ROLES: ProjectMemberRole[] = ['validateur', 'lecteur']

const ALL: ProjectMemberRole[] = [...ASSIGNABLE_ROLES, ...LEGACY_ROLES]

// Tout sauf la consultation. Nommé plutôt que recopié : c'est
// l'énumération qui divergeait le plus souvent d'un fichier à l'autre.
const CONTRIBUTORS: ProjectMemberRole[] = ['chef_projet', 'referent_mairie', 'resp_financier', 'contributeur']

export const ROLE_COLUMNS: { key: ProjectMemberRole; label: string }[] = [
  { key: 'chef_projet', label: 'Responsable projet · PM' },
  { key: 'referent_mairie', label: 'Référent Mairie' },
  { key: 'resp_financier', label: 'Resp. financier' },
  { key: 'contributeur', label: 'Contributeur · Terrain' },
  { key: 'auditeur', label: 'Auditeur' },
]

// ------------------------------------------------------------
// Les capacités
// ------------------------------------------------------------
export type Capability =
  | 'projets.view' | 'projets.update'
  | 'phases.manage' | 'taches.manage' | 'taches.reopen_terminee'
  | 'membres.manage' | 'membres.manage_auditeur'
  | 'budget.view' | 'budget.manage'
  | 'documents.upload' | 'validations.decide'
  | 'indicateurs.manage' | 'mesures.add'
  | 'copil.manage' | 'decisions.manage'
  | 'audit.view' | 'rapports.generate' | 'users.manage' | 'orgs.create'

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
  // Séparé de `phases.manage` le 27/07. La même autorisation servait à
  // créer une phase et à décider QUI a accès au projet : deux pouvoirs
  // de nature différente, confondus par commodité.
  {
    key: 'membres.manage', label: 'Gérer les membres du projet',
    note: 'Rôles opérationnels seulement — le siège d’auditeur est réservé à l’administrateur.',
    admin: true, roles: ['chef_projet', 'referent_mairie'],
  },
  // La règle qui donne son sens à la précédente : le contrôlé ne
  // choisit pas son contrôleur. Un chef de projet pouvait retirer les
  // auditeurs de son propre projet — le contrôle sautait sans que
  // personne ne l'apprenne autrement qu'au journal. Symétrique de la
  // 0038, qui interdit à l'auditeur de saisir les chiffres qu'il
  // contrôle. Aucun rôle projet ne l'accorde : il vient du rôle
  // plateforme, et de lui seul.
  {
    key: 'membres.manage_auditeur', label: 'Nommer ou retirer un auditeur',
    note: 'Administrateur plateforme uniquement — le contrôlé ne choisit pas son contrôleur.',
    admin: true, roles: [], policy: '"Auditor seat" — 0047',
  },
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
  // Resserré en 0038 : la policy de la 0006 admettait tout membre du
  // projet, donc l'auditeur. Quelqu'un dont la mission est de contrôler
  // les chiffres ne doit pas pouvoir en saisir.
  { key: 'mesures.add', label: 'Saisir une mesure d’impact', admin: true, roles: CONTRIBUTORS, policy: '"Add measure" — 0038' },
  { key: 'copil.manage', label: 'Gérer les réunions COPIL', admin: true, roles: ['chef_projet', 'referent_mairie'] },
  { key: 'decisions.manage', label: 'Gérer les décisions', note: 'Le responsable d’une décision peut aussi la mettre à jour', admin: true, roles: ['chef_projet', 'referent_mairie'] },
  // La raison d'être du rôle Auditeur : le journal ne se transmet pas
  // dans un rapport, il se consulte.
  { key: 'audit.view', label: 'Consulter le journal d’audit', note: 'Lecture seule — c’est ce qui distingue l’auditeur d’un destinataire de rapport', admin: true, roles: ALL, policy: '"See audit" — 0001' },
  // Lire un rapport suit la visibilité ; le GÉNÉRER est une action — elle
  // consomme la clé du fournisseur d'IA et s'inscrit à l'historique du
  // projet. Un droit de regard qui engage une dépense n'en est plus un.
  { key: 'rapports.generate', label: 'Générer un rapport d’expert IA', note: 'La lecture des rapports existants suit le simple droit de regard', admin: true, roles: CONTRIBUTORS, policy: '"Create ai reports" — 0039' },
  // Ce n'est plus « administrateurs seulement » (0065). Une CAPACITÉ
  // cochée sur le profil l'ouvre aussi — comme l'arbitrage de la
  // roadmap l'est depuis la 0037 — parce que le seul moyen de
  // l'accorder était de donner le rôle « admin », c'est-à-dire la
  // configuration, le stockage, la vision de tous les projets et
  // l'anonymisation par-dessus le marché.
  //
  // `roles: []` reste JUSTE, et ce n'est pas un raccourci : aucun rôle
  // PROJET n'ouvre la gestion des comptes, et aucun ne doit l'ouvrir —
  // un chef de projet qui créerait des comptes se donnerait ses propres
  // collègues. La capacité vit sur le profil, pas dans le projet ; la
  // colonne « Administrateur » de l'écran Accès & rôles ne la montrerait
  // pas, le `note` le dit donc en toutes lettres.
  {
    key: 'users.manage', label: 'Gérer les utilisateurs et invitations',
    note: 'Administrateur, ou capacité « Gestion des comptes » cochée sur le profil — celle-ci n’accorde ni le rôle Administrateur, ni l’attribution des capacités, ni l’anonymisation.',
    admin: true, roles: [], policy: '"Manage user accounts" — 0065',
  },
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
// Les rôles porteurs d'une capacité — pour les requêtes qui doivent
// filtrer côté base (« qui prévenir », « qui peut décider »). Sans elle,
// chaque appelant recopiait sa liste, et c'est ainsi qu'on s'est
// retrouvé avec cinq exemplaires de la même règle.
// Le siège d'auditeur se teste ici, pas ailleurs. Écrire `role ===
// 'auditeur'` dans un écran ou une action, c'est recréer la copie que
// ce module existe pour supprimer — et le garde-fou le refuse.
export const AUDITOR_ROLE: ProjectMemberRole = 'auditeur'
export const isAuditorSeat = (role: string | null | undefined): boolean => role === AUDITOR_ROLE
// Rôles proposables à qui n'a pas le droit de nommer un auditeur (0047).
export function assignableRolesFor(canAuditor: boolean): ProjectMemberRole[] {
  return canAuditor ? [...ASSIGNABLE_ROLES] : ASSIGNABLE_ROLES.filter(r => !isAuditorSeat(r))
}

export function rolesWith(capability: Capability): string[] {
  return [...(BY_KEY.get(capability)?.roles ?? [])]
}

export function can(role: string | null | undefined, capability: Capability): boolean {
  if (!role) return false
  const row = BY_KEY.get(capability)
  if (!row) return false
  return row.roles.includes(role as ProjectMemberRole)
}
