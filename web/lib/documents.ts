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

// Chemin de stockage : projets/<project_id>/<phase_id|_>/<uuid>-<nom>.
// Les policies Storage lisent le project_id à cet emplacement EXACT
// (migration 0029) — ne pas changer la forme sans les reprendre.
export function buildStoragePath(projectId: string, phaseId: string | null, filename: string): string {
  const safe = filename.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
  return `projets/${projectId}/${phaseId || '_'}/${crypto.randomUUID()}-${safe}`
}
