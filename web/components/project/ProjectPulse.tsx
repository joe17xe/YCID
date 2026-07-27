import Link from "next/link"
import { AlertTriangle, BadgeCheck } from "lucide-react"

// ============================================================
// Le pouls du projet — une rangée de tuiles KPI
// ============================================================
// Première version le 27/07 au matin, refaite le soir même après le
// retour d'écran : « les boutons sont un texte avec des chiffres, ça
// n'a rien à voir avec de vrais KPI ». Le reproche était juste — les
// tuiles empilaient trois lignes de texte de même poids, sans
// hiérarchie ni marque.
//
// Anatomie d'une tuile, désormais fixe :
//   · un libellé court, en petit et en gris, précédé d'une pastille de
//     couleur qui porte l'identité (engagé = bleu, payé = vert…) — la
//     COULEUR est sur la marque, jamais sur le texte ;
//   · la valeur, seule ligne en gras et en grand, en encre ;
//   · pour les montants, une jauge dont la piste est une marche claire
//     de la MÊME gamme que le remplissage — pas un gris neutre — pour
//     que l'état se lise sur toute la barre ;
//   · le complément, en dessous, en retrait.
//
// Les tuiles d'alerte (retard, à valider) portent icône + libellé +
// teinte : jamais la couleur seule. Et elles n'apparaissent QUE si
// elles ont quelque chose à dire — un « 0 en retard » permanent apprend
// à ne plus regarder l'endroit où le 1 apparaîtra.

export interface PulseProps {
  progress: number
  voted: number | null
  planned: number
  engaged: number
  paid: number
  lateTasks: number
  openTasks: number
  myDecisions: number
  nextDeadline: { title: string; date: string; days: number } | null
}

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`

// Jauge : piste dans une marche claire de la même gamme que le
// remplissage (vert sur vert pâle, bleu sur bleu pâle).
function Meter({ pct, fill, track }: { pct: number; fill: string; track: string }) {
  return (
    <div className="h-1 rounded-full overflow-hidden mt-2" style={{ background: track }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: fill }} />
    </div>
  )
}

function Tile({ mark, label, value, sub, meter }: {
  mark: string; label: string; value: string; sub?: string
  meter?: { pct: number; fill: string; track: string }
}) {
  return (
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
}

// Tuile d'état : teinte + icône + libellé, jamais la couleur seule.
function AlertTile({ icon, label, value, sub, deep, bg, border, href }: {
  icon: React.ReactNode; label: string; value: string; sub: string
  deep: string; bg: string; border: string; href?: string
}) {
  const body = (
    <div className="rounded-2xl border p-3 h-full" style={{ background: bg, borderColor: border }}>
      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: deep }}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl font-semibold mt-1 leading-none" style={{ color: deep, fontFamily: "var(--font-sora)" }}>
        {value}
      </div>
      <div className="text-[11px] mt-1.5 truncate" style={{ color: deep, opacity: 0.85 }}>{sub}</div>
    </div>
  )
  return href ? <Link href={href} className="block h-full">{body}</Link> : body
}

export default function ProjectPulse({
  progress, voted, planned, engaged, paid, lateTasks, openTasks, myDecisions, nextDeadline,
}: PulseProps) {
  // La référence est le montant VOTÉ quand il existe : c'est lui que le
  // financeur a accordé. À défaut, le prévu réparti — dire « 0 % engagé »
  // faute de montant voté serait faux.
  const base = voted && voted > 0 ? voted : planned
  const engagedPct = base > 0 ? Math.round((engaged / base) * 100) : 0
  const paidPct = base > 0 ? Math.round((paid / base) * 100) : 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-6">
      <Tile label="Avancement" value={`${progress} %`} mark="var(--brand-accent,#0E6B5C)"
        meter={{ pct: progress, fill: "var(--brand-accent,#0E6B5C)", track: "var(--brand-accent-soft,#E4F0EC)" }}
        sub={openTasks > 0 ? `${openTasks} tâche${openTasks > 1 ? "s" : ""} en cours` : "aucune tâche ouverte"} />

      <Tile label="Engagé" value={fmtEur(engaged)} mark="#3B5488"
        meter={base > 0 ? { pct: engagedPct, fill: "#3B5488", track: "#E8ECF5" } : undefined}
        sub={base > 0 ? `${engagedPct} % de ${fmtEur(base)}` : "aucun budget de référence"} />

      <Tile label="Payé" value={fmtEur(paid)} mark="var(--brand-accent,#0E6B5C)"
        meter={base > 0 ? { pct: paidPct, fill: "var(--brand-accent,#0E6B5C)", track: "var(--brand-accent-soft,#E4F0EC)" } : undefined}
        sub={`reste ${fmtEur(Math.max(0, engaged - paid))} à régler`} />

      {lateTasks > 0 && (
        <AlertTile icon={<AlertTriangle size={13} aria-hidden="true" />} label="En retard"
          value={String(lateTasks)} sub={lateTasks > 1 ? "tâches dépassées" : "tâche dépassée"}
          deep="#A3342C" bg="#FBEAEA" border="#F0CBC7" />
      )}

      {myDecisions > 0 && (
        <AlertTile icon={<BadgeCheck size={13} aria-hidden="true" />} label="À valider"
          value={String(myDecisions)} sub="décision attendue de vous →"
          deep="#8A6A1F" bg="#FBF0E0" border="#E8D5AE" href="/a-valider" />
      )}

      {nextDeadline && (
        <Tile label="Prochaine échéance" mark={nextDeadline.days < 0 ? "#A3342C" : "#66716B"}
          value={nextDeadline.days < 0
            ? `${Math.abs(nextDeadline.days)} j de retard`
            : nextDeadline.days === 0 ? "aujourd’hui" : `dans ${nextDeadline.days} j`}
          sub={nextDeadline.title} />
      )}
    </div>
  )
}
