import { useTranslations } from 'next-intl'
import type { Parcours } from '@/lib/types'
import { formatDuree, formatKm } from '@/lib/geo'

/** Les chiffres clés en BANDE à filets, pas en tuiles encadrées :
 *  le registre du carnet de terrain plutôt que celui du tableau de bord.
 *  Mesures en chiffres tabulaires, libellés en petites capitales. */
export default function StatBand({ parcours, locale }: { parcours: Parcours; locale: string }) {
  const t = useTranslations('commun')
  const td = useTranslations('commun.difficulte')

  const mesures: { v: string; l: string; accent?: boolean }[] = [
    { v: formatKm(parcours.distance_m, locale), l: t('distance') },
  ]
  if (parcours.denivele_pos_m != null)
    mesures.push({ v: `+${parcours.denivele_pos_m} m`, l: t('denivelePos') })
  if (parcours.denivele_neg_m != null && parcours.denivele_neg_m !== parcours.denivele_pos_m)
    mesures.push({ v: `−${parcours.denivele_neg_m} m`, l: t('deniveleNeg') })
  mesures.push({
    v: formatDuree(parcours.duree_min_minutes, parcours.duree_max_minutes, locale),
    l: t('duree'),
  })
  mesures.push({ v: td(parcours.difficulte), l: t('niveau'), accent: true })

  return (
    <dl className="flex items-stretch border-y border-[var(--ligne)] py-[var(--s2)]">
      {mesures.map((m, i) => (
        <div
          key={m.l}
          className={
            'min-w-0 flex-1 px-1 text-center ' +
            (i > 0 ? 'border-s border-[var(--ligne)]' : '')
          }
        >
          {/* Les mesures s'enroulent plutôt que de pousser la page :
              à 320 px, « 2 h 30 – 3 h » passe sur deux lignes. */}
          <dd
            className={
              'mono text-[13.5px] font-semibold leading-[1.25] [overflow-wrap:anywhere] sm:text-[15px] ' +
              (m.accent ? 'text-[var(--ocre)]' : 'text-[var(--encre)]')
            }
          >
            {m.v}
          </dd>
          <dt className="mt-1 text-[10px] uppercase leading-tight tracking-[0.06em] text-[var(--encre-3)] sm:text-[10.5px]">
            {m.l}
          </dt>
        </div>
      ))}
    </dl>
  )
}
