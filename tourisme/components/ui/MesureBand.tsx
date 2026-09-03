/** Les chiffres clés en BANDE à filets, pas en tuiles encadrées : le
 *  registre du carnet de terrain plutôt que celui du tableau de bord.
 *  Mesures en chiffres tabulaires, libellés en petites capitales. */
export type Mesure = {
  v: string
  l: string
  accent?: boolean
  /** Valeur chiffrée à unité latine : isolée en LTR pour l'arabe. */
  mesure?: boolean
}

export default function MesureBand({ mesures }: { mesures: Mesure[] }) {
  return (
    <dl className="flex items-stretch border-y border-[var(--ligne)] py-[var(--s2)]">
      {mesures.map((m, i) => (
        <div
          key={m.l}
          className={
            'min-w-0 flex-1 px-1 text-center ' + (i > 0 ? 'border-s border-[var(--ligne)]' : '')
          }
        >
          {/* Les mesures s'enroulent plutôt que de pousser la page :
              à 320 px, « 2 h 30 – 3 h » passe sur deux lignes. */}
          <dd
            className={
              'mono text-[13.5px] font-semibold leading-[1.25] [overflow-wrap:anywhere] sm:text-[15px] ' +
              (m.mesure ? 'mesure ' : '') +
              (m.accent ? 'text-[var(--ocre)]' : 'text-[var(--encre)]')
            }
          >
            {m.v}
          </dd>
          <dt className="mt-1 text-[10px] uppercase leading-tight tracking-[0.06em] text-[var(--encre-3)] sm:text-[10.5px]">
            {m.l}
          </dt>
        </div>
      ))}
    </dl>
  )
}
