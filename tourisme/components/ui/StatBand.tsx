import { useTranslations } from 'next-intl'
import type { Parcours } from '@/lib/types'
import { formatDuree, formatKm } from '@/lib/geo'
import MesureBand, { type Mesure } from './MesureBand'

/** Les mesures d'un parcours, dans la bande commune (MesureBand). */
export default function StatBand({ parcours, locale }: { parcours: Parcours; locale: string }) {
  const t = useTranslations('commun')
  const td = useTranslations('commun.difficulte')

  const mesures: Mesure[] = [
    { v: formatKm(parcours.distance_m, locale), l: t('distance'), mesure: true },
  ]
  if (parcours.denivele_pos_m != null)
    mesures.push({ v: `+${parcours.denivele_pos_m} m`, l: t('denivelePos'), mesure: true })
  if (parcours.denivele_neg_m != null && parcours.denivele_neg_m !== parcours.denivele_pos_m)
    mesures.push({ v: `−${parcours.denivele_neg_m} m`, l: t('deniveleNeg'), mesure: true })
  mesures.push({
    v: formatDuree(parcours.duree_min_minutes, parcours.duree_max_minutes, locale),
    l: t('duree'),
    mesure: true,
  })
  mesures.push({ v: td(parcours.difficulte), l: t('niveau'), accent: true })

  return <MesureBand mesures={mesures} />
}
