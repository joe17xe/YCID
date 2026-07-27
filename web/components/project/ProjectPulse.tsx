import Link from "next/link"

// ============================================================
// Le pouls du projet
// ============================================================
// Constat du 27/07, capture à l'appui : en haut d'un projet, on lisait
// « Avancement global 6 % » et rien d'autre. Un pourcentage seul ne dit
// ni si l'argent suit, ni si quelque chose est en retard, ni si une
// décision attend quelqu'un. Il occupait pourtant toute la largeur.
//
// Ce bandeau répond aux quatre questions qu'on se pose en ouvrant un
// projet — et à elles seulement. Chaque tuile qui n'a rien à dire
// disparaît : un « 0 en retard » affiché en permanence apprend à ne plus
// regarder l'endroit où le 1 apparaîtra.

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

function Tile({ label, value, sub, color, bg, href }: {
  label: string; value: string; sub?: string; color: string; bg?: string; href?: string
}) {
  const inner = (
    <div className="rounded-2xl border p-3 h-full" style={{ borderColor: "#E3E6E2", background: bg ?? "#FFFFFF" }}>
      <div className="text-xs" style={{ color: "#66716B" }}>{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color, fontFamily: "var(--font-sora)" }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "#66716B" }}>{sub}</div>}
    </div>
  )
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner
}

export default function ProjectPulse({
  progress, voted, planned, engaged, paid, lateTasks, openTasks, myDecisions, nextDeadline,
}: PulseProps) {
  // La référence est le montant VOTÉ quand il existe : c'est lui que le
  // financeur a accordé. À défaut, le prévu réparti — dire « 0 % engagé »
  // faute de montant voté serait faux.
  const base = voted && voted > 0 ? voted : planned
  const engagedPct = base > 0 ? Math.round((engaged / base) * 100) : 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-6">
      <Tile label="Avancement" value={`${progress} %`} color="#17211D"
        sub={openTasks > 0 ? `${openTasks} tâche${openTasks > 1 ? "s" : ""} en cours` : "aucune tâche ouverte"} />

      <Tile label="Engagé" value={fmtEur(engaged)} color="#3B5488"
        sub={base > 0 ? `${engagedPct} % de ${fmtEur(base)}` : "aucun budget de référence"} />

      <Tile label="Payé" value={fmtEur(paid)} color="var(--brand-accent,#0E6B5C)"
        sub={`reste ${fmtEur(Math.max(0, engaged - paid))} à régler`} />

      {/* Une tuile qui affiche zéro en permanence est une tuile qu'on
          cesse de regarder. Celle-ci n'apparaît que s'il y a un retard. */}
      {lateTasks > 0 && (
        <Tile label="En retard" value={String(lateTasks)} color="#A3342C" bg="#FBEAEA"
          sub={lateTasks > 1 ? "tâches dépassées" : "tâche dépassée"} />
      )}

      {myDecisions > 0 && (
        <Tile label="À valider" value={String(myDecisions)} color="#FFFFFF" bg="#B4690E"
          sub="décision attendue de vous" href="/a-valider" />
      )}

      {nextDeadline && (
        <Tile
          label="Prochaine échéance"
          value={nextDeadline.days < 0
            ? `${Math.abs(nextDeadline.days)} j de retard`
            : nextDeadline.days === 0 ? "aujourd’hui" : `dans ${nextDeadline.days} j`}
          color={nextDeadline.days < 0 ? "#A3342C" : "#17211D"}
          sub={nextDeadline.title} />
      )}
    </div>
  )
}
