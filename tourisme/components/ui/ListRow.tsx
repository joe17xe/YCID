import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

/** La ligne de liste : le contenu secondaire, en filets plutôt qu'en
 *  caissons. Vignette OU pictogramme, titre, une ligne de contexte,
 *  chevron. C'est elle qui casse l'empilement de cartes. */
export default function ListRow({
  href,
  titre,
  detail,
  vignette,
  icone,
  meta,
  aside,
}: {
  href?: string
  titre: string
  detail?: string | null
  vignette?: string | null
  icone?: ReactNode
  meta?: string | null
  aside?: ReactNode
}) {
  const contenu = (
    <>
      {vignette ? (
        <span className="media relative h-14 w-[68px] shrink-0">
          <Image src={vignette} alt="" fill sizes="68px" className="object-cover" />
        </span>
      ) : icone ? (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--r-media)] bg-[var(--surface-2)] text-[var(--pin)]">
          {icone}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="clamp-2 block text-[15px] font-semibold leading-snug">{titre}</span>
        {detail ? (
          <span className="clamp-1 mt-0.5 block text-[var(--t-micro)] text-[var(--encre-2)]">
            {detail}
          </span>
        ) : null}
        {meta ? (
          <span className="mono mt-1 block text-[11.5px] text-[var(--encre-3)]">{meta}</span>
        ) : null}
      </span>
      {aside ?? (href ? (
        <ChevronRight size={17} className="shrink-0 text-[var(--encre-3)] rtl:-scale-x-100" aria-hidden />
      ) : null)}
    </>
  )
  if (!href) return <div className="ligne-liste">{contenu}</div>
  return (
    <Link href={href} className="ligne-liste">
      {contenu}
    </Link>
  )
}
