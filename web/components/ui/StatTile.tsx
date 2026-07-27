import Link from "next/link"

// ============================================================
// Tuile KPI — l'anatomie unique
// ============================================================
// Née dans le pouls du projet (27/07), extraite ici le jour même quand
// l'accueil, le pilotage et l'onglet budget ont dû adopter le même
// langage. Quatre écrans qui recopient une mise en forme divergent
// aussi sûrement que quatre copies d'une règle de droits — même
// remède : une seule définition.
//
// Anatomie, fixe :
//   · libellé court, petit et gris, précédé d'une PASTILLE de couleur
//     qui porte l'identité — la couleur vit sur la marque, jamais sur
//     le texte ;
//   · la valeur, seule ligne en gras, en encre ;
//   · jauge facultative, dont la piste est une marche claire de la
//     MÊME gamme que le remplissage — l'état se lit sur toute la
//     barre, pas seulement la partie remplie ;
//   · complément facultatif, en retrait.
//
// La variante d'alerte porte teinte + icône + libellé : jamais la
// couleur seule. À zéro, on ne la montre pas — ou l'écran qui a besoin
// d'une grille stable affiche la tuile neutre : un zéro criard en
// permanence apprend à ne plus regarder l'endroit où le 1 apparaîtra.

export interface MeterSpec { pct: number; fill: string; track: string }

export function Meter({ pct, fill, track }: MeterSpec) {
  return (
    <div className="h-1 rounded-full overflow-hidden mt-2" style={{ background: track }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: fill }} />
    </div>
  )
}

export function StatTile({ mark, label, value, sub, meter, href }: {
  mark: string; label: string; value: string | number; sub?: string
  meter?: MeterSpec; href?: string
}) {
  const body = (
    <div className="rounded-2xl border bg-white p-3 h-full" style={{ borderColor: "#E3E6E2" }}>
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#66716B" }}>
        <span aria-hidden="true" className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: mark }} />
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl font-semibold mt-1 leading-none" style={{ color: "#17211D", fontFamily: "var(--font-sora)" }}>
        {value}
      </div>
      {meter && <Meter {...meter} />}
      {sub && <div className="text-[11px] mt-1.5 truncate" style={{ color: "#9AA39D" }}>{sub}</div>}
    </div>
  )
  return href ? <Link href={href} className="block h-full">{body}</Link> : body
}

const TONES = {
  danger: { deep: "#A3342C", bg: "#FBEAEA", border: "#F0CBC7" },
  warning: { deep: "#8A6A1F", bg: "#FBF0E0", border: "#E8D5AE" },
} as const

export function AlertStatTile({ icon, label, value, sub, tone, href }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string
  tone: keyof typeof TONES; href?: string
}) {
  const { deep, bg, border } = TONES[tone]
  const body = (
    <div className="rounded-2xl border p-3 h-full" style={{ background: bg, borderColor: border }}>
      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: deep }}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl font-semibold mt-1 leading-none" style={{ color: deep, fontFamily: "var(--font-sora)" }}>
        {value}
      </div>
      {sub && <div className="text-[11px] mt-1.5 truncate" style={{ color: deep, opacity: 0.85 }}>{sub}</div>}
    </div>
  )
  return href ? <Link href={href} className="block h-full">{body}</Link> : body
}
