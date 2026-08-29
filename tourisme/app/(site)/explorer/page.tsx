import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Binoculars, Church, Landmark, Leaf, MapPin, Tent, UtensilsCrossed, Bed, Users, Droplets } from 'lucide-react'
import { getPois, getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import MapView from '@/components/carte/MapView'
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
    <div className="space-y-5">
      <header>
        <h1 className="text-[26px] font-extrabold">{t('titre')}</h1>
        <p className="mt-1 text-[14.5px] text-[var(--encre-2)]">{t('sousTitre')}</p>
      </header>
      <div className="card overflow-hidden">
        <MapView
          center={territoire.centre}
          zoom={territoire.zoom_defaut}
          markers={pois.map((p) => ({
            id: p.slug,
            position: p.geom,
            label: tx(p.nom, locale),
            kind: 'poi' as const,
          }))}
          className="h-64 w-full"
        />
      </div>
      <ul className="space-y-2.5">
        {lieux.map((p) => {
          const Icone = ICONES[p.type] ?? MapPin
          return (
            <li key={p.slug}>
              <Link href={`/explorer/${p.slug}`} className="card flex items-center gap-3.5 overflow-hidden">
                {p.photo ? (
                  <span className="relative h-[72px] w-[84px] shrink-0">
                    <Image src={p.photo} alt="" fill sizes="84px" className="object-cover" />
                  </span>
                ) : (
                  <span className="ms-3.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--vert-pale)] text-[var(--pin)]">
                    <Icone size={20} aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1 py-3 pe-3.5">
                  <span className="block truncate text-[15px] font-bold">{tx(p.nom, locale)}</span>
                  <span className="block truncate text-[13px] text-[var(--encre-2)]">
                    {tx(p.texte, locale)}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
