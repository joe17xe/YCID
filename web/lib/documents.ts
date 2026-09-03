// ============================================================
// PR 38a — Constantes et chemins des pièces jointes
// ============================================================
// Séparé de `document-actions.ts` : un fichier « use server » ne peut
// exporter que des fonctions async, or ces valeurs sont lues côté client
// (sélecteur de type, construction du chemin avant l'envoi au Storage).

export const DOC_TYPES = ['devis', 'facture', 'recu', 'justificatif', 'convention', 'note', 'etude', 'photo', 'livrable', 'rapport'] as const
export type DocType = (typeof DOC_TYPES)[number]

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  devis: 'Devis', facture: 'Facture', recu: 'Reçu', justificatif: 'Justificatif',
  convention: 'Convention', note: 'Note', etude: 'Étude', photo: 'Photo',
  livrable: 'Livrable', rapport: 'Rapport',
}

// 10 Mo : au-delà, un scan de facture relève du mauvais réglage plutôt
// que du besoin réel, et le dépôt échouerait plus loin sans message clair.
export const MAX_DOC_SIZE = 10 * 1024 * 1024

// Natures PORTEUSES D'ARGENT : elles n'ont de sens que sur une ligne
// budgétaire, seul endroit où un montant se rattache à un prévisionnel
// et où le circuit de validation s'affiche. Déposées sur une tâche,
// elles produisaient un devis muet — validé dans le vide, jamais compté
// dans « engagé » faute de ligne à créditer.
export const BUDGET_DOC_TYPES: DocType[] = ['devis', 'facture', 'recu', 'justificatif']

// Les trois natures qui portent de l'argent, et l'invariant du modèle :
// elles EXIGENT une ligne budgétaire et un montant, quel que soit
// l'écran depuis lequel on les dépose. La 0070 grave la même règle en
// base (contrainte `documents_argent_sur_ligne`) — ici pour la dire aux
// formulaires, là-bas pour qu'aucun chemin ne puisse s'en dispenser.
//
// Le montant n'est pas un ornement : `engaged` est la somme des
// montants des devis validés (lib/budget.ts). Un devis sans montant se
// fait valider normalement et engage zéro euro, en silence.
export const MONEY_DOC_TYPES: DocType[] = ['devis', 'facture', 'recu']

export const isMoneyDoc = (t: DocType) => MONEY_DOC_TYPES.includes(t)

// Natures admises sur une tâche : la preuve de ce qui a été fait.
export const TASK_DOC_TYPES: DocType[] = ['justificatif', 'photo', 'livrable', 'note', 'etude', 'rapport', 'convention']

// Natures proposées dans l'onglet Documents — LA SECONDE PORTE (0070).
// D'abord les pièces qui portent sur le projet entier (la convention de
// financement n'a pas d'autre point de dépôt), puis les natures
// d'argent, qui n'y sont admises qu'en désignant leur ligne. Le devis
// n'y figurait pas : la règle « un devis vit sur une ligne » se
// confondait alors avec « un devis se dépose depuis l'onglet Budget »,
// et l'écran n'expliquait ni l'une ni l'autre.
export const PROJECT_DOC_TYPES: DocType[] = [
  'convention', 'rapport', 'etude', 'note', 'justificatif',
  ...MONEY_DOC_TYPES,
]

// Moment d'une photo de terrain (PR 38c). Une photo de chantier ne vaut
// que rapprochée de son état initial : sans cette qualification, une
// galerie de vingt photos ne raconte rien.
export const DOC_MOMENTS = ['avant', 'pendant', 'apres'] as const
export type DocMoment = (typeof DOC_MOMENTS)[number]

export const DOC_MOMENT_LABELS: Record<DocMoment, string> = {
  avant: 'Avant', pendant: 'Pendant', apres: 'Après',
}

// Les vignettes se chargent parfois bien après le rendu (défilement,
// chargement différé) : un jeton de 5 minutes comme pour les
// téléchargements laisserait des images cassées en bas de page.
export const GALLERY_URL_TTL = 3600

// Chemin de stockage : projets/<project_id>/<phase_id|_>/<uuid>-<nom>.
// Les policies Storage lisent le project_id à cet emplacement EXACT
// (migration 0029) — ne pas changer la forme sans les reprendre.
export function buildStoragePath(projectId: string, phaseId: string | null, filename: string): string {
  const safe = filename.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
  return `projets/${projectId}/${phaseId || '_'}/${crypto.randomUUID()}-${safe}`
}
