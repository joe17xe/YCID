import Image from 'next/image'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowRight, CalendarDays, Info } from 'lucide-react'
import { getEvenements, getParcours, getPoiBySlug, getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import ParcoursCard from '@/components/ParcoursCard'

export default async function Accueil() {
  const [territoire, parcours, evenements, shir, locale, t] = await Promise.all([
    getTerritoire(),
    getParcours(),
    getEvenements(),
    getPoiBySlug('falaise-panoramique'),
    getLocale(),
    getTranslations('accueil'),
  ])
  const fleche = <ArrowRight size={16} className="rtl:-scale-x-100" aria-hidden />
  return (
    <div className="space-y-8">
      {/* On accueille par l'envie : la photo d'abord, la carte à un geste */}
      <section className="relative -mx-4 overflow-hidden md:mx-0 md:rounded-3xl">
        <div className="relative h-[300px] w-full md:h-[340px]">
          <Image
            src={territoire.photo_accueil ?? '/photos/panorama-crete.jpg'}
            alt={tx(territoire.nom, locale)}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <p className="text-[13px] font-medium opacity-90">{t('bienvenue')}</p>
            <h1 className="text-4xl font-extrabold tracking-tight">
              {tx(territoire.nom, locale)}
              {locale !== 'ar' && territoire.nom.ar ? (
                <span lang="ar" className="ms-3 align-middle text-2xl font-bold opacity-85">
                  {territoire.nom.ar}
                </span>
              ) : null}
            </h1>
            <p className="mt-1 max-w-md text-[14.5px] leading-snug opacity-95">
              {tx(territoire.slogan, locale)}
            </p>
          </div>
        </div>
      </section>

      {/* Le site emblématique */}
      {shir ? (
        <Link
          href={`/explorer/${shir.slug}`}
          className="card flex items-center gap-4 overflow-hidden p-0"
        >
          <div className="relative h-24 w-28 shrink-0">
            <Image
              src={shir.photo ?? '/photos/shir-falaise.jpg'}
              alt=""
              fill
              sizes="112px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 py-3">
            <p className="eyebrow">{t('siteEmblematique')}</p>
            <p className="truncate text-[16px] font-bold">{tx(shir.nom, locale)}</p>
          </div>
          <span className="pe-4 text-[var(--pin)]">{fleche}</span>
        </Link>
      ) : null}

      {/* Les parcours */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[22px] font-bold">{t('aujourdhui')}</h2>
          <Link href="/parcours" className="flex items-center gap-1 text-[13.5px] font-semibold text-[var(--bisri)]">
            {t('tousParcours')} {fleche}
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {parcours.slice(0, 4).map((p) => (
            <ParcoursCard key={p.slug} parcours={p} locale={locale} />
          ))}
        </div>
      </section>

      {/* Agenda */}
      {evenements.length ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[22px] font-bold">{t('agendaTitre')}</h2>
            <Link href="/agenda" className="flex items-center gap-1 text-[13.5px] font-semibold text-[var(--bisri)]">
              {t('voirAgenda')} {fleche}
            </Link>
          </div>
          <div className="space-y-2.5">
            {evenements.slice(0, 2).map((e) => (
              <Link key={e.slug} href="/agenda" className="card flex items-center gap-3.5 p-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--vert-pale)] text-[var(--pin)]">
                  <CalendarDays size={20} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold">{tx(e.nom, locale)}</p>
                  <p className="truncate text-[13px] text-[var(--encre-2)]">
                    {tx(e.description, locale)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Pratique */}
      <Link href="/pratique" className="card flex items-center gap-3.5 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ocre-pale)] text-[var(--ocre)]">
          <Info size={20} aria-hidden />
        </span>
        <div className="flex-1">
          <p className="text-[15px] font-bold">{t('pratiqueTitre')}</p>
          <p className="text-[13px] text-[var(--encre-2)]">{t('meteo')}</p>
        </div>
        <span className="text-[var(--pin)]">{fleche}</span>
      </Link>
    </div>
  )
}
