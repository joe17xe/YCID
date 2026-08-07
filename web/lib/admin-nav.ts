// ============================================================
// La section Administration se déplie ENTRÉE PAR ENTRÉE
// ============================================================
// Jusqu'ici un unique drapeau `showAdmin`, calculé dans
// `app/(app)/layout.tsx`, affichait ou masquait le bloc entier. Tant que
// la seule question était « administre-t-on l'outil ? », un booléen
// suffisait.
//
// La capacité « gestion des comptes » (0065) casse cette hypothèse : son
// porteur doit voir Utilisateurs, et rien d'autre. Lui ouvrir le bloc
// lui donnerait Configuration (clés d'IA, SMTP, marque, mentions
// légales), Stockage et Accès & rôles, que personne n'a demandés — et
// qu'il ne peut de toute façon pas ouvrir, chacune de ces pages
// redirigeant sur `isUserAdmin`. Trois entrées de menu qui renvoient au
// tableau de bord, c'est exactement le « bouton mort » que le dépôt
// refuse : l'utilisateur y lit un droit qu'il n'a pas, puis une panne.
//
// La visibilité devient donc une LISTE DE CLÉS, calculée côté serveur et
// transmise à la barre latérale comme au tiroir mobile. Ce module ne
// dépend d'aucun composant : il est importable depuis un composant
// serveur (le layout) autant que depuis un composant client (la
// Sidebar), ce qui est précisément la raison pour laquelle il n'habite
// pas dans `Sidebar.tsx` — un module « use client » ne s'appelle pas
// depuis le serveur.
//
// RÈGLE À TENIR : chaque clé listée ici doit correspondre à un écran
// que son porteur peut réellement ouvrir. Ajouter une entrée sans
// ajuster le contrôle d'accès de la page recrée le bouton mort dans
// l'autre sens.

export type AdminNavKey = 'users' | 'programmes' | 'access' | 'storage' | 'configuration'

// L'ordre d'affichage, et la seule énumération complète des clés.
// `Record<AdminNavKey, …>` plus bas oblige le compilateur à signaler
// toute clé ajoutée au type et oubliée ici.
export const ADMIN_NAV_KEYS: AdminNavKey[] = ['users', 'programmes', 'access', 'storage', 'configuration']

// Le chemin de chaque écran. Vit ici plutôt que dans la Sidebar pour que
// la liste des clés et celle des URL ne puissent pas diverger.
export const ADMIN_NAV_HREFS: Record<AdminNavKey, string> = {
  users: '/admin/utilisateurs',
  // Programmes (0055) : le niveau au-dessus des projets — création et
  // désignation des directeurs. Écran réservé aux administrateurs.
  programmes: '/admin/programmes',
  access: '/admin/acces',
  storage: '/admin/stockage',
  configuration: '/admin/configuration',
}

export interface AdminAccess {
  // Administre l'OUTIL : platform_role = 'admin' (0037).
  isAdmin: boolean
  // Capacité cochée sur le profil (0065). Vraie aussi pour un
  // administrateur — `canManageUsers` l'inclut — d'où l'ordre des tests
  // ci-dessous.
  canManageUsers: boolean
}

// Les entrées visibles, dans l'ordre. Une liste vide = pas de section
// Administration du tout, ce qui reste le cas de l'immense majorité des
// comptes.
export function adminNavKeysFor(access: AdminAccess): AdminNavKey[] {
  if (access.isAdmin) return [...ADMIN_NAV_KEYS]
  // La capacité n'ouvre QUE la console des comptes. « Accès & rôles »
  // n'y figure pas volontairement : cet écran décrit la matrice des
  // droits de toute la plateforme, il relève de l'administration de
  // l'outil et personne ne l'a demandé.
  if (access.canManageUsers) return ['users']
  return []
}
