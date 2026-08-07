// ============================================================
// Conservation des données (0064) — la part sans base de données
// ============================================================
// Ce module ne contient QUE du calcul pur : un type et une mise en
// forme. Il existe pour une raison mécanique, et il vaut mieux l'écrire
// que la redécouvrir au prochain build.
//
// `lib/settings.ts` importe `@/lib/supabase/server`, qui lit les cookies
// via `next/headers` : il est SERVEUR UNIQUEMENT. L'écran de
// configuration, lui, formate une durée pendant qu'on la saisit — donc
// dans le navigateur. Importer le formateur depuis `lib/settings.ts`
// entraînait tout le client Supabase serveur dans le paquet client, et
// le build échouait sur `./lib/supabase/server.ts` (« Ecmascript file
// had an error »).
//
// La réponse n'est PAS de recopier la fonction dans l'écran : une durée
// affichée « 13 mois » sur la page publique et « 400 jours » dans
// l'administration serait, à sa petite échelle, exactement le genre de
// divergence que ce dépôt traque partout ailleurs. Une seule
// implémentation, dans un fichier que les deux côtés peuvent importer.

export interface RetentionPolicy {
  category: string
  label: string
  description: string
  retentionDays: number
  enabled: boolean
}

// Une durée en jours, dite comme on la dit à l'oral. « 400 jours » est
// exact et illisible ; « 13 mois » se comprend. On n'arrondit que
// lorsque le résultat tombe juste : 100 jours reste « 100 jours »
// plutôt que de devenir « 3 mois », ce qui serait faux de dix jours sur
// une page qui engage.
export function formatRetentionDays(days: number): string {
  if (days % 365 === 0) {
    const y = days / 365
    return y === 1 ? '1 an' : `${y} ans`
  }
  if (days % 30 === 0) {
    const m = days / 30
    return m === 1 ? '1 mois' : `${m} mois`
  }
  // 400 jours = 13 mois et 10 jours : on ne feint pas la précision.
  return `${days} jours`
}
