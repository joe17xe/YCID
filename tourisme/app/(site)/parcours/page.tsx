import { getLocale, getTranslations } from 'next-intl/server'
import { getParcours, getTerritoire } from '@/lib/content'
import ParcoursCard from '@/components/ParcoursCard'
import MapView from '@/components/carte/MapView'
import type { Metadata } from 'next'

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
    <div className="space-y-5">
      <header>
        <h1 className="text-[26px] font-extrabold">{t('titre')}</h1>
        <p className="mt-1 text-[14.5px] text-[var(--encre-2)]">{t('sousTitre')}</p>
      </header>
      <div className="card overflow-hidden">
        <MapView
          center={territoire.centre}
          zoom={territoire.zoom_defaut}
          traces={traces}
          markers={departs}
          className="h-64 w-full"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {parcours.map((p) => (
          <ParcoursCard key={p.slug} parcours={p} locale={locale} />
        ))}
      </div>
    </div>
  )
}
