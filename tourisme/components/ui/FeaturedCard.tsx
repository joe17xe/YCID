import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

/** Le traitement éditorial : l'image porte le bloc, le texte s'y pose.
 *  Ni filet ni ombre — la photo suffit. Réservé au contenu prioritaire
 *  (les parcours, le site emblématique). */
export default function FeaturedCard({
  href,
  image,
  titre,
  accroche,
  meta,
  metaMesure,
  chips,
  pied,
  hauteur = 'h-52',
}: {
  href: string
  image?: string | null
  titre: string
  accroche?: string | null
  meta?: string | null
  /** Ligne chiffrée à unités latines : isolée en LTR pour l'arabe. */
  metaMesure?: boolean
  chips?: ReactNode
  pied?: ReactNode
  hauteur?: string
}) {
  return (
    <Link href={href} className="group block">
      <div className={`media relative ${hauteur}`}>
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 380px"
            className="object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(11_23_18/0.78)] via-[rgb(11_23_18/0.18)] to-transparent" />
        {chips ? <div className="absolute start-3 top-3 flex flex-wrap gap-1.5">{chips}</div> : null}
        <div className="absolute inset-x-0 bottom-0 p-[var(--s3)] text-[#f6f4ea]">
          <h3 className="t-h3 clamp-2 leading-tight">{titre}</h3>
          {meta ? (
            <p className={`mono mt-1.5 text-[12px] opacity-90 ${metaMesure ? 'mesure' : ''}`}>
              {meta}
            </p>
          ) : null}
        </div>
      </div>
      {accroche ? (
        <p className="clamp-2 mt-[var(--s2)] text-[var(--t-small)] leading-snug text-[var(--encre-2)]">
          {accroche}
        </p>
      ) : null}
      {pied}
    </Link>
  )
}
