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

// Un devis compte comme engagé dès qu'UNE organisation l'a validé, et
// jamais s'il a été refusé (règle posée en PR 38b). Exiger l'unanimité
// bloquerait le suivi sur une organisation qui ne répond pas ; un refus,
// lui, doit primer.
export function isEngagedDoc(d: DocLike): boolean {
  if (d.type !== 'devis') return false
  const v = d.validations ?? []
  if (v.some(x => x.decision === 'refuse')) return false
  return v.some(x => x.decision === 'valide')
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
