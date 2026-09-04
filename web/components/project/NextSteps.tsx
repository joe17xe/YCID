import Link from "next/link"
import Foldable from "@/components/ui/Foldable"

// ============================================================
// Prochaines étapes
// ============================================================
// Le détail par phase répond à « comment le projet est-il découpé ». Il
// ne répond pas à « que dois-je faire, et qu'est-ce qui glisse » : pour
// le savoir il fallait déplier chaque phase et comparer les dates de
// tête. Sur sept tâches c'est fastidieux ; sur trente, personne ne le
// fait.
//
// Cette liste traverse les phases et trie par urgence réelle. Elle ne
// remplace pas le détail — elle donne l'ordre dans lequel l'ouvrir.
//
// REPLIABLE (retour de recette du 04/09). Sur téléphone, huit étapes
// occupent l'écran entier et repoussent les ACTIONS hors de vue : « les
// utilisateurs veulent aller sur les actions pour agir ». Une liste qui
// aide à choisir ne doit pas empêcher de faire.
//
// Le pliage lui-même est celui de tous les blocs denses de l'outil —
// voir components/ui/Foldable.tsx, qui porte le motif, le stockage de
// la préférence et l'absence de clignotement au chargement.

export interface StepTask {
  id: string
  title: string
  phaseName: string
  ownerName: string | null
  ownerIsMe: boolean
  endDate: string | null
  status: string
  progress: number
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })

// Écart en jours pleins, indépendant de l'heure : comparer des
// timestamps ferait basculer « aujourd'hui » en « hier » à midi.
export function daysUntil(date: string, today: string): number {
  const a = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
  const b = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))
  return Math.round((a - b) / 86400000)
}

function Row({ t, today }: { t: StepTask; today: string }) {
  const d = t.endDate ? daysUntil(t.endDate, today) : null
  const late = d != null && d < 0
  const soon = d != null && d >= 0 && d <= 7
  return (
    <li className="py-2.5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium" style={{ color: "#17211D" }}>{t.title}</div>
        <div className="text-xs mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ color: "#66716B" }}>
          <span>{t.phaseName}</span>
          <span aria-hidden="true">·</span>
          {/* Le responsable n'est pas un détail : une tâche sans nom en
              face est une tâche que personne ne fera. On le dit plutôt
              que de laisser un blanc. */}
          {t.ownerName
            ? <span style={{ color: t.ownerIsMe ? "var(--brand-accent,#0E6B5C)" : "#66716B", fontWeight: t.ownerIsMe ? 600 : 400 }}>
                {t.ownerIsMe ? "vous" : t.ownerName}
              </span>
            : <span style={{ color: "#B4690E" }}>sans responsable</span>}
          {t.progress > 0 && t.progress < 100 && <><span aria-hidden="true">·</span><span>{t.progress} %</span></>}
        </div>
      </div>
      <div className="text-xs whitespace-nowrap flex-shrink-0 text-right">
        {d == null ? (
          <span style={{ color: "#9AA39D" }}>sans échéance</span>
        ) : (
          <span className="px-2 py-1 rounded-lg font-medium" style={
            late ? { background: "#FBEAEA", color: "#A3342C" }
            : soon ? { background: "#F7EDDD", color: "#8A6A1F" }
            : { background: "#EEF0EE", color: "#66716B" }
          }>
            {late ? `${Math.abs(d)} j de retard` : d === 0 ? "aujourd’hui" : `${fmtDate(t.endDate!)}`}
          </span>
        )}
      </div>
    </li>
  )
}

export default function NextSteps({ tasks, today, projectId, limit = 6, collapsedOnMobile = false }: {
  tasks: StepTask[]; today: string; projectId: string; limit?: number
  // Vrai là où la liste PRÉCÈDE ce qu'on est venu faire — l'onglet
  // Tâches, dont les actions sont juste en dessous. Sur l'Aperçu, elle
  // est le contenu de l'écran : elle reste dépliée.
  collapsedOnMobile?: boolean
}) {
  // Ce qui est fait ne fait pas partie des prochaines étapes.
  const ongoing = tasks.filter(t => t.status !== "terminee")

  // En retard d'abord, du plus ancien au plus récent — un dépassement de
  // trois semaines passe avant un dépassement d'hier. Puis les échéances
  // à venir, au plus proche. Les tâches sans date ferment la marche :
  // elles n'ont pas d'urgence, seulement une absence.
  const rank = (t: StepTask) => {
    if (!t.endDate) return [2, 0] as const
    const d = daysUntil(t.endDate, today)
    return [d < 0 ? 0 : 1, d] as const
  }
  const sorted = [...ongoing].sort((a, b) => {
    const [ga, da] = rank(a); const [gb, db] = rank(b)
    return ga !== gb ? ga - gb : da - db
  })

  const mine = sorted.filter(t => t.ownerIsMe)
  const lateCount = sorted.filter(t => t.endDate && daysUntil(t.endDate, today) < 0).length
  const shown = sorted.slice(0, limit)
  const rest = sorted.length - shown.length

  if (!sorted.length) {
    return (
      <div className="bg-white rounded-2xl border p-6" style={{ borderColor: "#E3E6E2" }}>
        <h2 className="font-semibold mb-1" style={{ fontFamily: "var(--font-sora)", color: "#17211D" }}>Prochaines étapes</h2>
        <p className="text-sm" style={{ color: "#66716B" }}>
          Aucune tâche ouverte. Tout est terminé, ou rien n’est encore planifié.
        </p>
      </div>
    )
  }

  return (
    <Foldable
      className="overflow-hidden"
      title="Prochaines étapes"
      /* Le compte reste lisible REPLIÉ : replier escamote le détail,
         jamais l'alerte. */
      badge={
        <span className="text-xs font-normal" style={{ color: "#66716B" }}>
          {sorted.length}
          {lateCount > 0 && <span style={{ color: "#A3342C", fontWeight: 600 }}> · {lateCount} en retard</span>}
        </span>
      }
      summary={mine.length > 0
        ? `${mine.length} vous ${mine.length > 1 ? "sont assignées" : "est assignée"}.`
        : undefined}
      actions={
        <Link href={`/projets/${projectId}?tab=taches`} className="text-xs font-medium"
          style={{ color: "var(--brand-accent,#0E6B5C)" }}>
          Toutes les tâches
        </Link>
      }
      rememberKey="next-steps"
      collapsedOnMobile={collapsedOnMobile}
      bodyClassName="px-4 py-4"
    >
      <ul className="divide-y" style={{ borderColor: "#E3E6E2" }}>
        {shown.map(t => <Row key={t.id} t={t} today={today} />)}
      </ul>
      {rest > 0 && (
        <p className="text-xs mt-2" style={{ color: "#66716B" }}>
          et {rest} autre{rest > 1 ? "s" : ""} tâche{rest > 1 ? "s" : ""} ouverte{rest > 1 ? "s" : ""}.
        </p>
      )}
    </Foldable>
  )
}
