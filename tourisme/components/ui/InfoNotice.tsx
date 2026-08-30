import type { ReactNode } from 'react'

/** L'encart d'information terrain : un filet de balise à gauche, pas de
 *  caisson. Trois tons — neutre, vigilance, danger. */
export default function InfoNotice({
  ton = 'neutre',
  titre,
  icone,
  children,
}: {
  ton?: 'neutre' | 'vigilance' | 'danger'
  titre?: string
  icone?: ReactNode
  children: ReactNode
}) {
  const teinte = {
    neutre: { bord: 'var(--pin)', fond: 'var(--surface-2)', texte: 'var(--encre)' },
    vigilance: { bord: 'var(--ocre)', fond: 'var(--ocre-pale)', texte: 'var(--ocre)' },
    danger: { bord: 'var(--danger)', fond: 'var(--danger-pale)', texte: 'var(--danger)' },
  }[ton]
  return (
    <div
      className="rounded-e-[var(--r-media)] border-s-[3px] py-[var(--s2)] pe-[var(--s3)] ps-[var(--s3)]"
      style={{ borderInlineStartColor: teinte.bord, background: teinte.fond }}
    >
      {titre ? (
        <p
          className="mb-1 flex items-center gap-2 text-[13.5px] font-bold"
          style={{ color: teinte.texte }}
        >
          {icone}
          {titre}
        </p>
      ) : null}
      <div className="text-[var(--t-small)] leading-relaxed text-[var(--encre)]">{children}</div>
    </div>
  )
}
