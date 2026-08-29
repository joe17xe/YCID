import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Bed, MessageCircle, Phone, Tent, Users, UtensilsCrossed } from 'lucide-react'
import { getPois, getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'
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
    <div className="space-y-7">
      <header>
        <h1 className="text-[26px] font-extrabold">{t('titre')}</h1>
      </header>

      {/* Le kiosque et son numéro — paramétrables */}
      <section className="card p-4">
        <h2 className="text-[16px] font-bold">{t('kiosqueTitre')}</h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--encre-2)]">{t('kiosqueTexte')}</p>
        {territoire.contact_tel ? (
          <a href={`tel:${territoire.contact_tel}`} className="btn btn-pin mt-3">
            <Phone size={17} aria-hidden /> {territoire.contact_tel}
          </a>
        ) : (
          <p className="mt-2 text-[13px] italic text-[var(--encre-3)]">{t('aucunContact')}</p>
        )}
        {territoire.contact_whatsapp ? (
          <a
            href={`https://wa.me/${territoire.contact_whatsapp.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener"
            className="btn btn-surface ms-2 mt-3"
          >
            <MessageCircle size={17} aria-hidden /> {t('whatsapp')}
          </a>
        ) : null}
      </section>

      {sections
        .filter((s) => s.items.length)
        .map((s) => (
          <section key={s.titre}>
            <h2 className="mb-2.5 flex items-center gap-2 text-[19px] font-bold">
              <s.icone size={19} className="text-[var(--pin)]" aria-hidden /> {s.titre}
            </h2>
            <ul className="space-y-2">
              {s.items.map((p) => (
                <li key={p.slug} className="card p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/explorer/${p.slug}`} className="text-[15px] font-bold">
                        {tx(p.nom, locale)}
                      </Link>
                      <p className="mt-0.5 text-[13px] leading-snug text-[var(--encre-2)]">
                        {tx(p.texte, locale)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {p.contact?.tel ? (
                        <a
                          href={`tel:${p.contact.tel}`}
                          aria-label={t('appeler')}
                          className="grid h-10 w-10 place-items-center rounded-full bg-[var(--vert-pale)] text-[var(--pin)]"
                        >
                          <Phone size={17} aria-hidden />
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
                          <MessageCircle size={17} aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  </div>
                  {['hebergement', 'restaurant'].includes(p.type) ? (
                    <p className="mt-1.5 text-[11.5px] italic text-[var(--encre-3)]">{t('independant')}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}

      <section className="card p-4">
        <h2 className="text-[16px] font-bold">{t('venir')}</h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--encre-2)]">{t('venirTexte')}</p>
      </section>

      <section>
        <h2 className="mb-2.5 text-[19px] font-bold">{t('urgencesTitre')}</h2>
        <div className="space-y-2">
          {territoire.urgences.map((u) => (
            <a
              key={u.tel}
              href={`tel:${u.tel}`}
              className="flex items-center justify-between rounded-2xl border border-[var(--danger)] bg-[var(--danger-pale)] px-4 py-3.5"
            >
              <span className="text-[15px] font-bold">{tx(u.nom, locale)}</span>
              <span className="mono text-[18px] font-bold text-[var(--danger)]">{u.tel}</span>
            </a>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-[var(--encre-3)]">{tc('urgences')} — {tx({ fr: 'dites à quelqu’un où vous allez avant de partir.', ar: 'أخبروا أحدًا إلى أين أنتم ذاهبون قبل الانطلاق.', en: 'tell someone where you are going before you set out.' }, locale)}</p>
      </section>
    </div>
  )
}
