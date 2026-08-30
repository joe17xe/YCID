import { useTranslations } from 'next-intl'
import type { Parcours } from '@/lib/types'

export function BadgeDifficulte({ difficulte }: { difficulte: Parcours['difficulte'] }) {
  const t = useTranslations('commun.difficulte')
  const cls = { facile: 'chip-facile', modere: 'chip-modere', difficile: 'chip-difficile' }[difficulte]
  return <span className={`chip ${cls}`}>{t(difficulte)}</span>
}

export function BadgeType({ type }: { type: Parcours['type'] }) {
  const t = useTranslations('commun.type')
  return <span className="chip chip-photo">{t(type)}</span>
}
