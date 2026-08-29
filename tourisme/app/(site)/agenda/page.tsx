import type { Metadata } from 'next'
import Image from 'next/image'
import { getLocale, getTranslations } from 'next-intl/server'
import { CalendarDays, Repeat } from 'lucide-react'
import { getEvenements } from '@/lib/content'
import { tx } from '@/lib/i18n-text'

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
    <div className="space-y-5">
      <header>
        <h1 className="text-[26px] font-extrabold">{t('titre')}</h1>
        <p className="mt-1 text-[14.5px] text-[var(--encre-2)]">{t('sousTitre')}</p>
      </header>
      <div className="space-y-4">
        {evenements.map((e) => (
          <article key={e.slug} className="card overflow-hidden">
            {e.photo ? (
              <div className="relative h-40 w-full">
                <Image src={e.photo} alt="" fill sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
              </div>
            ) : null}
            <div className="p-4">
              <p className="mb-1 flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--ocre)]">
                {e.recurrent ? <Repeat size={14} aria-hidden /> : <CalendarDays size={14} aria-hidden />}
                {e.recurrent && !e.date_debut
                  ? t('saisonnier')
                  : fmtDate(e.date_debut) ?? t('dateAVenir')}
              </p>
              <h2 className="text-[18px] font-bold leading-snug">{tx(e.nom, locale)}</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--encre-2)]">
                {tx(e.description, locale)}
              </p>
              {e.lien ? (
                <a href={e.lien} target="_blank" rel="noopener" className="mt-2 inline-block text-[13.5px] font-bold text-[var(--bisri)] underline underline-offset-2">
                  {e.lien.replace(/^https?:\/\//, '')}
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
