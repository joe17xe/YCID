import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

/** La carte d'action : le seul endroit où l'on garde surface + filet.
 *  Un accent coloré à gauche la distingue d'un simple bloc. */
export default function ActionCard({
  href,
  titre,
  detail,
  icone,
  ton = 'pin',
}: {
  href: string
  titre: string
  detail?: string
  icone: ReactNode
  ton?: 'pin' | 'ocre'
}) {
  const fond = ton === 'ocre' ? 'var(--ocre-pale)' : 'var(--vert-pale)'
  const encre = ton === 'ocre' ? 'var(--ocre)' : 'var(--pin)'
  return (
    <Link href={href} className="card flex items-center gap-[var(--s2)] p-[var(--s3)]">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--r-media)]"
        style={{ background: fond, color: encre }}
      >
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug">{titre}</span>
        {detail ? (
          <span className="clamp-1 mt-0.5 block text-[var(--t-micro)] text-[var(--encre-2)]">
            {detail}
          </span>
        ) : null}
      </span>
      <ChevronRight size={17} className="shrink-0 text-[var(--encre-3)] rtl:-scale-x-100" aria-hidden />
    </Link>
  )
}
