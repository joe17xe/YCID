import Link from 'next/link'

/** Les étapes en FIL DE SENTIER : un trait en pointillés qui rejoue la
 *  trace de la carte, avec les numéros des panneaux plantés dessus.
 *  Remplace la pile de cartes identiques. */
export default function Waypoints({
  etapes,
}: {
  etapes: { slug: string; nom: string; numero: number }[]
}) {
  return (
    <ol className="relative ms-3 border-s-2 border-dashed border-[var(--ligne-forte)] ps-[var(--s4)]">
      {etapes.map((e) => (
        <li key={e.slug} className="relative py-[var(--s2)]">
          <span
            className="mono absolute -start-[calc(var(--s4)+13px)] top-[calc(var(--s2)+1px)] grid h-6 w-6 place-items-center rounded-full bg-[var(--pin)] text-[11.5px] font-bold text-[var(--sur-pin)] ring-4 ring-[var(--fond)]"
            aria-hidden
          >
            {e.numero}
          </span>
          <Link
            href={`/explorer/${e.slug}`}
            className="block text-[15px] font-semibold leading-snug hover:text-[var(--pin)]"
          >
            {e.nom}
          </Link>
        </li>
      ))}
    </ol>
  )
}
