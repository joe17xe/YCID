import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { CalendarRange, CircleAlert, Footprints, MapPin, MessageCircle, Route } from 'lucide-react'
import { getParcours, getParcoursBySlug, getPois, getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import MapView from '@/components/carte/MapView'
import PackHorsLigne from '@/components/PackHorsLigne'
import ParcoursCard from '@/components/ParcoursCard'
import { BadgeDifficulte, BadgeType, StatsRow } from '@/components/ParcoursMeta'

export async function generateMetadata(props: PageProps<'/parcours/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params
  const parcours = await getParcoursBySlug(slug)
  const locale = await getLocale()
  if (!parcours) return {}
  return { title: tx(parcours.nom, locale), description: tx(parcours.accroche, locale) ?? undefined }
}

export default async function FicheParcours(props: PageProps<'/parcours/[slug]'>) {
  const { slug } = await props.params
  const [parcours, tous, pois, territoire, locale, t, tc] = await Promise.all([
    getParcoursBySlug(slug),
    getParcours(),
    getPois(),
    getTerritoire(),
    getLocale(),
    getTranslations('parcours'),
    getTranslations('commun'),
  ])
  if (!parcours) notFound()

  const etapes = parcours.etapes
    .map((s) => pois.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  const markers = etapes.map((p, i) => ({
    id: p.slug,
    position: p.geom,
    label: tx(p.nom, locale),
    kind: 'etape' as const,
    no: p.panneau_no ?? i + 1,
  }))

  const whatsapp =
    territoire.contact_whatsapp ??
    pois.find((p) => p.type === 'guide')?.contact?.whatsapp ??
    null
  const waLink = whatsapp
    ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
        `${tx(parcours.nom, locale)} — ${tc('reserverGuide')}`,
      )}`
    : null

  const packUrls = [
    `/parcours/${parcours.slug}`,
    `/parcours/${parcours.slug}/sentier`,
    ...(parcours.photo ? [parcours.photo] : []),
    ...(!parcours.acces_guide && parcours.trace ? [`/api/gpx/${parcours.slug}`] : []),
  ]

  return (
    <article className="space-y-6">
      {/* En-tête photo */}
      <header className="relative -mx-4 md:mx-0 md:overflow-hidden md:rounded-3xl">
        <div className="relative h-56 w-full">
          {parcours.photo ? (
            <Image
              src={parcours.photo}
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          ) : (
            <div className="h-full bg-[var(--surface-2)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <div className="mb-1.5 flex gap-1.5">
              <BadgeDifficulte difficulte={parcours.difficulte} />
              <BadgeType type={parcours.type} />
            </div>
            <h1 className="text-[26px] font-extrabold leading-tight">{tx(parcours.nom, locale)}</h1>
            {parcours.accroche ? (
              <p className="mt-1 max-w-lg text-[13.5px] leading-snug opacity-95">
                {tx(parcours.accroche, locale)}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {/* La décision en dix secondes */}
      <StatsRow parcours={parcours} locale={locale} />

      {parcours.trace_statut === 'provisoire' && parcours.trace ? (
        <p className="rounded-xl border border-[var(--ocre-bord)] bg-[var(--ocre-pale)] px-3.5 py-2.5 text-[13px] leading-snug text-[var(--ocre)]">
          {tc('traceProvisoire')}
        </p>
      ) : null}

      {/* Actions */}
      <div className="space-y-2.5">
        {parcours.acces_guide ? (
          waLink ? (
            <a href={waLink} target="_blank" rel="noopener" className="btn btn-pin w-full">
              <MessageCircle size={18} aria-hidden /> {tc('reserverGuide')}
            </a>
          ) : (
            <p className="rounded-xl border border-[var(--ligne)] bg-[var(--surface)] px-4 py-3 text-[13.5px] text-[var(--encre-2)]">
              {tc('accesGuide')}
            </p>
          )
        ) : (
          <>
            <PackHorsLigne slug={parcours.slug} version={parcours.version} urls={packUrls} />
            <div className="flex gap-2.5">
              <Link href={`/parcours/${parcours.slug}/sentier`} className="btn btn-surface flex-1">
                <Footprints size={18} aria-hidden /> {tc('ouvrirSentier')}
              </Link>
              {parcours.trace ? (
                <a href={`/api/gpx/${parcours.slug}`} className="btn btn-surface flex-1" download>
                  <Route size={18} aria-hidden /> GPX
                </a>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Description */}
      {parcours.description ? (
        <section>
          <h2 className="mb-2 text-[19px] font-bold">{t('description')}</h2>
          <p className="prose-app text-[15px] leading-relaxed">{tx(parcours.description, locale)}</p>
        </section>
      ) : null}

      {/* Carte */}
      {parcours.trace ? (
        <section className="card overflow-hidden">
          <MapView
            center={territoire.centre}
            traces={[{ id: parcours.slug, line: parcours.trace, provisoire: parcours.trace_statut === 'provisoire' }]}
            markers={markers}
            className="h-72 w-full"
          />
        </section>
      ) : null}

      {/* Étapes numérotées comme les panneaux */}
      {etapes.length ? (
        <section>
          <h2 className="mb-2.5 text-[19px] font-bold">{tc('etapes')}</h2>
          <ol className="space-y-2">
            {etapes.map((p, i) => (
              <li key={p.slug}>
                <Link href={`/explorer/${p.slug}`} className="card flex items-center gap-3 p-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--pin)] text-[13px] font-bold text-[var(--sur-pin)]">
                    {p.panneau_no ?? i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">
                    {tx(p.nom, locale)}
                  </span>
                  <MapPin size={16} className="shrink-0 text-[var(--encre-3)]" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* Sécurité, saison, accès */}
      {parcours.dangers ? (
        <section className="rounded-2xl border border-[var(--danger)] bg-[var(--danger-pale)] p-4">
          <h2 className="mb-1.5 flex items-center gap-2 text-[16px] font-bold text-[var(--danger)]">
            <CircleAlert size={18} aria-hidden /> {t('dangers')}
          </h2>
          <p className="text-[14px] leading-relaxed text-[var(--encre)]">{tx(parcours.dangers, locale)}</p>
        </section>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {parcours.saison ? (
          <section className="card p-4">
            <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold">
              <CalendarRange size={17} className="text-[var(--pin)]" aria-hidden /> {t('saison')}
            </h2>
            <p className="text-[13.5px] leading-relaxed text-[var(--encre-2)]">{tx(parcours.saison, locale)}</p>
          </section>
        ) : null}
        {parcours.acces ? (
          <section className="card p-4">
            <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold">
              <MapPin size={17} className="text-[var(--pin)]" aria-hidden /> {t('acces')}
            </h2>
            <p className="text-[13.5px] leading-relaxed text-[var(--encre-2)]">{tx(parcours.acces, locale)}</p>
          </section>
        ) : null}
      </div>

      {/* Autres parcours */}
      <section>
        <h2 className="mb-3 text-[19px] font-bold">{t('aussi')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {tous
            .filter((p) => p.slug !== parcours.slug)
            .slice(0, 2)
            .map((p) => (
              <ParcoursCard key={p.slug} parcours={p} locale={locale} />
            ))}
        </div>
      </section>
    </article>
  )
}
