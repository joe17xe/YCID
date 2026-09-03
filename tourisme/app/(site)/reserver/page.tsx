import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Phone } from 'lucide-react'
import { getFormules, getTerritoire } from '@/lib/content'
import FormuleCard from '@/components/reserver/FormuleCard'
import InfoNotice from '@/components/ui/InfoNotice'
import SectionHeading from '@/components/ui/SectionHeading'
import type { Locale } from '@/lib/types'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('reserver')
  return { title: t('titre'), description: t('sousTitre') }
}

export default async function PageReserver() {
  const [territoire, formules, locale, t, tp] = await Promise.all([
    getTerritoire(),
    getFormules(),
    getLocale(),
    getTranslations('reserver'),
    getTranslations('pratique'),
  ])

  return (
    <div className="space-y-[var(--s5)]">
      <header>
        <SectionHeading titre={t('titre')} niveau={1} />
        <p className="max-w-prose text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
          {t('sousTitre')}
        </p>
      </header>

      {/* Le kiosque d'abord : c'est lui qui confirme, le formulaire ne
          fait que lui porter la demande. */}
      {territoire.contact_tel ? (
        <section className="card flex flex-wrap items-center justify-between gap-[var(--s2)] p-[var(--s3)]">
          <p className="text-[var(--t-small)] leading-snug text-[var(--encre-2)]">
            {tp('kiosqueTitre')}
          </p>
          <a
            href={`tel:${territoire.contact_tel.replace(/\s/g, '')}`}
            className="btn btn-pin btn-sm"
          >
            <Phone size={16} aria-hidden />
            <span dir="ltr" className="mono">
              {territoire.contact_tel}
            </span>
          </a>
        </section>
      ) : null}

      {formules.length ? (
        <>
          <div className="grid gap-[var(--s3)] sm:grid-cols-2">
            {formules.map((f) => (
              <FormuleCard key={f.slug} formule={f} locale={locale as Locale} t={t} />
            ))}
          </div>
          <InfoNotice>{t('note')}</InfoNotice>
        </>
      ) : (
        <InfoNotice ton="vigilance">{t('aucune')}</InfoNotice>
      )}
    </div>
  )
}
