// Les trois lignes qu'une formule affiche partout — durée, taille du
// groupe, tarif. Écrites une fois ici pour que la carte du catalogue et
// la fiche ne divergent jamais.
import { formatDuree } from './geo'
import type { Formule } from './types'

/** « 1 h 30 » — la durée d'une formule, ou null si elle est sur mesure. */
export function dureeFormule(f: Formule, locale: string): string | null {
  return f.duree_minutes ? formatDuree(f.duree_minutes, null, locale) : null
}

/** « de 2 à 15 », « à partir de 8 », « jusqu'à 12 » — ou rien. */
export function participantsFormule(
  f: Formule,
  t: (cle: string, valeurs?: Record<string, string | number>) => string,
): string | null {
  const { participants_min: min, participants_max: max } = f
  if (min != null && max != null) return t('de', { min, max })
  if (min != null) return t('aPartirDe', { min })
  if (max != null) return t('jusqua', { max })
  return null
}

/** Le tarif tel qu'il doit se lire tant que la municipalité ne l'a pas
 *  tranché : « Communiqué au kiosque ». Jamais un chiffre inventé. */
export function tarifFormule(
  f: Formule,
  locale: string,
  t: (cle: string) => string,
): { valeur: string; unite: string | null } {
  if (f.prix_montant == null) return { valeur: t('tarifADefinir'), unite: null }
  const montant = new Intl.NumberFormat(locale === 'ar' ? 'ar-LB' : locale, {
    style: 'currency',
    currency: f.prix_devise,
    maximumFractionDigits: f.prix_montant % 1 === 0 ? 0 : 2,
  }).format(f.prix_montant)
  return { valeur: montant, unite: t(f.prix_unite === 'groupe' ? 'parGroupe' : 'parPersonne') }
}
