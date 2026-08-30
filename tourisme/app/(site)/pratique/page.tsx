import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Bed, MessageCircle, Phone, Tent, Users, UtensilsCrossed } from 'lucide-react'
import { getPois, getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
import ListRow from '@/components/ui/ListRow'
import SectionHeading from '@/components/ui/SectionHeading'
import type { Poi } from '@/lib/types'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pratique')
  return { title: t('titre') }
}

export default async function PagePratique() {
  const [territoire, pois, locale, t, tc] = await Promise.all([
    getTerritoire(),
    getPois(),
    getLocale(),
    getTranslations('pratique'),
    getTranslations('commun'),
  ])
  const par = (type: Poi['type']) => pois.filter((p) => p.type === type)
  const sections: { titre: string; icone: typeof Bed; items: Poi[] }[] = [
    { titre: t('dormir'), icone: Bed, items: par('hebergement') },
    { titre: t('camper'), icone: Tent, items: par('camping') },
    { titre: t('manger'), icone: UtensilsCrossed, items: par('restaurant') },
    { titre: t('guides'), icone: Users, items: par('guide') },
  ]
  return (
    <div className="space-y-[var(--s5)]">
      <SectionHeading titre={t('titre')} niveau={1} />

      {/* Le kiosque et son numéro : la seule carte d'action de la page. */}
      <section className="card p-[var(--s4)]">
        <h2 className="t-h3">{t('kiosqueTitre')}</h2>
        <p className="mt-1.5 text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
          {t('kiosqueTexte')}
        </p>
        <div className="mt-[var(--s3)] flex flex-wrap gap-[var(--s2)]">
          {territoire.contact_tel ? (
            <a href={`tel:${territoire.contact_tel.replace(/\s/g, '')}`} className="btn btn-pin">
              <Phone size={17} aria-hidden />
              <span className="mono">{territoire.contact_tel}</span>
            </a>
          ) : (
            <p className="text-[13px] italic text-[var(--encre-3)]">{t('aucunContact')}</p>
          )}
          {territoire.contact_whatsapp ? (
            <a
              href={`https://wa.me/${territoire.contact_whatsapp.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener"
              className="btn btn-surface"
            >
              <MessageCircle size={17} aria-hidden /> {t('whatsapp')}
            </a>
          ) : null}
        </div>
      </section>

      {sections
        .filter((s) => s.items.length)
        .map((s) => (
          <section key={s.titre}>
            <SectionHeading titre={s.titre} />
            <div>
              {s.items.map((p) => (
                <ListRow
                  key={p.slug}
                  href={`/explorer/${p.slug}`}
                  icone={<s.icone size={18} aria-hidden />}
                  titre={tx(p.nom, locale)}
                  detail={tx(p.texte, locale)}
                  meta={['hebergement', 'restaurant'].includes(p.type) ? t('independant') : null}
                  aside={
                    p.contact?.whatsapp || p.contact?.tel ? (
                      <span className="flex shrink-0 gap-1.5">
                        {p.contact?.tel ? (
                          <a
                            href={`tel:${p.contact.tel}`}
                            aria-label={t('appeler')}
                            className="grid h-10 w-10 place-items-center rounded-full bg-[var(--vert-pale)] text-[var(--pin)]"
                          >
                            <Phone size={16} aria-hidden />
                          </a>
                        ) : null}
                        {p.contact?.whatsapp ? (
                          <a
                            href={`https://wa.me/${p.contact.whatsapp.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener"
                            aria-label={t('whatsapp')}
                            className="grid h-10 w-10 place-items-center rounded-full bg-[var(--pin)] text-[var(--sur-pin)]"
                          >
                            <MessageCircle size={16} aria-hidden />
                          </a>
                        ) : null}
                      </span>
                    ) : undefined
                  }
                />
              ))}
            </div>
          </section>
        ))}

      <section className="bloc courbes p-[var(--s4)]">
        <h2 className="t-h3">{t('venir')}</h2>
        <p className="mt-1.5 text-[var(--t-small)] leading-relaxed text-[var(--encre-2)]">
          {t('venirTexte')}
        </p>
      </section>

      {/* Les urgences : sobres mais impossibles à manquer. */}
      <section>
        <SectionHeading titre={t('urgencesTitre')} />
        <div className="overflow-hidden rounded-[var(--r-media)] border border-[var(--danger)]">
          {territoire.urgences.map((u, i) => (
            <a
              key={u.tel}
              href={`tel:${u.tel}`}
              className={
                'flex items-center justify-between gap-[var(--s2)] bg-[var(--danger-pale)] px-[var(--s3)] py-[var(--s3)] ' +
                (i > 0 ? 'border-t border-[var(--danger)]/30' : '')
              }
            >
              <span className="text-[15px] font-semibold">{tx(u.nom, locale)}</span>
              <span className="mono text-[18px] font-bold text-[var(--danger)]">{u.tel}</span>
            </a>
          ))}
        </div>
        <p className="mt-[var(--s2)] text-[var(--t-micro)] text-[var(--encre-3)]">
          {tc('urgences')} —{' '}
          {tx(
            {
              fr: 'dites à quelqu’un où vous allez avant de partir.',
              ar: 'أخبروا أحدًا إلى أين أنتم ذاهبون قبل الانطلاق.',
              en: 'tell someone where you are going before you set out.',
            },
            locale,
          )}
        </p>
      </section>
    </div>
  )
}
