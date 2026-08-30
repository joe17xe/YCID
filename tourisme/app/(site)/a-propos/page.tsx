import type { Metadata } from 'next'
import Image from 'next/image'
import { getLocale, getTranslations } from 'next-intl/server'
import { getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import SectionHeading from '@/components/ui/SectionHeading'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('apropos')
  return { title: t('titre') }
}

export default async function PageAPropos() {
  const [territoire, locale, t] = await Promise.all([
    getTerritoire(),
    getLocale(),
    getTranslations('apropos'),
  ])
  return (
    <article className="space-y-[var(--s4)]">
      <header>
        <SectionHeading titre={t('titre')} niveau={1} />
        <p className="text-[var(--t-small)] text-[var(--encre-2)]">
          {territoire.marque ?? tx(territoire.nom, locale)} — {tx(territoire.slogan, locale)}
        </p>
      </header>
      <div className="media relative -mx-[var(--s3)] h-48 md:mx-0">
        <Image src="/photos/drone-trace.jpg" alt="" fill sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
      </div>
      <p className="prose-app max-w-prose text-[15.5px] leading-relaxed">{t('texte1')}</p>
      <p className="prose-app max-w-prose text-[15.5px] leading-relaxed">{t('texte2')}</p>
      <section className="bloc courbes p-[var(--s4)]">
        <h2 className="eyebrow">{t('photosTitre')}</h2>
        <p className="mt-1.5 text-[var(--t-small)] text-[var(--encre-2)]">{t('photos')}</p>
      </section>
      <p className="max-w-prose border-t border-[var(--ligne)] pt-[var(--s3)] text-[var(--t-small)] leading-relaxed text-[var(--encre-3)]">
        {t('duplicable')}
      </p>
    </article>
  )
}
