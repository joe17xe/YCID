import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import AppNav from '@/components/AppNav'
import EtatAccesBanner from '@/components/EtatAccesBanner'
import SiteHeader from '@/components/SiteHeader'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [territoire, locale, t] = await Promise.all([
    getTerritoire(),
    getLocale(),
    getTranslations('footer'),
  ])
  const marque = territoire.marque ?? tx(territoire.nom, locale)
  return (
    <>
      <SiteHeader marque={marque} />
      <EtatAccesBanner etat={territoire.etat_acces} locale={locale} />
      <main
        className="mx-auto w-full max-w-3xl px-[var(--s3)] pt-[var(--s4)]"
        style={{ paddingBottom: 'calc(var(--nav-h) + var(--s6) + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>
      <footer
        className="mx-auto max-w-3xl px-[var(--s3)] pt-[var(--s2)] text-[var(--t-micro)] leading-relaxed text-[var(--encre-3)]"
        style={{ paddingBottom: 'calc(var(--nav-h) + var(--s4) + env(safe-area-inset-bottom))' }}
      >
        <span className="balise balise-sm mb-[var(--s2)] block" aria-hidden />
        <p>{t('programme')}</p>
        <p className="mt-1">{t('traceNote')}</p>
        <p className="mt-[var(--s2)]">
          <Link href="/a-propos" className="font-semibold text-[var(--encre-2)] underline underline-offset-2">
            {tx({ fr: 'À propos', ar: 'عن المشروع', en: 'About' }, locale)}
          </Link>
        </p>
      </footer>
      <AppNav />
    </>
  )
}
