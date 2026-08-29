import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { MountainSnow } from 'lucide-react'
import type { Parcours } from '@/lib/types'
import { tx } from '@/lib/i18n-text'
import { formatDuree, formatKm } from '@/lib/geo'
import { BadgeDifficulte, BadgeType } from './ParcoursMeta'

export default function ParcoursCard({ parcours, locale }: { parcours: Parcours; locale: string }) {
  const t = useTranslations('commun')
  return (
    <Link href={`/parcours/${parcours.slug}`} className="card block overflow-hidden">
      <div className="relative h-40 w-full bg-[var(--surface-2)]">
        {parcours.photo ? (
          <Image
            src={parcours.photo}
            alt={tx(parcours.nom, locale)}
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--encre-3)]">
            <MountainSnow size={32} aria-hidden />
          </div>
        )}
        <div className="absolute start-3 top-3 flex gap-1.5">
          <BadgeDifficulte difficulte={parcours.difficulte} />
          <BadgeType type={parcours.type} />
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-[17px] font-bold leading-snug">{tx(parcours.nom, locale)}</h3>
        {parcours.accroche ? (
          <p className="mt-1 text-[13.5px] leading-snug text-[var(--encre-2)]">
            {tx(parcours.accroche, locale)}
          </p>
        ) : null}
        <p className="mono mt-2.5 text-[13px] text-[var(--encre-2)]">
          {formatKm(parcours.distance_m, locale)}
          {parcours.denivele_pos_m != null ? ` · +${parcours.denivele_pos_m} m` : ''}
          {' · '}
          {formatDuree(parcours.duree_min_minutes, parcours.duree_max_minutes, locale)}
        </p>
        {parcours.acces_guide ? (
          <p className="mt-1.5 text-[12.5px] font-semibold text-[var(--ocre)]">{t('accesGuide')}</p>
        ) : null}
      </div>
    </Link>
  )
}
