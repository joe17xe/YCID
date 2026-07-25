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

// Natures admises sur une tâche : la preuve de ce qui a été fait.
export const TASK_DOC_TYPES: DocType[] = ['justificatif', 'photo', 'livrable', 'note', 'etude', 'rapport', 'convention']

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
