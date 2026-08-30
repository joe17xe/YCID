import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Bed, Binoculars, Church, Droplets, Landmark, Leaf, MapPin, Tent, Users, UtensilsCrossed } from 'lucide-react'
import { getPois, getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import MapView from '@/components/carte/MapView'
import MapPanel from '@/components/ui/MapPanel'
import ListRow from '@/components/ui/ListRow'
import SectionHeading from '@/components/ui/SectionHeading'
import type { PoiType } from '@/lib/types'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('explorer')
  return { title: t('titre') }
}

const ICONES: Partial<Record<PoiType, typeof MapPin>> = {
  belvedere: Binoculars,
  patrimoine: Landmark,
  nature: Leaf,
  depart: MapPin,
  camping: Tent,
  hebergement: Bed,
  restaurant: UtensilsCrossed,
  guide: Users,
  eau: Droplets,
  autre: Church,
}

export default async function PageExplorer() {
  const [territoire, pois, locale, t] = await Promise.all([
    getTerritoire(),
    getPois(),
    getLocale(),
    getTranslations('explorer'),
  ])
  const lieux = pois.filter((p) => !['hebergement', 'restaurant', 'guide'].includes(p.type))
  return (
    <div className="space-y-[var(--s5)]">
      <header>
        <SectionHeading titre={t('titre')} niveau={1} />
        <p className="max-w-prose text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
          {t('sousTitre')}
        </p>
      </header>
      <MapPanel>
        <MapView
          center={territoire.centre}
          zoom={territoire.zoom_defaut}
          markers={pois.map((p) => ({
            id: p.slug,
            position: p.geom,
            label: tx(p.nom, locale),
            kind: 'poi' as const,
          }))}
          className="h-full w-full"
        />
      </MapPanel>
      <div>
        {lieux.map((p) => {
          const Icone = ICONES[p.type] ?? MapPin
          return (
            <ListRow
              key={p.slug}
              href={`/explorer/${p.slug}`}
              vignette={p.photo}
              icone={p.photo ? undefined : <Icone size={18} aria-hidden />}
              titre={tx(p.nom, locale)}
              detail={tx(p.texte, locale)}
            />
          )
        })}
      </div>
    </div>
  )
}
