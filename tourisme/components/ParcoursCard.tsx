import { useTranslations } from 'next-intl'
import type { Parcours } from '@/lib/types'
import { tx } from '@/lib/i18n-text'
import { formatDuree, formatKm } from '@/lib/geo'
import FeaturedCard from './ui/FeaturedCard'

/** Un parcours reste une carte : c'est le contenu prioritaire de l'app.
 *  Mais en traitement éditorial — l'image porte, pas le caisson. */
export default function ParcoursCard({ parcours, locale }: { parcours: Parcours; locale: string }) {
  const t = useTranslations('commun')
  const td = useTranslations('commun.difficulte')
  const tt = useTranslations('commun.type')
  const cls = { facile: 'chip-facile', modere: 'chip-modere', difficile: 'chip-difficile' }[
    parcours.difficulte
  ]
  return (
    <FeaturedCard
      href={`/parcours/${parcours.slug}`}
      image={parcours.photo}
      titre={tx(parcours.nom, locale)}
      accroche={parcours.accroche ? tx(parcours.accroche, locale) : null}
      // Ligne entièrement chiffrée à unités latines : isolée en LTR,
      // sans quoi l'arabe la retourne bloc par bloc.
      meta={
        formatKm(parcours.distance_m, locale) +
        (parcours.denivele_pos_m != null ? ` · +${parcours.denivele_pos_m} m` : '') +
        ' · ' +
        formatDuree(parcours.duree_min_minutes, parcours.duree_max_minutes, locale)
      }
      metaMesure
      chips={
        <>
          <span className={`chip ${cls}`}>{td(parcours.difficulte)}</span>
          <span className="chip chip-photo">{tt(parcours.type)}</span>
        </>
      }
      pied={
        parcours.acces_guide ? (
          <p className="mt-1.5 text-[var(--t-micro)] font-semibold text-[var(--ocre)]">
            {t('accesGuide')}
          </p>
        ) : null
      }
    />
  )
}
