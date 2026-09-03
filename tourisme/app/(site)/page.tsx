import Image from 'next/image'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowRight, CalendarDays, Info, Phone, Repeat, Ticket } from 'lucide-react'
import { getEvenements, getParcours, getPoiBySlug, getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import ParcoursCard from '@/components/ParcoursCard'
import ActionCard from '@/components/ui/ActionCard'
import ListRow from '@/components/ui/ListRow'
import SectionHeading from '@/components/ui/SectionHeading'

export default async function Accueil() {
  const [territoire, parcours, evenements, shir, locale, t, tr] = await Promise.all([
    getTerritoire(),
    getParcours(),
    getEvenements(),
    getPoiBySlug('falaise-panoramique'),
    getLocale(),
    getTranslations('accueil'),
    getTranslations('reserver'),
  ])
  const lien = (label: string, href: string) => (
    <Link
      href={href}
      className="flex items-center gap-1 text-[13px] font-semibold text-[var(--bisri)]"
    >
      {label}
      <ArrowRight size={15} className="rtl:-scale-x-100" aria-hidden />
    </Link>
  )

  return (
    <div className="space-y-[var(--s6)]">
      {/* On entre par l'envie : la photo tient toute la largeur, le titre s'y pose. */}
      <section className="-mx-[var(--s3)] -mt-[var(--s4)]">
        <div className="relative h-[340px] w-full md:h-[380px] md:rounded-[var(--r-media)] md:overflow-hidden">
          <Image
            src={territoire.photo_accueil ?? '/photos/panorama-crete.jpg'}
            alt={tx(territoire.nom, locale)}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[rgb(11_23_18/0.82)] via-[rgb(11_23_18/0.15)] to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-[var(--s4)] text-[#f6f4ea]">
            <p className="eyebrow !text-[#cfd8cd]">{t('bienvenue')}</p>
            <h1 className="t-display mt-1.5 leading-[0.95]">
              {tx(territoire.nom, locale)}
              {locale !== 'ar' && territoire.nom.ar ? (
                <span
                  lang="ar"
                  dir="rtl"
                  className="ms-[0.35em] align-middle text-[0.5em] font-semibold opacity-75"
                >
                  {territoire.nom.ar}
                </span>
              ) : null}
            </h1>
            <p className="mt-[var(--s2)] max-w-md text-[var(--t-small)] leading-snug opacity-95">
              {tx(territoire.slogan, locale)}
            </p>
          </div>
        </div>
      </section>

      {/* Le kiosque : la porte d'entrée humaine du village. Il informe
          au téléphone ET prend les demandes de sortie — c'est ici, en
          haut de l'accueil, qu'on le trouve. */}
      <section className="card p-[var(--s4)]">
        <p className="eyebrow">{t('kiosqueTitre')}</p>
        <h2 className="t-h2 mt-1 leading-tight">{t('reserverTitre')}</h2>
        <p className="mt-1.5 max-w-prose text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
          {t('reserverTexte')}
        </p>
        <div className="mt-[var(--s3)] flex flex-wrap gap-[var(--s2)]">
          <Link href="/reserver" className="btn btn-pin">
            <Ticket size={17} aria-hidden />
            {tr('titre')}
          </Link>
          {territoire.contact_tel ? (
            <a
              href={`tel:${territoire.contact_tel.replace(/\s/g, '')}`}
              className="btn btn-surface"
            >
              <Phone size={17} aria-hidden />
              <span dir="ltr" className="mono">
                {territoire.contact_tel}
              </span>
            </a>
          ) : null}
        </div>
      </section>

      {/* Le site emblématique : une ligne, pas un caisson de plus. */}
      {shir ? (
        <section>
          <ListRow
            href={`/explorer/${shir.slug}`}
            vignette={shir.photo ?? '/photos/shir-falaise.jpg'}
            titre={tx(shir.nom, locale)}
            meta={t('siteEmblematique')}
          />
        </section>
      ) : null}

      {/* Les parcours : le cœur, en traitement éditorial. */}
      <section>
        <SectionHeading
          titre={t('aujourdhui')}
          eyebrow={t('decouvrir')}
          action={lien(t('tousParcours'), '/parcours')}
        />
        <div className="grid gap-[var(--s4)] sm:grid-cols-2">
          {parcours.slice(0, 4).map((p) => (
            <ParcoursCard key={p.slug} parcours={p} locale={locale} />
          ))}
        </div>
      </section>

      {/* L'agenda : des lignes, le rythme change. */}
      {evenements.length ? (
        <section>
          <SectionHeading titre={t('agendaTitre')} action={lien(t('voirAgenda'), '/agenda')} />
          <div>
            {evenements.slice(0, 2).map((e) => (
              <ListRow
                key={e.slug}
                href="/agenda"
                icone={
                  e.recurrent ? (
                    <Repeat size={18} aria-hidden />
                  ) : (
                    <CalendarDays size={18} aria-hidden />
                  )
                }
                titre={tx(e.nom, locale)}
                detail={tx(e.description, locale)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <ActionCard
        href="/pratique"
        titre={t('pratiqueTitre')}
        detail={t('meteo')}
        icone={<Info size={19} aria-hidden />}
        ton="ocre"
      />
    </div>
  )
}
