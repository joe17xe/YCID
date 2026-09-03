import Link from 'next/link'
import { ChevronRight, Clock, Users } from 'lucide-react'
import { tx } from '@/lib/i18n-text'
import { dureeFormule, participantsFormule, tarifFormule } from '@/lib/formule'
import type { Formule, Locale } from '@/lib/types'

/** La carte du catalogue : ce qu'on propose, combien de temps, pour
 *  combien de personnes, à quel tarif. Rien de plus — la fiche déroule. */
export default function FormuleCard({
  formule,
  locale,
  t,
}: {
  formule: Formule
  locale: Locale
  t: (cle: string, valeurs?: Record<string, string | number>) => string
}) {
  const duree = dureeFormule(formule, locale)
  const gens = participantsFormule(formule, t)
  const tarif = tarifFormule(formule, locale, t)
  return (
    <Link
      href={`/reserver/${formule.slug}`}
      className="card flex flex-col gap-[var(--s2)] p-[var(--s3)]"
    >
      <span className="chip self-start">{t(`categorie.${formule.categorie}`)}</span>
      <span>
        <span className="t-h3 block leading-tight">{tx(formule.nom, locale)}</span>
        {formule.accroche ? (
          <span className="clamp-2 mt-1.5 block text-[var(--t-small)] leading-snug text-[var(--encre-2)]">
            {tx(formule.accroche, locale)}
          </span>
        ) : null}
      </span>
      <span className="mono flex flex-wrap items-center gap-x-[var(--s3)] gap-y-1 text-[12px] text-[var(--encre-3)]">
        {duree ? (
          <span className="flex items-center gap-1.5">
            <Clock size={13} aria-hidden />
            <span className="mesure">{duree}</span>
          </span>
        ) : null}
        {gens ? (
          <span className="flex items-center gap-1.5">
            <Users size={13} aria-hidden />
            {gens}
          </span>
        ) : null}
      </span>
      <span className="mt-auto flex items-end justify-between gap-[var(--s2)] border-t border-[var(--ligne)] pt-[var(--s2)]">
        <span className="min-w-0">
          <span className="eyebrow block">{t('tarif')}</span>
          <span className="mt-0.5 block text-[14px] font-semibold leading-snug">
            {tarif.valeur}
            {tarif.unite ? (
              <span className="ms-1 text-[12px] font-normal text-[var(--encre-3)]">
                {tarif.unite}
              </span>
            ) : null}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-[var(--bisri)]">
          {t('demander')}
          <ChevronRight size={15} className="rtl:-scale-x-100" aria-hidden />
        </span>
      </span>
    </Link>
  )
}
