import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { CalendarRange, ChevronLeft, PackageCheck, Waypoints } from 'lucide-react'
import { getFormuleBySlug, getFormules, getParcours, getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import { dureeFormule, participantsFormule, tarifFormule } from '@/lib/formule'
import DemandeForm from '@/components/reserver/DemandeForm'
import FormuleCard from '@/components/reserver/FormuleCard'
import ListRow from '@/components/ui/ListRow'
import MesureBand, { type Mesure } from '@/components/ui/MesureBand'
import SectionHeading from '@/components/ui/SectionHeading'
import type { Locale } from '@/lib/types'

export async function generateMetadata(props: PageProps<'/reserver/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params
  const [formule, locale] = await Promise.all([getFormuleBySlug(slug), getLocale()])
  if (!formule) return {}
  return { title: tx(formule.nom, locale), description: tx(formule.accroche, locale) || undefined }
}

export default async function FicheFormule(props: PageProps<'/reserver/[slug]'>) {
  const { slug } = await props.params
  const [formule, toutes, parcours, territoire, locale, t, tc] = await Promise.all([
    getFormuleBySlug(slug),
    getFormules(),
    getParcours(),
    getTerritoire(),
    getLocale(),
    getTranslations('reserver'),
    getTranslations('commun'),
  ])
  if (!formule) notFound()

  const td = await getTranslations('commun.difficulte')
  const lies = formule.parcours_slugs
    .map((s) => parcours.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  const autres = toutes.filter((f) => f.slug !== formule.slug).slice(0, 2)

  const duree = dureeFormule(formule, locale)
  const gens = participantsFormule(formule, t)
  const tarif = tarifFormule(formule, locale, t)
  const mesures: Mesure[] = []
  if (duree) mesures.push({ v: duree, l: t('duree'), mesure: true })
  if (gens) mesures.push({ v: gens, l: t('participants') })
  if (formule.niveau) mesures.push({ v: td(formule.niveau), l: tc('niveau'), accent: true })
  mesures.push({
    v: tarif.unite ? `${tarif.valeur} / ${tarif.unite}` : tarif.valeur,
    l: t('tarif'),
  })

  // « new Date() » au rendu serait impur : la date du jour se calcule ici,
  // une fois par requête, et voyage dans les props du formulaire.
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const marque = territoire.marque ?? tx(territoire.nom, locale)

  return (
    <article className="space-y-[var(--s5)]">
      <header>
        <Link
          href="/reserver"
          className="mb-[var(--s2)] inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--encre-2)]"
        >
          <ChevronLeft size={15} className="rtl:-scale-x-100" aria-hidden />
          {t('titre')}
        </Link>
        {formule.photo ? (
          <div className="media relative mb-[var(--s3)] h-52 w-full">
            <Image
              src={formule.photo}
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
        ) : null}
        <span className="chip">{t(`categorie.${formule.categorie}`)}</span>
        <h1 className="t-h1 mt-[var(--s2)] leading-tight">{tx(formule.nom, locale)}</h1>
        {formule.accroche ? (
          <p className="mt-1.5 max-w-prose text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
            {tx(formule.accroche, locale)}
          </p>
        ) : null}
      </header>

      <MesureBand mesures={mesures} />

      {formule.description ? (
        <section className="prose-app max-w-prose text-[var(--t-body)] leading-relaxed">
          <p>{tx(formule.description, locale)}</p>
        </section>
      ) : null}

      {formule.inclus || formule.saison ? (
        <section className="bloc courbes space-y-[var(--s3)] p-[var(--s4)]">
          {formule.inclus ? (
            <div>
              <h2 className="eyebrow mb-1 flex items-center gap-1.5">
                <PackageCheck size={13} aria-hidden /> {t('inclus')}
              </h2>
              <p className="text-[var(--t-small)] leading-relaxed text-[var(--encre)]">
                {tx(formule.inclus, locale)}
              </p>
            </div>
          ) : null}
          {formule.saison ? (
            <div>
              <h2 className="eyebrow mb-1 flex items-center gap-1.5">
                <CalendarRange size={13} aria-hidden /> {t('quand')}
              </h2>
              <p className="text-[var(--t-small)] leading-relaxed text-[var(--encre)]">
                {tx(formule.saison, locale)}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {lies.length ? (
        <section>
          <SectionHeading titre={t('leParcours')} />
          <div>
            {lies.map((p) => (
              <ListRow
                key={p.slug}
                href={`/parcours/${p.slug}`}
                vignette={p.photo}
                icone={p.photo ? undefined : <Waypoints size={18} aria-hidden />}
                titre={tx(p.nom, locale)}
                detail={tx(p.accroche, locale)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <DemandeForm
        formuleId={formule.id ?? null}
        formuleNom={tx(formule.nom, locale)}
        territoireId={territoire.id ?? null}
        marque={marque}
        tel={territoire.contact_tel ?? null}
        whatsapp={territoire.contact_whatsapp ?? null}
        email={territoire.contact_email ?? null}
        locale={locale as Locale}
        aujourdhui={aujourdhui}
        participantsDefaut={formule.participants_min ?? 2}
      />

      {autres.length ? (
        <section>
          <SectionHeading titre={t('autresFormules')} />
          <div className="grid gap-[var(--s3)] sm:grid-cols-2">
            {autres.map((f) => (
              <FormuleCard key={f.slug} formule={f} locale={locale as Locale} t={t} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  )
}
