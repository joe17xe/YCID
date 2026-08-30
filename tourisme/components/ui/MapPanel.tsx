import type { ReactNode } from 'react'

/** Le cadre de la carte : rayon faible, filet fin, légende en dessous.
 *  Les contrôles et les attributions de MapLibre restent intacts. */
export default function MapPanel({
  children,
  legende,
  hauteur = 'h-64',
}: {
  children: ReactNode
  legende?: string
  hauteur?: string
}) {
  return (
    <figure className="m-0">
      <div className={`media border border-[var(--ligne)] ${hauteur}`}>{children}</div>
      {legende ? (
        <figcaption className="mt-[var(--s1)] text-[var(--t-micro)] text-[var(--encre-3)]">
          {legende}
        </figcaption>
      ) : null}
    </figure>
  )
}
