import { useTranslations } from 'next-intl'
import type { Parcours } from '@/lib/types'
import { formatDuree, formatKm } from '@/lib/geo'

export function BadgeDifficulte({ difficulte }: { difficulte: Parcours['difficulte'] }) {
  const t = useTranslations('commun.difficulte')
  const cls = { facile: 'badge-facile', modere: 'badge-modere', difficile: 'badge-difficile' }[difficulte]
  return <span className={`chip ${cls}`}>{t(difficulte)}</span>
}

export function BadgeType({ type }: { type: Parcours['type'] }) {
  const t = useTranslations('commun.type')
  return <span className="chip">{t(type)}</span>
}

/** La rangée des chiffres clés — la décision en dix secondes. */
export function StatsRow({ parcours, locale }: { parcours: Parcours; locale: string }) {
  const t = useTranslations('commun')
  const td = useTranslations('commun.difficulte')
  const stats: { v: string; l: string; accent?: boolean }[] = [
    { v: formatKm(parcours.distance_m, locale), l: t('distance') },
  ]
  if (parcours.denivele_pos_m != null)
    stats.push({ v: `+${parcours.denivele_pos_m} m`, l: t('denivelePos') })
  if (parcours.denivele_neg_m != null && parcours.denivele_neg_m !== parcours.denivele_pos_m)
    stats.push({ v: `−${parcours.denivele_neg_m} m`, l: t('deniveleNeg') })
  stats.push({
    v: formatDuree(parcours.duree_min_minutes, parcours.duree_max_minutes, locale),
    l: t('duree'),
  })
  stats.push({ v: td(parcours.difficulte), l: t('niveau'), accent: true })
  return (
    <div className="flex gap-2">
      {stats.map((s, i) => (
        <div
          key={i}
          className={
            'flex-1 rounded-xl border px-1 py-2 text-center ' +
            (s.accent
              ? 'border-[var(--ocre-bord)] bg-[var(--ocre-pale)]'
              : 'border-[var(--ligne)] bg-[var(--surface)]')
          }
        >
          <div
            className={'mono text-[14px] font-bold leading-tight ' + (s.accent ? 'text-[var(--ocre)]' : '')}
          >
            {s.v}
          </div>
          <div className={'text-[10.5px] ' + (s.accent ? 'text-[var(--ocre)]' : 'text-[var(--encre-2)]')}>
            {s.l}
          </div>
        </div>
      ))}
    </div>
  )
}
