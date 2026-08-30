import type { ReactNode } from 'react'

/** Le marqueur de section : la balise du sentier, puis le titre.
 *  C'est lui qui donne son rythme à la page — sans caisson. */
export default function SectionHeading({
  titre,
  eyebrow,
  action,
  niveau = 2,
}: {
  titre: string
  eyebrow?: string
  action?: ReactNode
  niveau?: 1 | 2
}) {
  const Titre = niveau === 1 ? 'h1' : 'h2'
  return (
    <div className="mb-[var(--s3)] flex items-end justify-between gap-[var(--s3)]">
      <div className="min-w-0">
        <div className="mb-[var(--s1)] flex items-center gap-[var(--s1)]">
          <span className="balise balise-sm" aria-hidden />
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        </div>
        <Titre className={niveau === 1 ? 't-h1' : 't-h2'}>{titre}</Titre>
      </div>
      {action ? <div className="shrink-0 pb-1">{action}</div> : null}
    </div>
  )
}
