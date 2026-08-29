import { getTranslations } from 'next-intl/server'
import { CircleAlert, CircleCheck, CircleX } from 'lucide-react'
import type { EtatAcces, Locale } from '@/lib/types'
import { tx } from '@/lib/i18n-text'

// Le bandeau « état d'accès » daté — personne ne le fait au Liban :
// c'est un engagement d'honnêteté autant qu'une information.
export default async function EtatAccesBanner({
  etat,
  locale,
}: {
  etat: EtatAcces | null | undefined
  locale: Locale | string
}) {
  if (!etat) return null
  const t = await getTranslations('etatAcces')
  const styles = {
    ouvert: { bg: 'var(--vert-pale)', fg: 'var(--pin)', Icon: CircleCheck },
    prudence: { bg: 'var(--ocre-pale)', fg: 'var(--ocre)', Icon: CircleAlert },
    ferme: { bg: 'var(--danger-pale)', fg: 'var(--danger)', Icon: CircleX },
  }[etat.niveau]
  const date = new Date(etat.date).toLocaleDateString(
    locale === 'ar' ? 'ar-LB' : locale === 'en' ? 'en-GB' : 'fr-FR',
    { day: 'numeric', month: 'long', year: 'numeric' },
  )
  return (
    <aside
      className="border-b border-[var(--ligne)] px-4 py-2.5"
      style={{ background: styles.bg, color: styles.fg }}
    >
      <div className="mx-auto flex max-w-3xl items-start gap-2.5 text-[13.5px] leading-snug">
        <styles.Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          <strong className="font-bold">{t(etat.niveau)}</strong>
          {' — '}
          {tx(etat.message, locale)}{' '}
          <span className="opacity-75">({t('misAJourLe', { date })})</span>
        </p>
      </div>
    </aside>
  )
}
