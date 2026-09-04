import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { tx } from '@/lib/i18n-text'
import type { Photo } from '@/lib/types'

/* La galerie d'un lieu. La couverture est déjà en en-tête de fiche :
   on ne la répète pas. Le reste tient dans une grille — deux colonnes
   sur téléphone, trois au large — parce qu'un carrousel cache la
   moitié des images et demande un geste pour rien.

   Chaque crédit est écrit sous sa photo : c'est la contrepartie qu'on
   doit aux établissements qui nous confient les leurs. */
export default function Galerie({
  photos,
  couverture,
  locale,
}: {
  photos: Photo[]
  /** Déjà affichée en en-tête — on la retire de la grille. */
  couverture?: string | null
  locale: string
}) {
  const t = useTranslations('commun')
  const restantes = photos.filter((p) => p.src !== couverture)
  if (!restantes.length) return null
  return (
    <section>
      <h2 className="eyebrow mb-[var(--s2)]">{t('galerie')}</h2>
      <ul className="grid grid-cols-2 gap-[var(--s2)] sm:grid-cols-3">
        {restantes.map((p) => {
          const legende = tx(p.legende, locale)
          return (
            <li key={p.src}>
              <div className="media relative aspect-[4/3] w-full">
                <Image
                  src={p.src}
                  alt={legende}
                  fill
                  sizes="(max-width: 640px) 50vw, 240px"
                  className="object-cover"
                />
              </div>
              {legende ? (
                <p className="mt-1 text-[12px] leading-snug text-[var(--encre-2)]">{legende}</p>
              ) : null}
              {p.credit ? (
                <p className="mt-0.5 text-[var(--t-micro)] text-[var(--encre-3)]">
                  {t('credit', { credit: p.credit })}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
