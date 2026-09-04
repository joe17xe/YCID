import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ExternalLink, MessageCircle, Phone, Signpost } from 'lucide-react'
import { getParcours, getPoiBySlug, getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import MapView from '@/components/carte/MapView'
import MapPanel from '@/components/ui/MapPanel'
import Itineraire from '@/components/ui/Itineraire'
import Galerie from '@/components/ui/Galerie'

export async function generateMetadata(props: PageProps<'/explorer/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params
  const poi = await getPoiBySlug(slug)
  const locale = await getLocale()
  if (!poi) return {}
  return { title: tx(poi.nom, locale) }
}

export default async function FichePoi(props: PageProps<'/explorer/[slug]'>) {
  const { slug } = await props.params
  const [poi, parcours, territoire, locale, tp, tc] = await Promise.all([
    getPoiBySlug(slug),
    getParcours(),
    getTerritoire(),
    getLocale(),
    getTranslations('pratique'),
    getTranslations('commun'),
  ])
  if (!poi) notFound()
  const lies = parcours.filter((p) => p.etapes.includes(poi.slug))
  return (
    <article className="space-y-[var(--s4)]">
      {poi.photo ? (
        <div className="-mx-[var(--s3)] -mt-[var(--s4)] relative h-56 md:overflow-hidden md:rounded-[var(--r-media)]">
          <Image src={poi.photo} alt="" fill priority sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
        </div>
      ) : null}
      <header>
        <div className="mb-[var(--s2)] flex items-center gap-[var(--s1)]">
          <span className="balise balise-sm" aria-hidden />
          {poi.panneau_no != null ? (
            <span className="eyebrow">
              {tc('panneau')} {poi.panneau_no}
            </span>
          ) : null}
        </div>
        <h1 className="t-h1 leading-tight">{tx(poi.nom, locale)}</h1>
      </header>
      {poi.texte ? (
        <p className="prose-app max-w-prose text-[15.5px] leading-relaxed">{tx(poi.texte, locale)}</p>
      ) : null}

      {poi.contact ? (
        <div className="flex flex-wrap gap-[var(--s2)]">
          {poi.contact.tel ? (
            <a href={`tel:${poi.contact.tel}`} className="btn btn-surface btn-sm">
              <Phone size={16} aria-hidden /> {tp('appeler')}
            </a>
          ) : null}
          {poi.contact.whatsapp ? (
            <a
              href={`https://wa.me/${poi.contact.whatsapp.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener"
              className="btn btn-pin btn-sm"
            >
              <MessageCircle size={16} aria-hidden /> {tp('whatsapp')}
            </a>
          ) : null}
          {poi.contact.site ? (
            <a href={poi.contact.site} target="_blank" rel="noopener" className="btn btn-surface btn-sm">
              <ExternalLink size={16} aria-hidden /> {tp('siteWeb')}
            </a>
          ) : null}
        </div>
      ) : null}

      <MapPanel hauteur="h-56">
        <MapView
          center={poi.geom}
          zoom={15}
          markers={[{ id: poi.slug, position: poi.geom, kind: 'poi', label: tx(poi.nom, locale) }]}
          fit={false}
          className="h-full w-full"
        />
      </MapPanel>

      {poi.photos?.length ? (
        <Galerie photos={poi.photos} couverture={poi.photo} locale={locale} />
      ) : null}

      <Itineraire geom={poi.geom} nom={tx(poi.nom, locale)} />

      {lies.length ? (
        <section>
          <h2 className="eyebrow mb-[var(--s2)] flex items-center gap-2">
            <Signpost size={14} aria-hidden />
            {tx({ fr: 'Sur les parcours', ar: 'على المسارات', en: 'On the trails' }, locale)}
          </h2>
          <div>
            {lies.map((p) => (
              <Link
                key={p.slug}
                href={`/parcours/${p.slug}`}
                className="ligne-liste text-[15px] font-semibold text-[var(--pin)]"
              >
                {tx(p.nom, locale)}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {territoire.contact_tel == null && poi.type === 'guide' ? (
        <p className="text-[var(--t-micro)] text-[var(--encre-3)]">{tp('aucunContact')}</p>
      ) : null}
    </article>
  )
}
