import { AlertTriangle, BadgeCheck } from "lucide-react"
import { StatTile, AlertStatTile } from "@/components/ui/StatTile"

// ============================================================
// Le pouls du projet — une rangée de tuiles KPI
// ============================================================
// Les quatre questions qu'on se pose en ouvrant un projet, et elles
// seulement : où en est-on, l'argent suit-il, quelque chose glisse-t-il,
// une décision m'attend-elle. L'anatomie des tuiles vit dans
// components/ui/StatTile — partagée avec l'accueil, le pilotage et
// l'onglet budget, pour que le même chiffre se lise partout pareil.
//
// Les tuiles d'alerte n'apparaissent QUE si elles ont quelque chose à
// dire : les autres tuiles restent, la rangée respire.

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

const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`

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
      <StatTile label="Avancement" value={`${progress} %`} mark="var(--brand-accent,#0E6B5C)"
        meter={{ pct: progress, fill: "var(--brand-accent,#0E6B5C)", track: "var(--brand-accent-soft,#E4F0EC)" }}
        sub={openTasks > 0 ? `${openTasks} tâche${openTasks > 1 ? "s" : ""} en cours` : "aucune tâche ouverte"} />

      <StatTile label="Engagé" value={fmtEur(engaged)} mark="#3B5488"
        meter={base > 0 ? { pct: engagedPct, fill: "#3B5488", track: "#E8ECF5" } : undefined}
        sub={base > 0 ? `${engagedPct} % de ${fmtEur(base)}` : "aucun budget de référence"} />

      <StatTile label="Payé" value={fmtEur(paid)} mark="var(--brand-accent,#0E6B5C)"
        meter={base > 0 ? { pct: paidPct, fill: "var(--brand-accent,#0E6B5C)", track: "var(--brand-accent-soft,#E4F0EC)" } : undefined}
        sub={`reste ${fmtEur(Math.max(0, engaged - paid))} à régler`} />

      {lateTasks > 0 && (
        <AlertStatTile icon={<AlertTriangle size={13} aria-hidden="true" />} label="En retard"
          value={String(lateTasks)} sub={lateTasks > 1 ? "tâches dépassées" : "tâche dépassée"}
          tone="danger" />
      )}

      {myDecisions > 0 && (
        <AlertStatTile icon={<BadgeCheck size={13} aria-hidden="true" />} label="À valider"
          value={String(myDecisions)} sub="décision attendue de vous →"
          tone="warning" href="/a-valider" />
      )}

      {nextDeadline && (
        <StatTile label="Prochaine échéance" mark={nextDeadline.days < 0 ? "#A3342C" : "#66716B"}
          value={nextDeadline.days < 0
            ? `${Math.abs(nextDeadline.days)} j de retard`
            : nextDeadline.days === 0 ? "aujourd’hui" : `dans ${nextDeadline.days} j`}
          sub={nextDeadline.title} />
      )}
    </div>
  )
}
