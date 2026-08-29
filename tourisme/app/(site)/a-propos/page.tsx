import type { Metadata } from 'next'
import Image from 'next/image'
import { getLocale, getTranslations } from 'next-intl/server'
import { getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'

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
    <article className="space-y-5">
      <header>
        <h1 className="text-[26px] font-extrabold">{t('titre')}</h1>
        <p className="mt-1 text-[14.5px] text-[var(--encre-2)]">
          {territoire.marque ?? tx(territoire.nom, locale)} — {tx(territoire.slogan, locale)}
        </p>
      </header>
      <div className="relative -mx-4 h-48 md:mx-0 md:overflow-hidden md:rounded-3xl">
        <Image src="/photos/drone-trace.jpg" alt="" fill sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
      </div>
      <p className="text-[15px] leading-relaxed">{t('texte1')}</p>
      <p className="text-[15px] leading-relaxed">{t('texte2')}</p>
      <section className="card p-4">
        <h2 className="text-[15px] font-bold">{t('photosTitre')}</h2>
        <p className="mt-1 text-[13px] text-[var(--encre-2)]">{t('photos')}</p>
      </section>
      <p className="text-[13.5px] leading-relaxed text-[var(--encre-3)]">{t('duplicable')}</p>
    </article>
  )
}
