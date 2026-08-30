import type { Metadata } from 'next'
import Image from 'next/image'
import { getLocale, getTranslations } from 'next-intl/server'
import { CalendarDays, Repeat } from 'lucide-react'
import { getEvenements } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import SectionHeading from '@/components/ui/SectionHeading'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('agenda')
  return { title: t('titre') }
}

export default async function PageAgenda() {
  const [evenements, locale, t] = await Promise.all([
    getEvenements(),
    getLocale(),
    getTranslations('agenda'),
  ])
  const fmtDate = (d?: string | null) =>
    d
      ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-LB' : locale === 'en' ? 'en-GB' : 'fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null
  return (
    <div className="space-y-[var(--s5)]">
      <header>
        <SectionHeading titre={t('titre')} niveau={1} />
        <p className="max-w-prose text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
          {t('sousTitre')}
        </p>
      </header>

      {/* Traitement éditorial : l'image en bandeau, le texte au-dessous,
          séparés par un filet — pas une pile de caissons. */}
      <div className="divide-y divide-[var(--ligne)]">
        {evenements.map((e) => (
          <article key={e.slug} className="py-[var(--s4)] first:pt-0">
            {e.photo ? (
              <div className="media relative mb-[var(--s3)] h-40 w-full">
                <Image src={e.photo} alt="" fill sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
              </div>
            ) : null}
            <p className="mono mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ocre)]">
              {e.recurrent ? <Repeat size={13} aria-hidden /> : <CalendarDays size={13} aria-hidden />}
              {e.recurrent && !e.date_debut ? t('saisonnier') : fmtDate(e.date_debut) ?? t('dateAVenir')}
            </p>
            <h2 className="t-h3 leading-snug">{tx(e.nom, locale)}</h2>
            <p className="mt-[var(--s2)] max-w-prose text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
              {tx(e.description, locale)}
            </p>
            {e.lien ? (
              <a
                href={e.lien}
                target="_blank"
                rel="noopener"
                className="mt-[var(--s2)] inline-block text-[13px] font-semibold text-[var(--bisri)] underline underline-offset-2"
              >
                {e.lien.replace(/^https?:\/\//, '')}
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  )
}
