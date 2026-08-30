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
import { BadgeDifficulte, BadgeType } from '@/components/ParcoursMeta'
import InfoNotice from '@/components/ui/InfoNotice'
import MapPanel from '@/components/ui/MapPanel'
import SectionHeading from '@/components/ui/SectionHeading'
import StatBand from '@/components/ui/StatBand'
import Waypoints from '@/components/ui/Waypoints'

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
    <article className="space-y-[var(--s5)]">
      {/* L'image porte l'en-tête ; le titre s'y pose, sans caisson. */}
      <header className="-mx-[var(--s3)] -mt-[var(--s4)]">
        <div className="relative h-60 w-full md:overflow-hidden md:rounded-[var(--r-media)]">
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
          <div className="absolute inset-0 bg-gradient-to-t from-[rgb(11_23_18/0.85)] via-[rgb(11_23_18/0.2)] to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-[var(--s3)] text-[#f6f4ea]">
            <div className="mb-[var(--s2)] flex flex-wrap gap-1.5">
              <BadgeDifficulte difficulte={parcours.difficulte} />
              <BadgeType type={parcours.type} />
            </div>
            <h1 className="t-h1 leading-tight">{tx(parcours.nom, locale)}</h1>
            {parcours.accroche ? (
              <p className="mt-1.5 max-w-lg text-[var(--t-small)] leading-snug opacity-95">
                {tx(parcours.accroche, locale)}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {/* Les mesures, en bande d'instrument. */}
      <StatBand parcours={parcours} locale={locale} />

      {parcours.trace_statut === 'provisoire' && parcours.trace ? (
        <InfoNotice ton="vigilance">{tc('traceProvisoire')}</InfoNotice>
      ) : null}

      <div className="space-y-[var(--s2)]">
        {parcours.acces_guide ? (
          waLink ? (
            <a href={waLink} target="_blank" rel="noopener" className="btn btn-pin w-full">
              <MessageCircle size={18} aria-hidden /> {tc('reserverGuide')}
            </a>
          ) : (
            <InfoNotice ton="vigilance">{tc('accesGuide')}</InfoNotice>
          )
        ) : (
          <>
            <PackHorsLigne slug={parcours.slug} version={parcours.version} urls={packUrls} />
            <div className="flex gap-[var(--s2)]">
              <Link href={`/parcours/${parcours.slug}/sentier`} className="btn btn-surface flex-[2]">
                <Footprints size={18} aria-hidden /> {tc('ouvrirSentier')}
              </Link>
              {parcours.trace ? (
                <a href={`/api/gpx/${parcours.slug}`} className="btn btn-surface flex-1 shrink-0" download>
                  <Route size={18} aria-hidden /> GPX
                </a>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Le récit : bloc éditorial, texture de courbes de niveau. */}
      {parcours.description ? (
        <section className="bloc courbes p-[var(--s4)]">
          <h2 className="t-h3 mb-[var(--s2)]">{t('description')}</h2>
          <p className="prose-app text-[15.5px] leading-relaxed">
            {tx(parcours.description, locale)}
          </p>
        </section>
      ) : null}

      {parcours.trace ? (
        <MapPanel hauteur="h-72">
          <MapView
            center={territoire.centre}
            traces={[
              {
                id: parcours.slug,
                line: parcours.trace,
                provisoire: parcours.trace_statut === 'provisoire',
              },
            ]}
            markers={markers}
            className="h-full w-full"
          />
        </MapPanel>
      ) : null}

      {/* Les étapes : le fil du sentier, numéroté comme les panneaux. */}
      {etapes.length ? (
        <section>
          <SectionHeading titre={tc('etapes')} />
          <Waypoints
            etapes={etapes.map((p, i) => ({
              slug: p.slug,
              nom: tx(p.nom, locale),
              numero: p.panneau_no ?? i + 1,
            }))}
          />
        </section>
      ) : null}

      {parcours.dangers ? (
        <InfoNotice
          ton="danger"
          titre={t('dangers')}
          icone={<CircleAlert size={17} aria-hidden />}
        >
          {tx(parcours.dangers, locale)}
        </InfoNotice>
      ) : null}

      {/* Saison et accès : une liste de définitions à filets, pas deux cartes. */}
      {parcours.saison || parcours.acces ? (
        <dl className="border-t border-[var(--ligne)]">
          {parcours.saison ? (
            <div className="border-b border-[var(--ligne)] py-[var(--s3)]">
              <dt className="mb-1 flex items-center gap-2 text-[13px] font-bold">
                <CalendarRange size={16} className="text-[var(--pin)]" aria-hidden />
                {t('saison')}
              </dt>
              <dd className="text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
                {tx(parcours.saison, locale)}
              </dd>
            </div>
          ) : null}
          {parcours.acces ? (
            <div className="border-b border-[var(--ligne)] py-[var(--s3)]">
              <dt className="mb-1 flex items-center gap-2 text-[13px] font-bold">
                <MapPin size={16} className="text-[var(--pin)]" aria-hidden />
                {t('acces')}
              </dt>
              <dd className="text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
                {tx(parcours.acces, locale)}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <section>
        <SectionHeading titre={t('aussi')} />
        <div className="grid gap-[var(--s5)] sm:grid-cols-2">
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
