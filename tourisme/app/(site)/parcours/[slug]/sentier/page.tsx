import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { getParcoursBySlug, getPois, getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import SentierMode from '@/components/SentierMode'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('sentier')
  return { title: t('titre') }
}

export default async function PageSentier(props: PageProps<'/parcours/[slug]/sentier'>) {
  const { slug } = await props.params
  const [parcours, pois, territoire, locale] = await Promise.all([
    getParcoursBySlug(slug),
    getPois(),
    getTerritoire(),
    getLocale(),
  ])
  if (!parcours || !parcours.trace || parcours.acces_guide) notFound()

  const etapes = parcours.etapes
    .map((s) => pois.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p, i) => ({
      slug: p.slug,
      nom: tx(p.nom, locale),
      position: p.geom,
      panneau: p.panneau_no ?? i + 1,
    }))

  return (
    <SentierMode
      nom={tx(parcours.nom, locale)}
      slug={parcours.slug}
      trace={parcours.trace}
      etapes={etapes}
      urgences={territoire.urgences}
      locale={locale}
      centre={parcours.depart ?? territoire.centre}
    />
  )
}
