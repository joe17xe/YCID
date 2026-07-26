// ============================================================
// PR 39 — Prévu / engagé / réalisé
// ============================================================
// Formules reprises de docs/spec-phase1-mvp.md §10.3, spécifiées dès le
// départ et jamais implémentées :
//   engagé            = Σ devis validés
//   payé              = Σ reçus et factures marqués payés
//   reste à engager   = prévu − engagé
//   reste à payer     = engagé − payé
//
// Ce module est partagé par l'écran projet et le rapport IA : deux
// implémentations parallèles des mêmes règles finiraient par diverger,
// et l'écart entre un chiffre affiché et le même chiffre commenté par
// l'IA serait le pire des défauts pour un document destiné à un
// financeur.

export interface DocLike {
  type: string
  amount: number | null
  paid: boolean
  validations?: { decision: string }[]
}

export interface Financials {
  planned: number
  engaged: number
  paid: number
  remainingToCommit: number
  remainingToPay: number
}

// UNANIMITÉ (arbitrage YCID du 25/07). Un devis n'est engagé que si
// CHAQUE organisation sollicitée l'a validé ; un seul refus rejette.
//
// La règle initiale se contentait d'une validation, au motif qu'exiger
// l'unanimité bloquerait le suivi sur une organisation qui ne répond
// pas. Objection retournée par le Product Owner : c'est précisément ce
// qu'on veut. Un engagement financier sur lequel un cofinanceur ne s'est
// pas prononcé n'est pas un engagement — l'afficher comme tel donnerait
// une fausse assurance sur de l'argent public.
//
// Le blocage est donc assumé, à une condition : que l'organisation
// silencieuse SACHE qu'on l'attend. C'est l'objet des notifications
// livrées avec cette règle — les deux sont indissociables.
export function isEngagedDoc(d: DocLike): boolean {
  if (d.type !== 'devis') return false
  const v = d.validations ?? []
  // Un devis sans aucune validation n'est pas engagé : il n'a été
  // soumis à personne. `every` sur un tableau vide vaut true, d'où ce
  // garde-fou — sans lui, une soumission ratée compterait comme un
  // accord général.
  if (!v.length) return false
  if (v.some(x => x.decision === 'refuse')) return false
  return v.every(x => x.decision === 'valide')
}

// Ce qui manque pour qu'un devis soit engagé. Sert à l'écran : « en
// attente de 2 organisations sur 3 » se lit, « pas engagé » ne se lit
// pas.
export function pendingOrgCount(d: DocLike): number {
  return (d.validations ?? []).filter(x => x.decision === 'en_attente').length
}

// Un devis n'est pas un paiement, même coché payé par erreur : seules
// les pièces d'exécution alimentent le réalisé.
export function isPaidDoc(d: DocLike): boolean {
  return d.paid && d.type !== 'devis'
}

export function financialsFor(planned: number, docs: DocLike[]): Financials {
  const engaged = docs.filter(isEngagedDoc).reduce((s, d) => s + (d.amount ?? 0), 0)
  const paid = docs.filter(isPaidDoc).reduce((s, d) => s + (d.amount ?? 0), 0)
  return {
    planned,
    engaged,
    paid,
    remainingToCommit: planned - engaged,
    // Le reste à payer se mesure sur l'ENGAGÉ, pas sur le prévu : on ne
    // doit que ce qu'on a effectivement commandé.
    remainingToPay: engaged - paid,
  }
}

export function sumFinancials(list: Financials[]): Financials {
  return list.reduce<Financials>((a, f) => ({
    planned: a.planned + f.planned,
    engaged: a.engaged + f.engaged,
    paid: a.paid + f.paid,
    remainingToCommit: a.remainingToCommit + f.remainingToCommit,
    remainingToPay: a.remainingToPay + f.remainingToPay,
  }), { planned: 0, engaged: 0, paid: 0, remainingToCommit: 0, remainingToPay: 0 })
}

// Écart signé entre deux montants, en valeur et en pourcentage. Un
// projet SOUS-consommé est une information de pilotage au même titre
// qu'un dépassement : d'où le signe conservé, et jamais une valeur
// absolue.
export function gap(actual: number, reference: number): { value: number; percent: number | null } {
  const value = actual - reference
  return { value, percent: reference === 0 ? null : (value / reference) * 100 }
}

export const fmtEur = (n: number | null | undefined) =>
  n == null ? '—' : `${Math.round(n).toLocaleString('fr-FR')} €`

export const fmtSignedEur = (n: number) =>
  `${n > 0 ? '+' : ''}${Math.round(n).toLocaleString('fr-FR')} €`
