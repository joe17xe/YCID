import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { getParcours, getTerritoire } from '@/lib/content'
import ParcoursCard from '@/components/ParcoursCard'
import MapView from '@/components/carte/MapView'
import MapPanel from '@/components/ui/MapPanel'
import SectionHeading from '@/components/ui/SectionHeading'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('parcours')
  return { title: t('titre') }
}

export default async function PageParcours() {
  const [territoire, parcours, locale, t] = await Promise.all([
    getTerritoire(),
    getParcours(),
    getLocale(),
    getTranslations('parcours'),
  ])
  const traces = parcours
    .filter((p) => p.trace)
    .map((p) => ({ id: p.slug, line: p.trace!, provisoire: p.trace_statut === 'provisoire' }))
  const departs = parcours
    .filter((p) => p.depart)
    .map((p) => ({ id: p.slug, position: p.depart!, kind: 'depart' as const }))
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
          traces={traces}
          markers={departs}
          className="h-full w-full"
        />
      </MapPanel>
      <div className="grid gap-[var(--s5)] sm:grid-cols-2">
        {parcours.map((p) => (
          <ParcoursCard key={p.slug} parcours={p} locale={locale} />
        ))}
      </div>
    </div>
  )
}
