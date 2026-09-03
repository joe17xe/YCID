import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Bus, CalendarRange, Car, Info, Mountain, ParkingSquare, Ticket, Waypoints } from 'lucide-react'
import { getEvenements, getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import { formatDuree } from '@/lib/geo'
import ActionCard from '@/components/ui/ActionCard'
import Itineraire from '@/components/ui/Itineraire'
import MapPanel from '@/components/ui/MapPanel'
import MapView from '@/components/carte/MapView'
import SectionHeading from '@/components/ui/SectionHeading'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('venir')
  return { title: t('titre'), description: t('sousTitre') }
}

export default async function PageVenir() {
  const [territoire, evenements, locale, t, tp] = await Promise.all([
    getTerritoire(),
    getEvenements(),
    getLocale(),
    getTranslations('venir'),
    getTranslations('pratique'),
  ])
  const acces = territoire.acces
  // On arrive sur la place, pas au centroïde du village : si l'arrivée
  // n'est pas renseignée, le centre fait un repli honnête.
  const arrivee = acces?.arrivee?.geom ?? territoire.centre
  const nomArrivee = acces?.arrivee ? tx(acces.arrivee.nom, locale) : tx(territoire.nom, locale)
  const saisonniers = evenements.filter((e) => e.recurrent)

  return (
    <div className="space-y-[var(--s5)]">
      <header>
        <SectionHeading titre={t('titre')} niveau={1} />
        <p className="max-w-prose text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
          {t('sousTitre')}
        </p>
      </header>

      {territoire.presentation?.pourquoi ? (
        <section className="bloc courbes p-[var(--s4)]">
          <h2 className="eyebrow mb-[var(--s1)] flex items-center gap-1.5">
            <Mountain size={13} aria-hidden /> {t('pourquoi')}
          </h2>
          <p className="prose-app max-w-prose text-[var(--t-body)] leading-relaxed">
            {tx(territoire.presentation.pourquoi, locale)}
          </p>
        </section>
      ) : null}

      {/* Le trajet : une ligne par porte d'entrée, chiffres à gauche.
          Ce sont des paramètres — la route change, pas le code. */}
      {acces?.depuis?.length ? (
        <section>
          <SectionHeading titre={t('commentSyRendre')} />
          <dl className="border-t border-[var(--ligne)]">
            {acces.depuis.map((d) => {
              const chiffres = [
                d.distance_km != null ? `${d.distance_km} km` : null,
                d.duree_minutes != null ? formatDuree(d.duree_minutes, null, locale) : null,
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <div
                  key={tx(d.ville, locale)}
                  className="flex flex-wrap items-baseline justify-between gap-x-[var(--s3)] gap-y-1 border-b border-[var(--ligne)] py-[var(--s3)]"
                >
                  <dt className="flex items-center gap-2 text-[15px] font-semibold">
                    <Car size={16} className="text-[var(--pin)]" aria-hidden />
                    {t('depuis', { ville: tx(d.ville, locale) })}
                  </dt>
                  {chiffres ? (
                    <dd className="mono mesure shrink-0 text-[14px] font-semibold text-[var(--ocre)]">
                      {chiffres}
                    </dd>
                  ) : null}
                  {d.note ? (
                    <dd className="w-full text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
                      {tx(d.note, locale)}
                    </dd>
                  ) : null}
                </div>
              )
            })}
          </dl>
          <p className="mt-[var(--s2)] text-[var(--t-micro)] leading-relaxed text-[var(--encre-3)]">
            {t('tempsIndicatifs')}
          </p>
        </section>
      ) : null}

      {/* Le point d'arrivée : la carte, les coordonnées, et les liens
          vers l'application de navigation que le visiteur utilise déjà. */}
      <section>
        <SectionHeading titre={t('pointArrivee')} />
        <p className="mb-[var(--s2)] text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
          {nomArrivee}
        </p>
        <MapPanel hauteur="h-56">
          <MapView
            center={arrivee}
            zoom={14.5}
            markers={[{ id: 'arrivee', position: arrivee, label: nomArrivee, kind: 'depart' }]}
            className="h-full w-full"
          />
        </MapPanel>
        <div className="mt-[var(--s3)]">
          <Itineraire geom={arrivee} nom={nomArrivee} />
        </div>
      </section>

      {(acces?.stationnement || acces?.transports) && (
        <section className="space-y-[var(--s3)]">
          {acces.stationnement ? (
            <div>
              <h2 className="eyebrow mb-1 flex items-center gap-1.5">
                <ParkingSquare size={13} aria-hidden /> {t('stationnement')}
              </h2>
              <p className="max-w-prose text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
                {tx(acces.stationnement, locale)}
              </p>
            </div>
          ) : null}
          {acces.transports ? (
            <div>
              <h2 className="eyebrow mb-1 flex items-center gap-1.5">
                <Bus size={13} aria-hidden /> {t('transports')}
              </h2>
              <p className="max-w-prose text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
                {tx(acces.transports, locale)}
              </p>
            </div>
          ) : null}
        </section>
      )}

      {territoire.presentation?.region ? (
        <section>
          <SectionHeading titre={t('laRegion')} />
          <p className="prose-app max-w-prose text-[var(--t-body)] leading-relaxed">
            {tx(territoire.presentation.region, locale)}
          </p>
        </section>
      ) : null}

      {/* Quand venir : les rendez-vous qui reviennent chaque année —
          la migration des cigognes, le trail. Rien d'inventé ici, c'est
          l'agenda saisonnier qui parle. */}
      {saisonniers.length ? (
        <section>
          <SectionHeading titre={t('quandVenir')} />
          <dl className="border-t border-[var(--ligne)]">
            {saisonniers.map((e) => (
              <div key={e.slug} className="border-b border-[var(--ligne)] py-[var(--s3)]">
                <dt className="mb-1 flex items-center gap-2 text-[13px] font-bold">
                  <CalendarRange size={16} className="text-[var(--pin)]" aria-hidden />
                  {tx(e.nom, locale)}
                </dt>
                <dd className="text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
                  {tx(e.description, locale)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="space-y-[var(--s2)]">
        <SectionHeading titre={t('surPlace')} />
        <p className="max-w-prose text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
          {t('surPlaceTexte')}
        </p>
        <ActionCard
          href="/reserver"
          titre={t('voirReserver')}
          icone={<Ticket size={19} aria-hidden />}
        />
        <ActionCard
          href="/parcours"
          titre={t('voirParcours')}
          icone={<Waypoints size={19} aria-hidden />}
        />
        <ActionCard
          href="/pratique"
          titre={t('voirPratique')}
          detail={tp('kiosqueTexte')}
          icone={<Info size={19} aria-hidden />}
          ton="ocre"
        />
      </section>
    </div>
  )
}
