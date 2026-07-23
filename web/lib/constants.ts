// Design tokens (identiques au prototype)
export const C = {
  bg: '#F5F6F4',
  surface: '#FFFFFF',
  ink: '#17211D',
  muted: '#66716B',
  border: '#E3E6E2',
  accent: '#0E6B5C',
  accentSoft: '#E4F0EC',
  warn: '#B4690E',
  warnSoft: '#F7EDDD',
  danger: '#A3342C',
  dangerSoft: '#F6E7E5',
  blue: '#3B5488',
  blueSoft: '#E8ECF5',
  purple: '#6B4A8C',
  purpleSoft: '#F0E9F5',
}

export const ORG_TYPES: Record<string, string> = {
  association: 'Association',
  collectivite: 'Collectivité',
  partenaire_local: 'Partenaire local',
  partenaire_medical: 'Partenaire médical',
  financeur: 'Financeur',
  financeur_public: 'Financeur public',
  mecene: 'Mécène',
  autre: 'Autre',
}

export const PROJECT_ROLES: Record<string, { label: string; bg: string; fg: string }> = {
  porteur: { label: 'Porteur', bg: '#E4F0EC', fg: '#0E6B5C' },
  partenaire: { label: 'Partenaire', bg: '#E8ECF5', fg: '#3B5488' },
  financeur: { label: 'Financeur', bg: '#F0E9F5', fg: '#6B4A8C' },
  beneficiaire: { label: 'Bénéficiaire', bg: '#FBEFE6', fg: '#B4690E' },
  observateur: { label: 'Observateur', bg: '#EEF0EE', fg: '#66716B' },
  partenaire_terrain: { label: 'Partenaire terrain', bg: '#F5EFE2', fg: '#8A6A1F' },
  partenaire_medical: { label: 'Partenaire médical', bg: '#E7F1F4', fg: '#2C6B7E' },
}

export const ACCESS_ROLES: Record<string, { label: string; short: string; fg: string; bg: string }> = {
  chef_projet: { label: 'Chef de projet · Comité', short: 'Comité', fg: '#0E6B5C', bg: '#E4F0EC' },
  resp_financier: { label: 'Responsable financier', short: 'Finances', fg: '#3B5488', bg: '#E8ECF5' },
  contributeur: { label: 'Contributeur · Terrain', short: 'Terrain', fg: '#8A6A1F', bg: '#F5EFE2' },
  validateur: { label: 'Validateur / Financeur', short: 'Validateur', fg: '#6B4A8C', bg: '#F0E9F5' },
  auditeur: { label: 'Auditeur', short: 'Auditeur', fg: '#2C6B7E', bg: '#E7F1F4' },
  lecteur: { label: 'Lecteur', short: 'Lecteur', fg: '#66716B', bg: '#EEF0EE' },
}

export const PROJECT_STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  en_preparation: { label: 'En préparation', fg: '#66716B', bg: '#EEF0EE' },
  en_cours: { label: 'En cours', fg: '#0E6B5C', bg: '#E4F0EC' },
  suspendu: { label: 'Suspendu', fg: '#B4690E', bg: '#F7EDDD' },
  termine: { label: 'Terminé', fg: '#3B5488', bg: '#E8ECF5' },
}

export const TASK_STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  a_faire: { label: 'À faire', fg: '#66716B', bg: '#EEF0EE' },
  en_cours: { label: 'En cours', fg: '#0E6B5C', bg: '#E4F0EC' },
  terminee: { label: 'Terminée', fg: '#3B5488', bg: '#E8ECF5' },
  bloquee: { label: 'Bloquée', fg: '#A3342C', bg: '#F6E7E5' },
}

export const REVIEW_STATES: Record<string, { label: string; fg: string; bg: string }> = {
  brouillon: { label: 'Brouillon', fg: '#66716B', bg: '#EEF0EE' },
  soumis: { label: 'Soumis', fg: '#B4690E', bg: '#F7EDDD' },
  en_revue: { label: 'En revue', fg: '#3B5488', bg: '#E8ECF5' },
  valide: { label: 'Validé', fg: '#0E6B5C', bg: '#E4F0EC' },
  rejete: { label: 'Rejeté', fg: '#A3342C', bg: '#F6E7E5' },
}

export const LINE_STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  prevue: { label: 'Prévue', fg: '#66716B', bg: '#EEF0EE' },
  active: { label: 'Active', fg: '#0E6B5C', bg: '#E4F0EC' },
  cloturee: { label: 'Clôturée', fg: '#3B5488', bg: '#E8ECF5' },
}

export const LINE_CATEGORIES: Record<string, { label: string; fg: string; bg: string }> = {
  investissement: { label: 'Investissement', fg: '#3B5488', bg: '#E8ECF5' },
  fonctionnement: { label: 'Fonctionnement', fg: '#8A6A1F', bg: '#F5EFE2' },
  projet: { label: 'Projet', fg: '#0E6B5C', bg: '#E4F0EC' },
  autre: { label: 'Autre', fg: '#66716B', bg: '#EEF0EE' },
}

export const IND_KINDS: Record<string, { label: string; fg: string; bg: string }> = {
  quantitatif: { label: 'Quantitatif', fg: '#3B5488', bg: '#E8ECF5' },
  qualitatif: { label: 'Qualitatif', fg: '#6B4A8C', bg: '#F0E9F5' },
}

export const DECISION_STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  a_faire: { label: 'À faire', fg: '#66716B', bg: '#EEF0EE' },
  en_cours: { label: 'En cours', fg: '#B4690E', bg: '#F7EDDD' },
  fait: { label: 'Fait', fg: '#0E6B5C', bg: '#E4F0EC' },
}

export const MEETING_KINDS: Record<string, { label: string; fg: string; bg: string }> = {
  copil: { label: 'COPIL', fg: '#0E6B5C', bg: '#E4F0EC' },
  technique: { label: 'Comité technique', fg: '#3B5488', bg: '#E8ECF5' },
  terrain: { label: 'Réunion terrain', fg: '#8A6A1F', bg: '#F5EFE2' },
}

export const DOC_TYPES: Record<string, { label: string; hasAmount: boolean; payable?: boolean }> = {
  devis: { label: 'Devis', hasAmount: true },
  facture: { label: 'Facture', hasAmount: true, payable: true },
  recu: { label: 'Reçu', hasAmount: true },
  justificatif: { label: 'Justificatif', hasAmount: false },
  convention: { label: 'Convention', hasAmount: false },
  note: { label: 'Note', hasAmount: false },
  etude: { label: 'Étude', hasAmount: false },
  photo: { label: 'Photo', hasAmount: false },
  livrable: { label: 'Livrable', hasAmount: false },
  rapport: { label: 'Rapport', hasAmount: false },
}

export function fmtEur(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const IDEA_STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  idee: { label: 'Idée', fg: '#66716B', bg: '#EEF0EE' },
  acceptee: { label: 'Acceptée', fg: '#6B4A8C', bg: '#F0E9F5' },
  en_cours: { label: 'En cours', fg: '#3B5488', bg: '#E8ECF5' },
  livree: { label: 'Livrée', fg: '#0E6B5C', bg: '#E4F0EC' },
  refusee: { label: 'Refusée', fg: '#A3342C', bg: '#F6E7E5' },
}

export const IDEA_PRIORITY: Record<string, { label: string; fg: string; bg: string }> = {
  basse: { label: 'Priorité basse', fg: '#66716B', bg: '#EEF0EE' },
  moyenne: { label: 'Priorité moyenne', fg: '#6B4A8C', bg: '#F0E9F5' },
  haute: { label: 'Priorité haute', fg: '#B4690E', bg: '#F7EDDD' },
}
