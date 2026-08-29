import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import AppNav from '@/components/AppNav'
import EtatAccesBanner from '@/components/EtatAccesBanner'
import LangSwitcher from '@/components/LangSwitcher'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [territoire, locale, t] = await Promise.all([
    getTerritoire(),
    getLocale(),
    getTranslations('footer'),
  ])
  const marque = territoire.marque ?? tx(territoire.nom, locale)
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--ligne)] bg-[var(--fond)]/92 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="titres text-[19px] font-extrabold tracking-tight text-[var(--pin)]">
            {marque}
          </Link>
          <LangSwitcher />
        </div>
      </header>
      <EtatAccesBanner etat={territoire.etat_acces} locale={locale} />
      <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-28">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-28 pt-2 text-[12.5px] leading-relaxed text-[var(--encre-3)]">
        <p>{t('programme')}</p>
        <p className="mt-1">{t('traceNote')}</p>
        <p className="mt-1">
          <Link href="/a-propos" className="underline underline-offset-2">
            {tx({ fr: 'À propos', ar: 'عن المشروع', en: 'About' }, locale)}
          </Link>
        </p>
      </footer>
      <AppNav />
    </>
  )
}
